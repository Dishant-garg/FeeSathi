import os
from datetime import date, datetime, timezone
from typing import Dict, Any, List, Optional
from sqlmodel import Session, select
from app.config import REFERENCE_DATE, VALID_DISMISS_REASONS
from app.models import CounsellorTask, Instalment, Student

# Read Groq or Gemini API keys optionally
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


class AIRiskError(ValueError):
    """Domain error raised for invalid AI risk actions."""


def _find_most_overdue_or_active_instalment(
    instalments: List[Instalment], as_of: date = REFERENCE_DATE
) -> tuple[int, int, int]:
    """
    Returns (max_days_overdue, amount_due, amount_paid) for the earliest overdue instalment.
    If no instalment is overdue, returns (0, 0, 0).
    """
    overdue_insts = [
        i for i in instalments if i.status != "PAID" and i.due_date < as_of and (i.amount_due - i.amount_paid) > 0
    ]
    if not overdue_insts:
        return 0, 0, 0

    overdue_insts.sort(key=lambda x: x.due_date)
    target = overdue_insts[0]
    days_overdue = max(0, (as_of - target.due_date).days)
    return days_overdue, target.amount_due, target.amount_paid


def evaluate_student_risk(
    session: Session, student: Student, as_of: date = REFERENCE_DATE
) -> Dict[str, Any]:
    """
    Deterministic 3-factor dropout risk engine (Labelled Assumptions A8, A9, A10):
    - Keeps all 3 factor components as unrounded floats and rounds ONCE at the end:
      `total_score = round(fee_pts + att_pts + test_pts)`
    - Enforces `LOW_SPARSE_DATA` confidence when fewer than 3 mock tests exist.
    - Re-surfaces a previously dismissed false flag if `total_score >= ai_dismissed_at_score + 15`.
    - Strips PII (`student.id` and `student.name`) if calling LLM API (DPDP Act 2023 safe).
    """
    instalments = session.exec(
        select(Instalment).where(Instalment.student_id == student.id)
    ).all()
    days_overdue, amount_due, amount_paid = _find_most_overdue_or_active_instalment(
        instalments, as_of=as_of
    )

    # Factor 1: Fee Friction (Max 40.0 pts: up to 28 pts for days overdue + up to 12 pts for unpaid ratio)
    if days_overdue > 0 and amount_due > 0:
        unpaid_ratio = max(0.0, (amount_due - amount_paid) / float(amount_due))
        fee_pts = (min(days_overdue, 30) / 30.0) * 28.0 + (unpaid_ratio * 12.0)
    else:
        unpaid_ratio = 0.0
        fee_pts = 0.0

    # Factor 2: Attendance Decay below 85% target (Max 35.0 pts)
    att_pts = min(35.0, max(0.0, (85.0 - student.attendance_pct) * 1.4))

    # Factor 3: Test Score Trajectory across available tests (Max 25.0 pts)
    scores = student.test_scores
    if len(scores) >= 2:
        test_delta = scores[-1] - scores[0]
        test_pts = min(25.0, max(0.0, abs(test_delta) * 1.1)) if test_delta < 0 else 0.0
    else:
        test_delta = 0.0
        test_pts = 0.0

    confidence = "HIGH" if len(scores) >= 3 else "LOW_SPARSE_DATA"

    # Locked Rule #1: Round ONCE at the very end
    total_score = int(round(fee_pts + att_pts + test_pts))

    # Determine Risk Level including Resurfacing & Unsure states
    if student.status == "WITHDRAWN":
        risk_level = "WITHDRAWN"
    elif total_score < 45:
        # Full Recovery: student healed back to healthy LOW risk
        if student.ai_dismissed:
            student.ai_dismissed = False
            student.ai_dismissed_at_score = None
            student.ai_dismiss_reason = None
            student.ai_dismiss_notes = None
            session.add(student)
            session.commit()
            session.refresh(student)
        risk_level = "LOW"
    elif student.ai_dismissed:
        baseline = student.ai_dismissed_at_score or 0
        threshold = min(baseline + 15, 95)
        if total_score >= threshold:
            risk_level = "RESURFACED_HIGH_RISK"
        else:
            risk_level = "DISMISSED_FALSE_FLAG"
    elif total_score >= 60 and confidence == "HIGH":
        risk_level = "HIGH"
    elif total_score >= 45:
        # Covers borderline (45-59) OR sparse-data students scoring >= 45
        risk_level = "UNSURE_BORDERLINE"
    else:
        risk_level = "LOW"

    # Deterministic DPDP-safe diagnostic summary & bilingual talking points
    generation_mode = "DETERMINISTIC_FALLBACK"
    diagnostic_summary = (
        f"{student.name} ({student.batch}) has a composite risk score of {total_score}/100 "
        f"({days_overdue}d overdue on current instalment, {student.attendance_pct:.0f}% attendance, "
        f"{test_delta:+.1f}% test trajectory across {len(scores)} mock tests)."
    )
    if confidence == "LOW_SPARSE_DATA" and risk_level == "UNSURE_BORDERLINE":
        diagnostic_summary += (
            " Marked as AI UNSURE because fewer than 3 mock test records are available—verify batch attendance register before calling."
        )

    talking_points = [
        "Check in on academic comfort and mock test workload first—do not lead with fee collection.",
        "Ask whether batch timing or commute in Jaipur is affecting class attendance.",
        "If the parent mentions financial timing, log a note for Accounts rather than pressuring on the call.",
    ]
    hindi_opener = (
        f"नमस्ते, मैं {student.name} के बैच काउंसलर बात कर रहा हूँ—उनकी हाल की क्लासेस और टेस्ट की तैयारी के बारे में संक्षिप्त बात करनी थी।"
    )

    # Optional DPDP-anonymized LLM call (strips student name and ID from outbound prompt)
    if GROQ_API_KEY and risk_level in ("HIGH", "UNSURE_BORDERLINE", "RESURFACED_HIGH_RISK"):
        try:
            from groq import Groq
            client = Groq(api_key=GROQ_API_KEY)
            anon_prompt = (
                "You are an empathetic academic counsellor assistant. "
                "Write a 2-sentence anonymous diagnostic note for a coaching student with these metrics: "
                f"days_overdue={days_overdue}, attendance_pct={student.attendance_pct}, "
                f"test_delta={test_delta:+.1f}% over {len(scores)} tests. "
                "Use [STUDENT] as placeholder for the name."
            )
            chat_completion = client.chat.completions.create(
                messages=[{"role": "user", "content": anon_prompt}],
                model="llama-3.3-70b-versatile",
                max_tokens=150,
            )
            content = chat_completion.choices[0].message.content
            if content:
                diagnostic_summary = content.strip().replace("[STUDENT]", student.name)
                generation_mode = "GROQ_LLM_ANONYMIZED"
        except Exception:
            generation_mode = "DETERMINISTIC_FALLBACK"

    return {
        "student_id": student.id,
        "student_name": student.name,
        "centre": student.centre,
        "batch": student.batch,
        "risk_score": total_score,
        "risk_level": risk_level,
        "confidence": confidence,
        "days_overdue": days_overdue,
        "attendance_pct": student.attendance_pct,
        "test_scores": scores,
        "test_delta": round(test_delta, 1),
        "factor_breakdown": {
            "fee_pts": round(fee_pts, 1),
            "fee_max": 40,
            "att_pts": round(att_pts, 1),
            "att_max": 35,
            "test_pts": round(test_pts, 1),
            "test_max": 25,
        },
        "dismissal_metadata": {
            "ai_dismissed": student.ai_dismissed,
            "dismissed_at_score": student.ai_dismissed_at_score,
            "dismiss_reason": student.ai_dismiss_reason,
            "dismiss_notes": student.ai_dismiss_notes,
        },
        "diagnostic_summary": diagnostic_summary,
        "counsellor_talking_points": talking_points,
        "hindi_call_opener": hindi_opener,
        "generation_mode": generation_mode,
        "guardrail_notice": (
            "GUARDRAIL ACTIVE: Flag only creates an internal counsellor call task. "
            "It never triggers automated fee actions, penalties, or parent messages."
        ),
    }


