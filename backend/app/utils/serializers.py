from datetime import date
from typing import Any, Dict, List, Optional
from sqlmodel import Session, select

from app.config import REFERENCE_DATE
from app.models import Instalment, PaymentRecord, RefundRecord, ReminderLog, Student


def serialize_instalment(inst: Instalment, as_of: date = REFERENCE_DATE) -> Dict[str, Any]:
    remaining = max(0, inst.amount_due - inst.amount_paid)
    days_overdue = (
        max(0, (as_of - inst.due_date).days)
        if remaining > 0 and inst.due_date < as_of
        else 0
    )
    days_until_due = (
        max(0, (inst.due_date - as_of).days)
        if remaining > 0 and inst.due_date >= as_of
        else 0
    )
    return {
        "id": inst.id,
        "student_id": inst.student_id,
        "instalment_no": inst.instalment_no,
        "due_date": inst.due_date.isoformat(),
        "amount_due": inst.amount_due,
        "amount_paid": inst.amount_paid,
        "remaining_balance": remaining,
        "status": inst.status,
        "days_overdue": days_overdue,
        "days_until_due": days_until_due,
        "paid_at": inst.paid_at.isoformat() if inst.paid_at else None,
        "latest_receipt_no": inst.latest_receipt_no,
    }


def build_student_ledger_payload(
    session: Session, student: Student, as_of: date = REFERENCE_DATE
) -> Dict[str, Any]:
    instalments = session.exec(
        select(Instalment)
        .where(Instalment.student_id == student.id)
        .order_by(Instalment.instalment_no)
    ).all()
    serialized_insts = [serialize_instalment(i, as_of=as_of) for i in instalments]

    unpaid_insts = [
        i for i in serialized_insts
        if i["remaining_balance"] > 0 and i["status"] != "CANCELLED_WITHDRAWN"
    ]
    hero_instalment = unpaid_insts[0] if unpaid_insts else (serialized_insts[-1] if serialized_insts else None)

    payments = session.exec(
        select(PaymentRecord)
        .where(PaymentRecord.student_id == student.id)
        .order_by(PaymentRecord.id.desc())
    ).all()

    reminders = session.exec(
        select(ReminderLog)
        .where(ReminderLog.student_id == student.id)
        .order_by(ReminderLog.scheduled_date)
    ).all()

    refund_rec = session.exec(
        select(RefundRecord).where(RefundRecord.student_id == student.id)
    ).first()

    total_paid = sum(i.amount_paid for i in instalments)
    total_balance = max(0, student.net_annual_fee - total_paid)
    max_overdue = max((i["days_overdue"] for i in serialized_insts), default=0)

    return {
        "student": {
            "id": student.id,
            "name": student.name,
            "centre": student.centre,
            "batch": student.batch,
            "parent_phone": student.parent_phone,
            "status": student.status,
            "course_start_date": student.course_start_date.isoformat(),
            "course_end_date": student.course_end_date.isoformat(),
            "gross_annual_fee": student.gross_annual_fee,
            "scholarship_discount": student.scholarship_discount,
            "net_annual_fee": student.net_annual_fee,
            "total_paid": total_paid,
            "total_balance": total_balance,
            "max_days_overdue": max_overdue,
            "attendance_pct": student.attendance_pct,
            "test_scores": student.test_scores,
        },
        "hero_due_card": hero_instalment,
        "additional_unpaid_count": max(0, len(unpaid_insts) - 1),
        "instalments": serialized_insts,
        "receipts": [
            {
                "receipt_no": p.gst_receipt_no,
                "instalment_id": p.instalment_id,
                "amount": p.amount,
                "base_amount": p.base_amount,
                "cgst_amount": p.cgst_amount,
                "sgst_amount": p.sgst_amount,
                "payment_mode": p.payment_mode,
                "created_at": p.created_at.isoformat(),
            }
            for p in payments
        ],
        "reminders": [
            {
                "id": r.id,
                "instalment_id": r.instalment_id,
                "trigger_type": r.trigger_type,
                "scheduled_date": r.scheduled_date.isoformat(),
                "message_en": r.message_en,
                "message_hi": r.message_hi,
                "status": r.status,
                "stopped_reason": r.stopped_reason,
            }
            for r in reminders
        ],
        "refund_record": refund_rec.model_dump(mode="json") if refund_rec else None,
    }
