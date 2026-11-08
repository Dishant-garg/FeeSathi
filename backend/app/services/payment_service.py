import hashlib
import hmac
from datetime import date, datetime, timezone
from typing import Optional, Tuple
from sqlmodel import Session, select
from app.config import REFERENCE_DATE, WEBHOOK_SECRET
from app.models import (
    Instalment,
    PaymentRecord,
    ReminderLog,
    Student,
    UnmatchedPayment,
)
from app.services.receipt_service import allocate_next_receipt_no, compute_gst_split


class PaymentError(ValueError):
    """Domain error raised for invalid payment operations."""


def compute_instalment_status(
    amount_due: int, amount_paid: int, due_date: date, as_of: date = REFERENCE_DATE
) -> str:
    if amount_paid >= amount_due:
        return "PAID"
    if amount_paid > 0:
        return "PART_PAID_OVERDUE" if due_date < as_of else "PART_PAID"
    return "OVERDUE" if due_date < as_of else "UPCOMING"


def process_instalment_payment(
    session: Session,
    instalment_id: int,
    amount: int,
    idempotency_key: str,
    payment_mode: str = "UPI",
    as_of: date = REFERENCE_DATE,
) -> Tuple[Instalment, PaymentRecord, bool]:
    """
    Processes a full or partial instalment payment inside a single ACID transaction:
    1. Enforces idempotency on `idempotency_key` (returns existing record if already processed).
    2. Validates student is ACTIVE and amount is within [1, remaining_balance].
    3. Allocates a gapless GST receipt number and exact-sum 18% GST split.
    4. Updates instalment status; if PAID, triggers the reminder kill-switch atomically.

    Returns: (instalment, payment_record, was_idempotent_replay)
    """
    if not idempotency_key or not idempotency_key.strip():
        raise PaymentError("idempotency_key is required")

    # 1. Idempotency check
    existing_payment = session.exec(
        select(PaymentRecord).where(PaymentRecord.idempotency_key == idempotency_key)
    ).first()
    if existing_payment is not None:
        inst = session.get(Instalment, existing_payment.instalment_id)
        if inst is None:
            raise PaymentError("Instalment for existing payment not found")
        return inst, existing_payment, True

    # 2. Fetch & validate Instalment and Student
    instalment = session.get(Instalment, instalment_id)
    if instalment is None:
        raise PaymentError(f"Instalment {instalment_id} not found")

    student = session.get(Student, instalment.student_id)
    if student is None:
        raise PaymentError(f"Student {instalment.student_id} not found")
    if student.status == "WITHDRAWN":
        raise PaymentError("Cannot process payment for a WITHDRAWN student")

    if amount <= 0:
        raise PaymentError("Payment amount must be greater than zero")

    remaining_balance = instalment.amount_due - instalment.amount_paid
    if remaining_balance <= 0 or instalment.status == "PAID":
        raise PaymentError("Instalment is already fully paid")

    if amount > remaining_balance:
        raise PaymentError(
            f"Overpayment rejected: attempted ₹{amount}, but remaining balance is ₹{remaining_balance}"
        )

    # 3. Compute exact GST split & allocate sequential receipt number
    base_amt, cgst_amt, sgst_amt = compute_gst_split(amount)
    receipt_no = allocate_next_receipt_no(session)
    now_ts = datetime.now(timezone.utc)

    # 4. Update Instalment state
    instalment.amount_paid += amount
    instalment.status = compute_instalment_status(
        instalment.amount_due, instalment.amount_paid, instalment.due_date, as_of=as_of
    )
    instalment.paid_at = now_ts
    instalment.latest_receipt_no = receipt_no
    session.add(instalment)

    # 5. Create immutable PaymentRecord
    payment_record = PaymentRecord(
        instalment_id=instalment.id,
        student_id=instalment.student_id,
        amount=amount,
        base_amount=base_amt,
        cgst_amount=cgst_amt,
        sgst_amount=sgst_amt,
        gst_receipt_no=receipt_no,
        idempotency_key=idempotency_key,
        payment_mode=payment_mode,
        created_at=now_ts,
    )
    session.add(payment_record)

    # 6. Atomic Kill-Switch: Stop all scheduled reminders if instalment is now fully PAID
    if instalment.status == "PAID":
        scheduled_reminders = session.exec(
            select(ReminderLog).where(
                ReminderLog.instalment_id == instalment.id,
                ReminderLog.status == "SCHEDULED",
            )
        ).all()
        for rem in scheduled_reminders:
            rem.status = "STOPPED_ON_PAYMENT"
            rem.stopped_reason = f"Automatically stopped upon full payment receipt {receipt_no}"
            rem.updated_at = now_ts
            session.add(rem)

    session.commit()
    session.refresh(instalment)
    session.refresh(payment_record)
    return instalment, payment_record, False


