import hmac
import hashlib
import pytest
from datetime import date
from sqlmodel import SQLModel, Session, create_engine, select
from sqlmodel.pool import StaticPool

from app.config import REFERENCE_DATE, WEBHOOK_SECRET
from app.models import (
    Instalment,
    PaymentRecord,
    ReminderLog,
    Student,
    UnmatchedPayment,
)
from app.services.payment_service import (
    PaymentError,
    compute_instalment_status,
    ingest_bank_transfer_webhook,
    process_instalment_payment,
    reconcile_unmatched_payment,
    verify_webhook_signature,
)


def get_test_session() -> Session:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def test_compute_instalment_status():
    as_of = date(2026, 11, 2)
    past_due = date(2026, 10, 10)
    future_due = date(2026, 11, 15)

    # Full paid
    assert compute_instalment_status(30000, 30000, past_due, as_of) == "PAID"
    assert compute_instalment_status(30000, 30000, future_due, as_of) == "PAID"

    # Part paid
    assert compute_instalment_status(30000, 15000, past_due, as_of) == "PART_PAID_OVERDUE"
    assert compute_instalment_status(30000, 15000, future_due, as_of) == "PART_PAID"

    # Zero paid
    assert compute_instalment_status(30000, 0, past_due, as_of) == "OVERDUE"
    assert compute_instalment_status(30000, 0, future_due, as_of) == "UPCOMING"


def test_process_instalment_payment_lifecycle_and_idempotency():
    with get_test_session() as session:
        # Create student and instalment
        student = Student(
            id="STU-001",
            name="Test Student",
            centre="Tonk Road",
            batch="JEE 2027",
            parent_phone="9829000001",
            course_start_date=date(2026, 4, 1),
            course_end_date=date(2027, 1, 25),
        )
        session.add(student)

        instalment = Instalment(
            id=1,
            student_id="STU-001",
            instalment_no=1,
            due_date=date(2026, 10, 10),
            amount_due=30000,
            amount_paid=0,
            status="OVERDUE",
        )
        session.add(instalment)

        reminder = ReminderLog(
            id=1,
            instalment_id=1,
            student_id="STU-001",
            trigger_type="AFTER_7_DAYS",
            scheduled_date=date(2026, 10, 17),
            message_en="Pay now",
            message_hi="Bhugtan karein",
            status="SCHEDULED",
        )
        session.add(reminder)
        session.commit()

        # 1. Partial payment of 15,000
        inst, pay_rec, is_replay = process_instalment_payment(
            session=session,
            instalment_id=1,
            amount=15000,
            idempotency_key="pay-part-1",
        )
        assert not is_replay
        assert inst.amount_paid == 15000
        assert inst.status == "PART_PAID_OVERDUE"
        assert pay_rec.amount == 15000
        assert pay_rec.gst_receipt_no.startswith("JPR-2627-")

        # Reminder should still be SCHEDULED because not fully paid
        rem_check = session.get(ReminderLog, 1)
        assert rem_check.status == "SCHEDULED"

        # 2. Idempotent replay with same key
        inst_replay, pay_replay, is_replay_2 = process_instalment_payment(
            session=session,
            instalment_id=1,
            amount=15000,
            idempotency_key="pay-part-1",
        )
        assert is_replay_2 is True
        assert pay_replay.id == pay_rec.id

        # 3. Overpayment rejection
        with pytest.raises(PaymentError, match="Overpayment rejected"):
            process_instalment_payment(
                session=session,
                instalment_id=1,
                amount=20000,  # Only 15,000 remains
                idempotency_key="pay-excess",
            )

        # 4. Final clearing payment of 15,000 -> triggers Reminder Kill-Switch
        inst_final, pay_final, _ = process_instalment_payment(
            session=session,
            instalment_id=1,
            amount=15000,
            idempotency_key="pay-part-2",
        )
        assert inst_final.status == "PAID"
        assert inst_final.amount_paid == 30000

        # Verify Reminder is STOPPED_ON_PAYMENT
        session.refresh(rem_check)
        assert rem_check.status == "STOPPED_ON_PAYMENT"
        assert "Automatically stopped" in rem_check.stopped_reason


def test_verify_webhook_signature():
    secret = "test-secret-key-123"
    body = b'{"event": "payment.captured", "amount": 30000}'
    valid_sig = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()

    assert verify_webhook_signature(body, valid_sig, secret=secret) is True
    assert verify_webhook_signature(body, "invalid_signature", secret=secret) is False
    assert verify_webhook_signature(b'altered body', valid_sig, secret=secret) is False


def test_unmatched_payment_queue_and_reconciliation():
    with get_test_session() as session:
        # Setup student with overdue instalment
        student = Student(
            id="STU-002",
            name="Rahul Sharma",
            centre="Vaishali Nagar",
            batch="JEE 2027",
            parent_phone="9829000002",
            course_start_date=date(2026, 4, 1),
            course_end_date=date(2027, 1, 25),
        )
        session.add(student)

        instalment = Instalment(
            id=10,
            student_id="STU-002",
            instalment_no=1,
            due_date=date(2026, 10, 10),
            amount_due=30000,
            amount_paid=0,
            status="OVERDUE",
        )
        session.add(instalment)
        session.commit()

        # Ingest ambiguous bank transfer (phone unknown)
        res = ingest_bank_transfer_webhook(
            session=session,
            utr_reference="UTR-UNKNOWN-001",
            amount=30000,
            payer_phone="9999999999",
            raw_narration="NEFT/UNKNOWN/FEE",
        )
        assert res["outcome"] == "QUEUED_FOR_ACCOUNTS"
        assert res["reason"] == "UNKNOWN_PHONE_OR_STUDENT"
        unmatched_id = res["unmatched_id"]

        # Duplicate UTR test
        res_dup = ingest_bank_transfer_webhook(
            session=session,
            utr_reference="UTR-UNKNOWN-001",
            amount=30000,
            payer_phone="9999999999",
            raw_narration="NEFT/UNKNOWN/FEE",
        )
        assert res_dup["outcome"] == "DUPLICATE_UTR_IGNORED"

        # Accounts Executive matches to instalment 10
        unmatched, inst, pay_rec = reconcile_unmatched_payment(
            session=session,
            unmatched_id=unmatched_id,
            target_instalment_id=10,
        )
        assert unmatched.status == "MATCHED"
        assert unmatched.matched_student_id == "STU-002"
        assert inst.status == "PAID"
        assert inst.amount_paid == 30000
        assert pay_rec.payment_mode == "NEFT_RECONCILED"
