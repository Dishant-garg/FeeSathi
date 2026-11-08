import pytest
from datetime import date, timedelta
from sqlmodel import SQLModel, Session, create_engine, select
from sqlmodel.pool import StaticPool

from app.models import (
    CounsellorTask,
    Instalment,
    RefundRecord,
    ReminderLog,
    Student,
)
from app.services.refund_service import (
    RefundError,
    calculate_pro_rata_refund,
    issue_pro_rata_refund,
)


def get_test_session() -> Session:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def test_calculate_pro_rata_refund_positive():
    with get_test_session() as session:
        # Aarav Meena: Start 2026-04-01, Paid ₹90,000
        student = Student(
            id="STU-0412",
            name="Aarav Meena",
            centre="Tonk Road",
            batch="JEE 2027 Morning",
            parent_phone="9829010412",
            course_start_date=date(2026, 4, 1),
            course_end_date=date(2027, 1, 25),
            gross_annual_fee=120000,
            scholarship_discount=0,
            net_annual_fee=120000,
        )
        session.add(student)

        # 3 instalments paid = 90,000
        for i in range(1, 4):
            session.add(
                Instalment(
                    student_id="STU-0412",
                    instalment_no=i,
                    due_date=date(2026, 4, 10),
                    amount_due=30000,
                    amount_paid=30000,
                    status="PAID",
                )
            )
        session.commit()

        # Exit date 2026-10-15 (197 days attended), request on 2026-11-02
        calc = calculate_pro_rata_refund(
            session=session,
            student_id="STU-0412",
            exit_date=date(2026, 10, 15),
            request_date=date(2026, 11, 2),
        )

        assert calc["days_attended"] == 197
        assert calc["daily_rate_inr"] == 395.00  # (120,000 - 1,500) / 300
        assert calc["total_paid_to_date"] == 90000
        assert calc["refundable_amount"] == 10685  # 90,000 - (1500 + 197*395)
        assert calc["shortfall_receivable"] == 0
        assert calc["sla_deadline_date"] == "2026-11-12"  # request_date + 10 days
        assert calc["gst_credit_note_preview"]["total_credit_note_inr"] == 10685


def test_calculate_pro_rata_refund_shortfall():
    with get_test_session() as session:
        # Student only paid Instalment 1 (₹30,000) but attended 197 days
        student = Student(
            id="STU-SHORT",
            name="Late Payer",
            centre="Tonk Road",
            batch="JEE 2027",
            parent_phone="9829000099",
            course_start_date=date(2026, 4, 1),
            course_end_date=date(2027, 1, 25),
            gross_annual_fee=120000,
            net_annual_fee=120000,
        )
        session.add(student)
        session.add(
            Instalment(
                student_id="STU-SHORT",
                instalment_no=1,
                due_date=date(2026, 4, 10),
                amount_due=30000,
                amount_paid=30000,
                status="PAID",
            )
        )
        session.commit()

        calc = calculate_pro_rata_refund(
            session=session,
            student_id="STU-SHORT",
            exit_date=date(2026, 10, 15),
            request_date=date(2026, 11, 2),
        )
        # Utilized is ~79,315, paid is only 30,000
        assert calc["refundable_amount"] == 0
        assert calc["shortfall_receivable"] > 0
        assert calc["gst_credit_note_preview"]["total_credit_note_inr"] == 0


def test_issue_pro_rata_refund_atomic_side_effects():
    with get_test_session() as session:
        student = Student(
            id="STU-0412",
            name="Aarav Meena",
            centre="Tonk Road",
            batch="JEE 2027",
            parent_phone="9829010412",
            course_start_date=date(2026, 4, 1),
            course_end_date=date(2027, 1, 25),
            gross_annual_fee=120000,
            net_annual_fee=120000,
            status="ACTIVE",
        )
        session.add(student)

        inst_paid = Instalment(
            student_id="STU-0412",
            instalment_no=1,
            due_date=date(2026, 4, 10),
            amount_due=30000,
            amount_paid=30000,
            status="PAID",
        )
        inst_future = Instalment(
            student_id="STU-0412",
            instalment_no=4,
            due_date=date(2027, 1, 10),
            amount_due=30000,
            amount_paid=0,
            status="UPCOMING",
        )
        session.add(inst_paid)
        session.add(inst_future)

        reminder = ReminderLog(
            instalment_id=1,
            student_id="STU-0412",
            trigger_type="BEFORE_7_DAYS",
            scheduled_date=date(2027, 1, 3),
            message_en="Due soon",
            message_hi="Jald hi",
            status="SCHEDULED",
        )
        session.add(reminder)

        task = CounsellorTask(
            student_id="STU-0412",
            risk_score=50,
            risk_level="UNSURE_BORDERLINE",
            confidence="HIGH",
            status="OPEN",
        )
        session.add(task)
        session.commit()

        # Issue refund
        record = issue_pro_rata_refund(
            session=session,
            student_id="STU-0412",
            exit_date=date(2026, 4, 20),
            request_date=date(2026, 11, 2),
        )

        assert record.status == "PENDING_PAYOUT"
        assert record.sla_deadline_date == date(2026, 11, 12)
        assert record.gst_credit_note_no.startswith("JPR-CN-2627-")

        # Side effect 1: student status WITHDRAWN
        session.refresh(student)
        assert student.status == "WITHDRAWN"

        # Side effect 2: future unpaid instalment cancelled
        session.refresh(inst_future)
        assert inst_future.status == "CANCELLED_WITHDRAWN"

        # Side effect 3: scheduled reminder cancelled
        session.refresh(reminder)
        assert reminder.status == "CANCELLED_WITHDRAWN"

        # Side effect 4: open counsellor task closed
        session.refresh(task)
        assert task.status == "CLOSED_WITHDRAWN"

        # Duplicate refund blocked
        with pytest.raises(RefundError, match="Refund already issued"):
            issue_pro_rata_refund(
                session=session,
                student_id="STU-0412",
                exit_date=date(2026, 4, 20),
                request_date=date(2026, 11, 2),
            )