def sync_all_counsellor_tasks(session: Session, as_of: date = REFERENCE_DATE) -> List[Dict[str, Any]]:
    """
    Evaluates all active students outside the payment transaction and synchronizes
    `CounsellorTask` records for `HIGH`, `UNSURE_BORDERLINE`, and `RESURFACED_HIGH_RISK` cases.
    """
    students = session.exec(select(Student)).all()
    assessments: List[Dict[str, Any]] = []
    now_ts = datetime.now(timezone.utc)

    for student in students:
        if student.status == "WITHDRAWN":
            continue

        result = evaluate_student_risk(session, student, as_of=as_of)
        level = result["risk_level"]

        existing_task = session.exec(
            select(CounsellorTask)
            .where(CounsellorTask.student_id == student.id)
            .order_by(CounsellorTask.id.desc())
        ).first()

        if level in ("HIGH", "UNSURE_BORDERLINE", "RESURFACED_HIGH_RISK"):
            if existing_task is None or existing_task.status in ("COMPLETED", "CLOSED_WITHDRAWN"):
                existing_task = CounsellorTask(
                    student_id=student.id,
                    risk_score=result["risk_score"],
                    risk_level=level,
                    confidence=result["confidence"],
                    status="OPEN",
                    created_at=now_ts,
                    updated_at=now_ts,
                )
                session.add(existing_task)
            elif existing_task.status == "DISMISSED_FALSE_FLAG" and level == "RESURFACED_HIGH_RISK":
                existing_task.status = "OPEN"
                existing_task.risk_score = result["risk_score"]
                existing_task.risk_level = "RESURFACED_HIGH_RISK"
                existing_task.updated_at = now_ts
                session.add(existing_task)
            else:
                existing_task.risk_score = result["risk_score"]
                existing_task.risk_level = level
                existing_task.confidence = result["confidence"]
                existing_task.updated_at = now_ts
                session.add(existing_task)
        elif existing_task is not None and existing_task.status in ("OPEN", "DISMISSED_FALSE_FLAG") and level == "LOW":
            # Score dropped below threshold (student recovered or cleared dues)
            existing_task.status = "COMPLETED"
            existing_task.risk_score = result["risk_score"]
            existing_task.risk_level = "LOW"
            existing_task.counsellor_notes = (existing_task.counsellor_notes or "") + " [Auto-resolved: student recovered to LOW risk (<45)]"
            existing_task.updated_at = now_ts
            session.add(existing_task)

        session.flush()
        result["task_id"] = existing_task.id if existing_task else None
        result["task_status"] = existing_task.status if existing_task else "NONE"
        assessments.append(result)

    session.commit()
    assessments.sort(key=lambda x: x["risk_score"], reverse=True)
    return assessments


