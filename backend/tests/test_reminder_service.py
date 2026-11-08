from datetime import date, timedelta
from sqlmodel import SQLModel, Session, create_engine, select
from sqlmodel.pool import StaticPool

from app.models import Instalment, ReminderLog, Student
from app.services.reminder_service import (
    dispatch_due_reminders,
    ensure_schedule_for_instalment,
    format_bilingual_reminder,
)


def get_test_session() -> Session:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def test_format_bilingual_reminder():
    student = Student(
        id="STU-0587",
        name="Ishita Sharma",
        centre="Vaishali Nagar",
        batch="JEE 2027 Evening",
        parent_phone="9829010587",
        course_start_date=date(2026, 4, 1),
        course_end_date=date(2027, 1, 25),
    )
    instalment = Instalment(
        id=1,
        student_id="STU-0587",
        instalment_no=3,
        due_date=date(2026, 10, 10),
        amount_due=30000,
        amount_paid=15000,  # Part paid
        status="PART_PAID_OVERDUE",
    )

    # 1. Before 7 days
    en, hi = format_bilingual_reminder(student, instalment, "BEFORE_7_DAYS")
    assert "₹15,000" in en
    assert "₹15,000" in hi
    assert "आगामी किस्त" in hi

    # 2. On due date
    en_on, hi_on = format_bilingual_reminder(student, instalment, "ON_DUE_DATE")
    assert "Due Today" in en_on
    assert "आज देय" in hi_on

    # 3. After 7 days (23 days overdue on 2026-11-02)
    en_after, hi_after = format_bilingual_reminder(
        student, instalment, "AFTER_7_DAYS", as_of_date=date(2026, 11, 2)
    )
    assert "23 days overdue" in en_after
    assert "23 दिन अतिदेय" in hi_after


def test_ensure_schedule_for_instalment():
    with get_test_session() as session:
        student = Student(
            id="STU-0219",
            name="Mohit Gurjar",
            centre="Malviya Nagar",
            batch="NEET 2027 Morning",
            parent_phone="9829010219",
            course_start_date=date(2026, 4, 1),
            course_end_date=date(2027, 1, 25),
        )
        session.add(student)

        instalment = Instalment(
            id=10,
            student_id="STU-0219",
            instalment_no=3,
            due_date=date(2026, 11, 15),
            amount_due=40000,
            amount_paid=0,
            status="UPCOMING",
        )
        session.add(instalment)
        session.commit()

        # 1. Generate schedule
        rems = ensure_schedule_for_instalment(session, instalment, student)
        assert len(rems) == 3
        types = [r.trigger_type for r in rems]
        assert "BEFORE_7_DAYS" in types
        assert "ON_DUE_DATE" in types
        assert "AFTER_7_DAYS" in types

        # 2. Calling again is a no-op
        rems_again = ensure_schedule_for_instalment(session, instalment, student)
        assert len(rems_again) == 0


def test_dispatch_due_reminders_and_send_time_guardrails():
    with get_test_session() as session:
        student = Student(
            id="STU-0100",
            name="Ravi Kumar",
            centre="Tonk Road",
            batch="JEE 2027",
            parent_phone="9829010100",
            course_start_date=date(2026, 4, 1),
            course_end_date=date(2027, 1, 25),
        )
        session.add(student)

        # Unpaid instalment
        inst1 = Instalment(
            id=101,
            student_id="STU-0100",
            instalment_no=1,
            due_date=date(2026, 10, 10),
            amount_due=30000,
            amount_paid=0,
            status="OVERDUE",
        )
        session.add(inst1)

        # Paid instalment
        inst2 = Instalment(
            id=102,
            student_id="STU-0100",
            instalment_no=2,
            due_date=date(2026, 10, 10),
            amount_due=30000,
            amount_paid=30000,
            status="PAID",
        )
        session.add(inst2)

        # Reminder for unpaid inst1 scheduled for 2026-10-03 (in the past relative to 2026-11-02)
        rem1 = ReminderLog(
            id=1,
            instalment_id=101,
            student_id="STU-0100",
            trigger_type="BEFORE_7_DAYS",
            scheduled_date=date(2026, 10, 3),
            message_en="old",
            message_hi="old",
            status="SCHEDULED",
        )
        session.add(rem1)

        # Reminder for paid inst2 scheduled for 2026-10-03
        rem2 = ReminderLog(
            id=2,
            instalment_id=102,
            student_id="STU-0100",
            trigger_type="BEFORE_7_DAYS",
            scheduled_date=date(2026, 10, 3),
            message_en="old",
            message_hi="old",
            status="SCHEDULED",
        )
        session.add(rem2)
        session.commit()

        # Run dispatch as of 2026-11-02
        stats = dispatch_due_reminders(session, as_of_date=date(2026, 11, 2))
        assert stats["sent_count"] == 1
        assert stats["stopped_at_send_time_count"] == 1

        session.refresh(rem1)
        session.refresh(rem2)
        assert rem1.status == "SENT"
        assert rem2.status == "STOPPED_ON_PAYMENT"
