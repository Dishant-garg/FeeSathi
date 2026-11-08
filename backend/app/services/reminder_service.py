from datetime import date, datetime, timedelta, timezone
from typing import List, Dict, Any
from sqlmodel import Session, select
from app.config import REFERENCE_DATE
from app.models import Instalment, ReminderLog, Student


def format_bilingual_reminder(
    student: Student,
    instalment: Instalment,
    trigger_type: str,
    as_of_date: date = REFERENCE_DATE,
) -> tuple[str, str]:
    """
    Formats English and Hindi reminder messages using the live remaining balance
    (`amount_due - amount_paid`) at the moment of generation or send.
    """
    remaining = max(0, instalment.amount_due - instalment.amount_paid)
    due_str = instalment.due_date.strftime("%d %b %Y")

    if trigger_type == "BEFORE_7_DAYS":
        en = (
            f"Upcoming Due: Instalment #{instalment.instalment_no} balance of ₹{remaining:,} "
            f"for {student.name} ({student.batch}) is due on {due_str}."
        )
        hi = (
            f"आगामी किस्त: {student.name} ({student.batch}) की किस्त #{instalment.instalment_no} "
            f"की शेष राशि ₹{remaining:,} की देय तिथि {due_str} है।"
        )
    elif trigger_type == "ON_DUE_DATE":
        en = (
            f"Due Today: Instalment #{instalment.instalment_no} balance of ₹{remaining:,} "
            f"for {student.name} ({student.batch}) is due today ({due_str})."
        )
        hi = (
            f"आज देय: {student.name} ({student.batch}) की किस्त #{instalment.instalment_no} "
            f"की शेष राशि ₹{remaining:,} आज ({due_str}) देय है।"
        )
    else:
        days_late = max(1, (as_of_date - instalment.due_date).days)
        en = (
            f"Overdue Follow-up: Remaining balance of ₹{remaining:,} on Instalment #{instalment.instalment_no} "
            f"for {student.name} ({student.batch}) is {days_late} days overdue. Pay via portal link."
        )
        hi = (
            f"अतिदेय अनुस्मारक: {student.name} ({student.batch}) की किस्त #{instalment.instalment_no} "
            f"की शेष राशि ₹{remaining:,} ({days_late} दिन अतिदेय) बकाया है। कृपया पोर्टल लिंक से भुगतान करें।"
        )
    return en, hi


def ensure_schedule_for_instalment(
    session: Session, instalment: Instalment, student: Student
) -> List[ReminderLog]:
    """
    Generates BEFORE_7_DAYS, ON_DUE_DATE, and AFTER_7_DAYS reminder entries for an unpaid instalment
    if they do not already exist.
    """
    if instalment.status == "PAID" or student.status == "WITHDRAWN":
        return []

    schedule_specs = [
        ("BEFORE_7_DAYS", instalment.due_date - timedelta(days=7)),
        ("ON_DUE_DATE", instalment.due_date),
        ("AFTER_7_DAYS", instalment.due_date + timedelta(days=7)),
    ]

    created: List[ReminderLog] = []
    for trigger_type, sched_date in schedule_specs:
        existing = session.exec(
            select(ReminderLog).where(
                ReminderLog.instalment_id == instalment.id,
                ReminderLog.trigger_type == trigger_type,
            )
        ).first()
        if existing is None:
            msg_en, msg_hi = format_bilingual_reminder(student, instalment, trigger_type)
            rem = ReminderLog(
                instalment_id=instalment.id,
                student_id=student.id,
                trigger_type=trigger_type,
                scheduled_date=sched_date,
                message_en=msg_en,
                message_hi=msg_hi,
                status="SCHEDULED",
            )
            session.add(rem)
            created.append(rem)

    if created:
        session.commit()
    return created


def dispatch_due_reminders(
    session: Session, as_of_date: date = REFERENCE_DATE
) -> Dict[str, Any]:
    """
    Automatic scheduler tick:
    - Finds all SCHEDULED reminders with `scheduled_date <= as_of_date`.
    - Re-verifies at send time that the instalment is NOT paid and student is NOT withdrawn
      (closing any race condition between payment and dispatch).
    - Re-computes the exact remaining balance (`amount_due - amount_paid`) so partial-payment
      reminders always quote the live unpaid balance.
    """
    due_reminders = session.exec(
        select(ReminderLog).where(
            ReminderLog.status == "SCHEDULED",
            ReminderLog.scheduled_date <= as_of_date,
        )
    ).all()

    sent_count = 0
    stopped_count = 0
    now_ts = datetime.now(timezone.utc)

    for rem in due_reminders:
        instalment = session.get(Instalment, rem.instalment_id)
        student = session.get(Student, rem.student_id)

        if instalment is None or student is None:
            continue

        # Send-time guardrail #1: Student withdrawn
        if student.status == "WITHDRAWN":
            rem.status = "CANCELLED_WITHDRAWN"
            rem.stopped_reason = "Student withdrawn prior to dispatch"
            rem.updated_at = now_ts
            stopped_count += 1
            session.add(rem)
            continue

        # Send-time guardrail #2: Instalment already fully paid
        remaining = instalment.amount_due - instalment.amount_paid
        if remaining <= 0 or instalment.status == "PAID":
            rem.status = "STOPPED_ON_PAYMENT"
            rem.stopped_reason = "Send-time check verified instalment is already PAID"
            rem.updated_at = now_ts
            stopped_count += 1
            session.add(rem)
            continue

        # Refresh message text with live remaining balance and days overdue
        msg_en, msg_hi = format_bilingual_reminder(
            student, instalment, rem.trigger_type, as_of_date=as_of_date
        )
        rem.message_en = msg_en
        rem.message_hi = msg_hi
        rem.status = "SENT"
        rem.updated_at = now_ts
        sent_count += 1
        session.add(rem)

    session.commit()
    return {
        "as_of_date": as_of_date.isoformat(),
        "sent_count": sent_count,
        "stopped_at_send_time_count": stopped_count,
    }