def verify_webhook_signature(raw_body: bytes, signature: str, secret: str = WEBHOOK_SECRET) -> bool:
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def ingest_bank_transfer_webhook(
    session: Session,
    utr_reference: str,
    amount: int,
    payer_phone: str,
    raw_narration: str,
    student_id_hint: Optional[str] = None,
    instalment_id_hint: Optional[int] = None,
) -> dict:
    """
    Processes an incoming NEFT/UPI bank webhook.
    Guardrail from brief: "Unmatched payments go to an accounts queue instead of marking anything paid."
    - Deduplicates on `utr_reference`.
    - Only auto-marks paid when an unambiguous student + open instalment with exact remaining balance matches.
    - Otherwise queues in `UnmatchedPayment(status="QUEUED")`.
    """
    if amount <= 0:
        raise PaymentError("Webhook amount must be positive")

    # Idempotency on UTR reference
    existing_queued = session.exec(
        select(UnmatchedPayment).where(UnmatchedPayment.utr_reference == utr_reference)
    ).first()
    if existing_queued is not None:
        return {"outcome": "DUPLICATE_UTR_IGNORED", "unmatched_id": existing_queued.id}

    existing_pay = session.exec(
        select(PaymentRecord).where(PaymentRecord.idempotency_key == f"utr-{utr_reference}")
    ).first()
    if existing_pay is not None:
        return {"outcome": "DUPLICATE_UTR_ALREADY_PAID", "receipt_no": existing_pay.gst_receipt_no}

    # Attempt unambiguous match only if explicit student_id and instalment_id hints are valid
    if student_id_hint and instalment_id_hint:
        inst = session.get(Instalment, instalment_id_hint)
        if (
            inst is not None
            and inst.student_id == student_id_hint
            and inst.status != "PAID"
            and (inst.amount_due - inst.amount_paid) == amount
        ):
            inst, pay_rec, _ = process_instalment_payment(
                session=session,
                instalment_id=inst.id,
                amount=amount,
                idempotency_key=f"utr-{utr_reference}",
                payment_mode="NEFT_RECONCILED",
            )
            return {
                "outcome": "AUTO_MATCHED",
                "student_id": inst.student_id,
                "instalment_id": inst.id,
                "receipt_no": pay_rec.gst_receipt_no,
            }

    # Determine specific reason for queuing
    students_by_phone = session.exec(
        select(Student).where(Student.parent_phone == payer_phone)
    ).all()
    if not students_by_phone:
        reason = "UNKNOWN_PHONE_OR_STUDENT"
    elif not instalment_id_hint:
        reason = "MISSING_INSTALMENT_REFERENCE"
    else:
        reason = "AMOUNT_OR_INSTALMENT_MISMATCH"

    queued = UnmatchedPayment(
        utr_reference=utr_reference,
        amount=amount,
        payer_phone=payer_phone,
        raw_narration=raw_narration,
        mismatch_reason=reason,
        status="QUEUED",
    )
    session.add(queued)
    session.commit()
    session.refresh(queued)
    return {"outcome": "QUEUED_FOR_ACCOUNTS", "unmatched_id": queued.id, "reason": reason}


def reconcile_unmatched_payment(
    session: Session,
    unmatched_id: int,
    target_instalment_id: int,
) -> Tuple[UnmatchedPayment, Instalment, PaymentRecord]:
    """
    Allows an Accounts Executive to manually assign a queued bank transfer to a student's instalment.
    """
    unmatched = session.get(UnmatchedPayment, unmatched_id)
    if unmatched is None:
        raise PaymentError("Unmatched payment record not found")
    if unmatched.status == "MATCHED":
        raise PaymentError("This bank transfer has already been matched")

    inst, pay_rec, _ = process_instalment_payment(
        session=session,
        instalment_id=target_instalment_id,
        amount=unmatched.amount,
        idempotency_key=f"reconcile-utr-{unmatched.utr_reference}",
        payment_mode="NEFT_RECONCILED",
    )

    unmatched.status = "MATCHED"
    unmatched.matched_student_id = inst.student_id
    unmatched.matched_instalment_id = inst.id
    session.add(unmatched)
    session.commit()
    session.refresh(unmatched)
    return unmatched, inst, pay_rec
