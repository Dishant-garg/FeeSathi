import json
from datetime import date, datetime, timezone
from typing import List, Optional
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    phone: str = Field(index=True, unique=True)
    name: str
    role: str  # "PARENT", "ACCOUNTS", "COUNSELLOR"
    student_id: Optional[str] = Field(default=None, foreign_key="student.id", index=True)
    preferred_lang: str = Field(default="en")  # "en" or "hi"
    dpdp_consent_given: bool = Field(default=False)
    dpdp_consent_timestamp: Optional[datetime] = None


class Student(SQLModel, table=True):
    id: str = Field(primary_key=True)  # e.g., "STU-0412"
    name: str
    centre: str = Field(index=True)
    batch: str = Field(index=True)
    parent_phone: str
    course_start_date: date
    course_end_date: date
    gross_annual_fee: int = 120000
    scholarship_discount: int = 0
    net_annual_fee: int = 120000
    attendance_pct: float = 90.0
    test_scores_json: str = Field(default="[]")
    status: str = Field(default="ACTIVE")
    ai_dismissed: bool = Field(default=False)
    ai_dismissed_at_score: Optional[int] = None
    ai_dismissed_by_user_id: Optional[int] = None
    ai_dismiss_reason: Optional[str] = None
    ai_dismiss_notes: Optional[str] = None
    ai_dismissed_at: Optional[datetime] = None

    @property
    def test_scores(self) -> List[float]:
        try:
            return [float(x) for x in json.loads(self.test_scores_json)]
        except Exception:
            return []


class Instalment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    student_id: str = Field(foreign_key="student.id", index=True)
    instalment_no: int
    due_date: date
    amount_due: int
    amount_paid: int = 0
    status: str = Field(index=True)  # "PAID", "PART_PAID", "OVERDUE", etc.
    paid_at: Optional[datetime] = None
    latest_receipt_no: Optional[str] = None


class PaymentRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    instalment_id: int = Field(foreign_key="instalment.id", index=True)
    student_id: str = Field(foreign_key="student.id", index=True)
    amount: int
    base_amount: float
    cgst_amount: float
    sgst_amount: float
    gst_receipt_no: str = Field(unique=True, index=True)
    idempotency_key: str = Field(unique=True, index=True)
    payment_mode: str = Field(default="UPI")
    created_at: datetime = Field(default_factory=utc_now)


class ReceiptCounter(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    financial_year: str = Field(unique=True, index=True)  # e.g., "2627"
    last_seq: int = Field(default=0)


class ReminderLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    instalment_id: int = Field(foreign_key="instalment.id", index=True)
    student_id: str = Field(foreign_key="student.id", index=True)
    trigger_type: str  # "BEFORE_7_DAYS", "ON_DUE_DATE", "AFTER_7_DAYS"
    scheduled_date: date
    message_en: str
    message_hi: str
    status: str = Field(index=True)  # "SENT", "SCHEDULED", "STOPPED_ON_PAYMENT", etc.
    stopped_reason: Optional[str] = None
    updated_at: datetime = Field(default_factory=utc_now)


class UnmatchedPayment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    utr_reference: str = Field(unique=True, index=True)
    amount: int
    payer_phone: str
    raw_narration: str
    mismatch_reason: str
    received_at: datetime = Field(default_factory=utc_now)
    status: str = Field(default="QUEUED")
    matched_student_id: Optional[str] = Field(default=None, foreign_key="student.id")
    matched_instalment_id: Optional[int] = Field(default=None, foreign_key="instalment.id")


class RefundRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    student_id: str = Field(foreign_key="student.id", unique=True, index=True)
    request_date: date
    exit_date: date
    sla_deadline_date: date  # request_date + 10 days
    days_attended: int
    gross_fee: int
    discount: int
    net_fee: int
    non_refundable_reg_fee: int
    total_paid_to_date: int
    pro_rata_fee_utilized: int
    refundable_amount: int
    shortfall_receivable: int = 0
    gst_credit_note_no: Optional[str] = None
    status: str = Field(default="PENDING_PAYOUT")
    created_at: datetime = Field(default_factory=utc_now)


class CounsellorTask(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    student_id: str = Field(foreign_key="student.id", index=True)
    risk_score: int
    risk_level: str  # "HIGH", "UNSURE_BORDERLINE", "RESURFACED_HIGH_RISK"
    confidence: str  # "HIGH", "LOW_SPARSE_DATA"
    status: str = Field(default="OPEN")
    dismiss_reason: Optional[str] = None
    counsellor_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
