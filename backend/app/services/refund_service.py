from datetime import date, datetime, timedelta, timezone
from typing import Dict, Any
from sqlmodel import Session, select
from app.config import (
    FINANCIAL_YEAR_CODE,
    INSTITUTE_GSTIN,
    NON_REFUNDABLE_REG_FEE,
    REFERENCE_DATE,
    REFUND_SLA_DAYS,
    TOTAL_SESSION_DAYS,
)
from app.models import (
    CounsellorTask,
    Instalment,
    RefundRecord,
    ReminderLog,
    Student,
)
from app.services.receipt_service import compute_gst_split


class RefundError(ValueError):
    """Domain error raised for invalid refund operations."""


def calculate_pro_rata_refund(
    session: Session,
    student_id: str,
    exit_date: date,
    request_date: date = REFERENCE_DATE,
) -> Dict[str, Any]:
    """
    Calculates a transparent pro-rata refund under the MoE 2024 Coaching Guidelines
    and the institute's written policy (Labelled Assumptions A2, A3, A4, A5):
    - 300-day academic session (`course_start_date` to `course_end_date`).
    - ₹1,500 non-refundable administrative registration fee component.
    - 10-day statutory SLA countdown starts from `request_date` (not back-dated `exit_date`).
    - If `total_paid_to_date` is less than `pro_rata_fee_utilized`, `refundable_amount = 0`
      and the balance is recorded as `shortfall_receivable`.
    """
    student = session.get(Student, student_id)
    if student is None:
        raise RefundError(f"Student {student_id} not found")

    if exit_date < student.course_start_date:
        raise RefundError("Exit date cannot be earlier than course start date")
    if exit_date > request_date:
        raise RefundError("Exit date cannot be in the future relative to request date")

    instalments = session.exec(
        select(Instalment).where(Instalment.student_id == student_id)
    ).all()
    total_paid = sum(i.amount_paid for i in instalments)

    raw_days = (exit_date - student.course_start_date).days
    days_attended = max(0, min(TOTAL_SESSION_DAYS, raw_days))

    allocable_course_fee = max(0, student.net_annual_fee - NON_REFUNDABLE_REG_FEE)
    daily_rate = round(allocable_course_fee / TOTAL_SESSION_DAYS, 2)
    instructional_fee_consumed = round(
        (allocable_course_fee / TOTAL_SESSION_DAYS) * days_attended
    )
    pro_rata_fee_utilized = NON_REFUNDABLE_REG_FEE + instructional_fee_consumed

    refundable_amount = max(0, total_paid - pro_rata_fee_utilized)
    shortfall_receivable = max(0, pro_rata_fee_utilized - total_paid)
    sla_deadline_date = request_date + timedelta(days=REFUND_SLA_DAYS)

    # Compute GST credit note breakdown if a positive refund is owed
    if refundable_amount > 0:
        cn_base, cn_cgst, cn_sgst = compute_gst_split(refundable_amount)
    else:
        cn_base, cn_cgst, cn_sgst = 0.0, 0.0, 0.0

    return {
        "student_id": student.id,
        "student_name": student.name,
        "centre": student.centre,
        "batch": student.batch,
        "student_status": student.status,
        "course_start_date": student.course_start_date.isoformat(),
        "course_end_date": student.course_end_date.isoformat(),
        "exit_date": exit_date.isoformat(),
        "request_date": request_date.isoformat(),
        "sla_deadline_date": sla_deadline_date.isoformat(),
        "sla_days": REFUND_SLA_DAYS,
        "total_session_days": TOTAL_SESSION_DAYS,
        "days_attended": days_attended,
        "gross_fee": student.gross_annual_fee,
        "discount": student.scholarship_discount,
        "net_fee": student.net_annual_fee,
        "non_refundable_reg_fee": NON_REFUNDABLE_REG_FEE,
        "allocable_course_fee": allocable_course_fee,
        "daily_rate_inr": daily_rate,
        "instructional_fee_consumed": instructional_fee_consumed,
        "pro_rata_fee_utilized": pro_rata_fee_utilized,
        "total_paid_to_date": total_paid,
        "refundable_amount": refundable_amount,
        "shortfall_receivable": shortfall_receivable,
        "gst_credit_note_preview": {
            "gstin": INSTITUTE_GSTIN,
            "taxable_base_reversed_inr": cn_base,
            "cgst_reversed_inr": cn_cgst,
            "sgst_reversed_inr": cn_sgst,
            "total_credit_note_inr": refundable_amount,
        },
    }


