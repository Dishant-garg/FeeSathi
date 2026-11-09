from datetime import date
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ============================================================================
# Authentication & Demo Switcher Schemas
# ============================================================================

class OTPVerifyRequest(BaseModel):
    phone: str
    otp: str = "123456"
    dpdp_consent: bool = False
    preferred_lang: Optional[str] = "en"


class DemoSwitchRequest(BaseModel):
    phone: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]


# ============================================================================
# Payment & Gateway Schemas
# ============================================================================

class PaymentRequest(BaseModel):
    amount: int = Field(..., gt=0)
    idempotency_key: str
    payment_mode: str = "UPI"


class BankWebhookRequest(BaseModel):
    utr_reference: str
    amount: int
    payer_phone: str
    raw_narration: str
    student_id_hint: Optional[str] = None
    instalment_id_hint: Optional[int] = None


class ReconcilePaymentRequest(BaseModel):
    target_instalment_id: int


# ============================================================================
# Refund Schemas (MoE 2024 Guidelines)
# ============================================================================

class RefundCalcRequest(BaseModel):
    student_id: str
    exit_date: date
    request_date: Optional[date] = None


class RefundIssueRequest(BaseModel):
    exit_date: date
    request_date: Optional[date] = None
    reason: Optional[str] = "Student withdrawal"


# ============================================================================
# Counsellor & AI Dropout Risk Schemas
# ============================================================================

class DismissFlagRequest(BaseModel):
    reason: str
    notes: Optional[str] = None


class CompleteCallRequest(BaseModel):
    notes: str


# ============================================================================
# Bulk Academic Data Upload Schemas
# ============================================================================

class BulkAcademicRow(BaseModel):
    student_id: str
    attendance_pct: float = Field(..., ge=0.0, le=100.0)
    test_scores: List[float]


class BulkUploadRequest(BaseModel):
    records: List[BulkAcademicRow]
