import pytest
from datetime import date, datetime, timezone
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool

from app.models import Instalment, PaymentRecord, Student
from app.services.receipt_service import (
    allocate_next_receipt_no,
    build_gst_receipt_payload,
    compute_gst_split,
)


def get_test_session() -> Session:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def test_compute_gst_split_exact_sum():
    # Test standard amounts: 30,000 and 40,000 and 15,000
    for amt in [30000, 40000, 15000, 105000, 120000]:
        base, cgst, sgst = compute_gst_split(amt)
        assert round(base + cgst + sgst, 2) == float(amt)
        assert cgst == round(base * 0.09, 2)

    # 30,000 specific values
    b, c, s = compute_gst_split(30000)
    assert b == 25423.73
    assert c == 2288.14
    assert s == 2288.13


def test_compute_gst_split_invalid_amount():
    with pytest.raises(ValueError):
        compute_gst_split(0)
    with pytest.raises(ValueError):
        compute_gst_split(-500)


def test_allocate_next_receipt_no_sequential():
    with get_test_session() as session:
        r1 = allocate_next_receipt_no(session)
        r2 = allocate_next_receipt_no(session)
        r3 = allocate_next_receipt_no(session)
        assert r1 == "JPR-2627-0001"
        assert r2 == "JPR-2627-0002"
        assert r3 == "JPR-2627-0003"


def test_build_gst_receipt_payload():
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
    instalment = Instalment(
        id=1,
        student_id="STU-0412",
        instalment_no=3,
        due_date=date(2026, 10, 10),
        amount_due=30000,
        amount_paid=30000,
        status="PAID",
    )
    payment = PaymentRecord(
        id=1,
        instalment_id=1,
        student_id="STU-0412",
        amount=30000,
        base_amount=25423.73,
        cgst_amount=2288.14,
        sgst_amount=2288.13,
        gst_receipt_no="JPR-2627-0001",
        idempotency_key="pay-001",
        created_at=datetime(2026, 10, 10, 14, 0, tzinfo=timezone.utc),
    )

    payload = build_gst_receipt_payload(payment, student, instalment)
    assert payload["receipt_no"] == "JPR-2627-0001"
    assert payload["place_of_supply"] == "08 - Rajasthan (Intra-State)"
    assert payload["sac_code"] == "999293 (Commercial Coaching & Training Services)"
    assert payload["tax_breakdown"]["total_paid_inr"] == 30000
    assert payload["tax_breakdown"]["taxable_base_inr"] == 25423.73
    assert payload["instalment_summary"]["remaining_balance_inr"] == 0
    assert "IST" in payload["issued_at"]