def issue_pro_rata_refund(
    session: Session,
    student_id: str,
    exit_date: date,
    request_date: date = REFERENCE_DATE,
) -> RefundRecord:
    """
    Atomically executes a student withdrawal and refund record creation:
    1. Blocks duplicate refund requests.
    2. Creates the `RefundRecord` with a 10-day MoE SLA deadline (`request_date + 10 days`)
       and GST Credit Note number (if `refundable_amount > 0`).
    3. Marks student `WITHDRAWN`.
    4. Cancels unpaid future instalments and stops all `SCHEDULED` reminders.
    5. Closes any open `CounsellorTask` rows for the student.
    """
    existing_refund = session.exec(
        select(RefundRecord).where(RefundRecord.student_id == student_id)
    ).first()
    if existing_refund is not None:
        raise RefundError(f"Refund already issued for student {student_id}")

    student = session.get(Student, student_id)
    if student is None:
        raise RefundError(f"Student {student_id} not found")
    if student.status == "WITHDRAWN":
        raise RefundError(f"Student {student_id} is already marked WITHDRAWN")

    calc = calculate_pro_rata_refund(
        session, student_id=student_id, exit_date=exit_date, request_date=request_date
    )

    existing_count = len(session.exec(select(RefundRecord)).all())
    credit_note_no = (
        f"JPR-CN-{FINANCIAL_YEAR_CODE}-{existing_count + 1:04d}"
        if calc["refundable_amount"] > 0
        else None
    )

    now_ts = datetime.now(timezone.utc)
    refund_record = RefundRecord(
        student_id=student.id,
        request_date=request_date,
        exit_date=exit_date,
        sla_deadline_date=date.fromisoformat(calc["sla_deadline_date"]),
        days_attended=calc["days_attended"],
        gross_fee=calc["gross_fee"],
        discount=calc["discount"],
        net_fee=calc["net_fee"],
        non_refundable_reg_fee=calc["non_refundable_reg_fee"],
        total_paid_to_date=calc["total_paid_to_date"],
        pro_rata_fee_utilized=calc["pro_rata_fee_utilized"],
        refundable_amount=calc["refundable_amount"],
        shortfall_receivable=calc["shortfall_receivable"],
        gst_credit_note_no=credit_note_no,
        status="PENDING_PAYOUT" if calc["refundable_amount"] > 0 else "SETTLED_WITH_SHORTFALL",
        created_at=now_ts,
    )
    session.add(refund_record)

    # Withdrawal side-effect #1: Mark student WITHDRAWN
    student.status = "WITHDRAWN"
    session.add(student)

    # Withdrawal side-effect #2: Cancel unpaid future instalments
    instalments = session.exec(
        select(Instalment).where(Instalment.student_id == student.id)
    ).all()
    for inst in instalments:
        if inst.amount_paid == 0 and inst.status in ("UPCOMING", "OVERDUE"):
            inst.status = "CANCELLED_WITHDRAWN"
            session.add(inst)

    # Withdrawal side-effect #3: Cancel all SCHEDULED reminders
    scheduled_reminders = session.exec(
        select(ReminderLog).where(
            ReminderLog.student_id == student.id,
            ReminderLog.status == "SCHEDULED",
        )
    ).all()
    for rem in scheduled_reminders:
        rem.status = "CANCELLED_WITHDRAWN"
        rem.stopped_reason = f"Student withdrawn on {exit_date.isoformat()}"
        rem.updated_at = now_ts
        session.add(rem)

    # Withdrawal side-effect #4: Close open CounsellorTask rows
    open_tasks = session.exec(
        select(CounsellorTask).where(
            CounsellorTask.student_id == student.id,
            CounsellorTask.status == "OPEN",
        )
    ).all()
    for task in open_tasks:
        task.status = "CLOSED_WITHDRAWN"
        task.counsellor_notes = (task.counsellor_notes or "") + f" [Closed due to withdrawal on {exit_date.isoformat()}]"
        task.updated_at = now_ts
        session.add(task)

    session.commit()
    session.refresh(refund_record)
    return refund_record
