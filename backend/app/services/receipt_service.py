from datetime import datetime, timedelta, timezone
from typing import Dict, Any
from sqlmodel import Session, select
from app.config import FINANCIAL_YEAR_CODE, INSTITUTE_GSTIN, INSTITUTE_NAME
from app.models import Instalment, PaymentRecord, ReceiptCounter, Student

# India Standard Time (UTC+05:30)
IST = timezone(timedelta(hours=5, minutes=30))


def compute_gst_split(total_amount: int) -> tuple[float, float, float]:
    """
    Computes 18% inclusive GST split (9% CGST + 9% SGST for intra-state Rajasthan).
    Guarantees base + cgst + sgst == total_amount to the exact paisa.
    """
    if total_amount <= 0:
        raise ValueError("Amount must be greater than zero for GST computation")

    base = round(total_amount / 1.18, 2)
    cgst = round(base * 0.09, 2)
    sgst = round(total_amount - base - cgst, 2)
    return base, cgst, sgst


def allocate_next_receipt_no(session: Session) -> str:
    """
    Allocates a gapless sequential GST receipt number inside the active DB transaction.
    """
    counter = session.exec(
        select(ReceiptCounter).where(ReceiptCounter.financial_year == FINANCIAL_YEAR_CODE)
    ).first()
    if counter is None:
        counter = ReceiptCounter(financial_year=FINANCIAL_YEAR_CODE, last_seq=0)
        session.add(counter)
        session.flush()

    counter.last_seq += 1
    session.add(counter)
    session.flush()
    return f"JPR-{FINANCIAL_YEAR_CODE}-{counter.last_seq:04d}"


def build_gst_receipt_payload(
    payment: PaymentRecord, student: Student, instalment: Instalment
) -> Dict[str, Any]:
    """
    Generates a structured, printable GST Tax Invoice payload for the Parent & Accounts UI.
    """
    remaining_balance = max(0, instalment.amount_due - instalment.amount_paid)

    # Ensure correct local IST time conversion
    issued_dt = payment.created_at.astimezone(IST) if payment.created_at.tzinfo else payment.created_at
    issued_at_str = issued_dt.strftime("%Y-%m-%d %I:%M %p IST")

    return {
        "receipt_no": payment.gst_receipt_no,
        "institute_name": INSTITUTE_NAME,
        "gstin": INSTITUTE_GSTIN,
        "place_of_supply": "08 - Rajasthan (Intra-State)",
        "sac_code": "999293 (Commercial Coaching & Training Services)",
        "issued_at": issued_at_str,
        "student_id": student.id,
        "student_name": student.name,
        "centre": student.centre,
        "batch": student.batch,
        "instalment_no": instalment.instalment_no,
        "instalment_due_date": instalment.due_date.isoformat(),
        "payment_mode": payment.payment_mode,
        "idempotency_key": payment.idempotency_key,
        "tax_breakdown": {
            "taxable_base_inr": payment.base_amount,
            "cgst_rate_pct": 9.0,
            "cgst_amount_inr": payment.cgst_amount,
            "sgst_rate_pct": 9.0,
            "sgst_amount_inr": payment.sgst_amount,
            "total_paid_inr": payment.amount,
        },
        "instalment_summary": {
            "instalment_total_inr": instalment.amount_due,
            "cumulative_paid_inr": instalment.amount_paid,
            "remaining_balance_inr": remaining_balance,
            "status": instalment.status,
        },
    }
