import json
import pytest
from datetime import date
from sqlmodel import SQLModel, Session, create_engine, select
from sqlmodel.pool import StaticPool

from app.models import CounsellorTask, Instalment, Student
from app.services.ai_risk_service import (
    AIRiskError,
    dismiss_false_flag,
    evaluate_student_risk,
    sync_all_counsellor_tasks,
)


def get_test_session() -> Session:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def test_ishita_sharma_exact_74_risk_score():
    with get_test_session() as session:
        # Prompt Row #2: Ishita Sharma (23 days overdue on 2026-11-02, 15k/30k paid, 66% att, 72->54 tests)
        student = Student(
            id="STU-0587",
            name="Ishita Sharma",
            centre="Vaishali Nagar",
            batch="JEE 2027 Evening",
            parent_phone="9829010587",
            course_start_date=date(2026, 4, 1),
            course_end_date=date(2027, 1, 25),
            attendance_pct=66.0,
            test_scores_json=json.dumps([72.0, 63.0, 54.0]),
            status="ACTIVE",
        )
        session.add(student)

        instalment = Instalment(
            id=1,
            student_id="STU-0587",
            instalment_no=3,
            due_date=date(2026, 10, 10),
            amount_due=30000,
            amount_paid=15000,
            status="PART_PAID_OVERDUE",
        )
        session.add(instalment)
        session.commit()

        res = evaluate_student_risk(session, student, as_of=date(2026, 11, 2))
        assert res["risk_score"] == 74
        assert res["risk_level"] == "HIGH"
        assert res["confidence"] == "HIGH"
        assert res["days_overdue"] == 23
        assert res["factor_breakdown"]["fee_pts"] == 27.5
        assert res["factor_breakdown"]["att_pts"] == 26.6
        assert res["factor_breakdown"]["test_pts"] == 19.8
        assert "GUARDRAIL ACTIVE" in res["guardrail_notice"]


def test_priyanshi_joshi_sparse_data_unsure():
    with get_test_session() as session:
        # Priyanshi: 43 days overdue, but only 2 tests -> LOW_SPARSE_DATA
        student = Student(
            id="STU-0710",
            name="Priyanshi Joshi",
            centre="Tonk Road",
            batch="JEE 2027 Morning",
            parent_phone="9829010710",
            course_start_date=date(2026, 4, 1),
            course_end_date=date(2027, 1, 25),
            attendance_pct=74.0,
            test_scores_json=json.dumps([68.0, 62.0]),  # Only 2 tests!
            status="ACTIVE",
        )
        session.add(student)

        instalment = Instalment(
            id=2,
            student_id="STU-0710",
            instalment_no=3,
            due_date=date(2026, 9, 20),
            amount_due=30000,
            amount_paid=0,
            status="OVERDUE",
        )
        session.add(instalment)
        session.commit()

        res = evaluate_student_risk(session, student, as_of=date(2026, 11, 2))
        assert res["confidence"] == "LOW_SPARSE_DATA"
        assert res["risk_level"] == "UNSURE_BORDERLINE"
        assert "fewer than 3 mock test records are available" in res["diagnostic_summary"]


def test_false_flag_dismissal_and_resurfacing():
    with get_test_session() as session:
        # Initial: score is 58 (att 70% -> 21 pts, test drop 10% -> 11 pts, overdue 15d -> 26 pts)
        student = Student(
            id="STU-TEST",
            name="Dismissal Test Student",
            centre="Malviya Nagar",
            batch="NEET 2027",
            parent_phone="9829000055",
            course_start_date=date(2026, 4, 1),
            course_end_date=date(2027, 1, 25),
            attendance_pct=70.0,
            test_scores_json=json.dumps([80.0, 75.0, 70.0]),
            status="ACTIVE",
        )
        session.add(student)

        inst = Instalment(
            id=5,
            student_id="STU-TEST",
            instalment_no=1,
            due_date=date(2026, 10, 18),  # 15 days overdue on 2026-11-02
            amount_due=30000,
            amount_paid=0,
            status="OVERDUE",
        )
        session.add(inst)
        session.commit()

        # 1. Sync tasks -> creates OPEN task (score 58 >= 45)
        sync_all_counsellor_tasks(session, as_of=date(2026, 11, 2))
        task = session.exec(select(CounsellorTask).where(CounsellorTask.student_id == "STU-TEST")).first()
        assert task is not None
        assert task.status == "OPEN"
        assert task.risk_score == 58
        initial_score = task.risk_score

        # 2. Dismiss with invalid reason raises error
        with pytest.raises(AIRiskError, match="Invalid dismiss reason"):
            dismiss_false_flag(session, "STU-TEST", user_id=1, reason="INVALID_REASON")

        # 3. Dismiss with valid reason
        dismissed_eval = dismiss_false_flag(
            session,
            "STU-TEST",
            user_id=1,
            reason="MEDICAL_LEAVE",
            notes="Student was hospitalized with dengue",
            as_of=date(2026, 11, 2),
        )
        assert dismissed_eval["risk_level"] == "DISMISSED_FALSE_FLAG"
        session.refresh(task)
        assert task.status == "DISMISSED_FALSE_FLAG"
        assert task.dismiss_reason == "MEDICAL_LEAVE"

        # 4. If score worsens by >= 15 pts (58 + 15 = 73), it resurfaces
        # Drop attendance to 40% and tests to 50, and 30 days overdue
        student.attendance_pct = 40.0
        student.test_scores_json = json.dumps([80.0, 65.0, 50.0])
        inst.due_date = date(2026, 10, 1)  # 32 days overdue
        session.add(student)
        session.add(inst)
        session.commit()

        resurfaced_eval = evaluate_student_risk(session, student, as_of=date(2026, 11, 2))
        assert resurfaced_eval["risk_score"] >= initial_score + 15
        assert resurfaced_eval["risk_level"] == "RESURFACED_HIGH_RISK"

        # 5. Sync brings task back to OPEN
        sync_all_counsellor_tasks(session, as_of=date(2026, 11, 2))
        session.refresh(task)
        assert task.status == "OPEN"
        assert task.risk_level == "RESURFACED_HIGH_RISK"