def dismiss_false_flag(
    session: Session,
    student_id: str,
    user_id: int,
    reason: str,
    notes: Optional[str] = None,
    as_of: date = REFERENCE_DATE,
) -> Dict[str, Any]:
    """
    Allows a Counsellor or Accounts Executive to mark an AI flag as a false positive.
    Stores `ai_dismissed_at_score` so that if the student's score later jumps by >= 15 points,
    the flag automatically resurfaces.
    """
    if reason not in VALID_DISMISS_REASONS:
        raise AIRiskError(
            f"Invalid dismiss reason '{reason}'. Must be one of: {sorted(VALID_DISMISS_REASONS)}"
        )

    student = session.get(Student, student_id)
    if student is None:
        raise AIRiskError(f"Student {student_id} not found")

    current_eval = evaluate_student_risk(session, student, as_of=as_of)
    now_ts = datetime.now(timezone.utc)

    student.ai_dismissed = True
    student.ai_dismissed_at_score = current_eval["risk_score"]
    student.ai_dismissed_by_user_id = user_id
    student.ai_dismiss_reason = reason
    student.ai_dismiss_notes = notes or "Marked as false flag by counsellor"
    student.ai_dismissed_at = now_ts
    session.add(student)

    open_tasks = session.exec(
        select(CounsellorTask).where(
            CounsellorTask.student_id == student.id,
            CounsellorTask.status == "OPEN",
        )
    ).all()
    for task in open_tasks:
        task.status = "DISMISSED_FALSE_FLAG"
        task.dismiss_reason = reason
        task.counsellor_notes = notes
        task.updated_at = now_ts
        session.add(task)

    session.commit()
    session.refresh(student)
    return evaluate_student_risk(session, student, as_of=as_of)