def test_high_score_resurfacing_at_95_cap():
    with get_test_session() as session:
        # Student with severe baseline score of 90 (e.g. dismissed at 90)
        student = Student(
            id="STU-HIGH",
            name="Severe Risk Student",
            centre="Mansarovar",
            batch="JEE 2027",
            parent_phone="9829000099",
            course_start_date=date(2026, 4, 1),
            course_end_date=date(2027, 1, 25),
            attendance_pct=30.0,
            test_scores_json=json.dumps([90.0, 70.0, 50.0]),
            status="ACTIVE",
            ai_dismissed=True,
            ai_dismissed_at_score=90,  # Baseline 90! 90 + 15 = 105 (impossible without cap)
        )
        session.add(student)

        # 40 days overdue with full balance unpaid (fee_pts = 40.0)
        inst = Instalment(
            id=20,
            student_id="STU-HIGH",
            instalment_no=1,
            due_date=date(2026, 9, 1),
            amount_due=30000,
            amount_paid=0,
            status="OVERDUE",
        )
        session.add(inst)
        session.commit()

        # Score is 40 (fee) + 35 (att) + 25 (test) = 100!
        res = evaluate_student_risk(session, student, as_of=date(2026, 11, 2))
        assert res["risk_score"] >= 95
        # Under 95 cap, this resurfaces even though 90+15=105 is unreachable
        assert res["risk_level"] == "RESURFACED_HIGH_RISK"


def test_recovery_to_low_risk_resets_dismissal():
    with get_test_session() as session:
        # Student previously dismissed at score 74
        student = Student(
            id="STU-RECOV",
            name="Recovering Student",
            centre="Vaishali Nagar",
            batch="JEE 2027",
            parent_phone="9829000077",
            course_start_date=date(2026, 4, 1),
            course_end_date=date(2027, 1, 25),
            attendance_pct=92.0,  # Healed attendance!
            test_scores_json=json.dumps([85.0, 88.0, 90.0]),  # Climbing tests!
            status="ACTIVE",
            ai_dismissed=True,
            ai_dismissed_at_score=74,
            ai_dismiss_reason="MEDICAL_LEAVE",
        )
        session.add(student)

        # Fully paid instalment (fee_pts = 0)
        inst = Instalment(
            id=30,
            student_id="STU-RECOV",
            instalment_no=1,
            due_date=date(2026, 10, 10),
            amount_due=30000,
            amount_paid=30000,
            status="PAID",
        )
        session.add(inst)
        session.commit()

        # 1. Evaluate healed student -> score is 0 (< 45 LOW)
        res = evaluate_student_risk(session, student, as_of=date(2026, 11, 2))
        assert res["risk_score"] < 45
        assert res["risk_level"] == "LOW"

        # ai_dismissed must be reset to False!
        session.refresh(student)
        assert student.ai_dismissed is False
        assert student.ai_dismissed_at_score is None

        # 2. Months later, student defaults again (drops to 66% att and 23d overdue)
        student.attendance_pct = 66.0
        student.test_scores_json = json.dumps([72.0, 63.0, 54.0])
        inst.amount_paid = 15000
        inst.status = "PART_PAID_OVERDUE"
        session.add(student)
        session.add(inst)
        session.commit()

        # Score is back at 74 -> Should cleanly alert as fresh HIGH risk!
        res_fresh = evaluate_student_risk(session, student, as_of=date(2026, 11, 2))
        assert res_fresh["risk_score"] == 74
        assert res_fresh["risk_level"] == "HIGH"  # Not blocked by old dengue dismissal!

