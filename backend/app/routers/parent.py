from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.config import REFERENCE_DATE
from app.database import get_session
from app.models import Instalment, PaymentRecord, Student, User
from app.schemas import PaymentRequest
from app.services.ai_risk_service import sync_all_counsellor_tasks
from app.services.auth_service import get_current_user, verify_student_object_access
from app.services.payment_service import PaymentError, process_instalment_payment
from app.services.receipt_service import build_gst_receipt_payload
from app.utils.serializers import build_student_ledger_payload, serialize_instalment

router = APIRouter()


@router.get("/parent/portal")
def get_parent_portal(
    student_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    target_id = student_id or current_user.student_id
    if not target_id:
        raise HTTPException(status_code=400, detail="student_id is required")

    verify_student_object_access(current_user, target_id)

    student = session.get(Student, target_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")

    return build_student_ledger_payload(session, student, as_of=REFERENCE_DATE)


@router.post("/instalments/{instalment_id}/pay")
def pay_instalment(
    instalment_id: int,
    req: PaymentRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    instalment = session.get(Instalment, instalment_id)
    if instalment is None:
        raise HTTPException(status_code=404, detail="Instalment not found")

    # Enforce Object-Level Authorization (BOLA) before processing payment
    verify_student_object_access(current_user, instalment.student_id)

    try:
        updated_inst, pay_rec, was_replay = process_instalment_payment(
            session=session,
            instalment_id=instalment_id,
            amount=req.amount,
            idempotency_key=req.idempotency_key,
            payment_mode=req.payment_mode,
            as_of=REFERENCE_DATE,
        )
    except PaymentError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Post-commit AI risk scoring: isolated outside financial transaction
    try:
        sync_all_counsellor_tasks(session, as_of=REFERENCE_DATE)
    except Exception:
        pass

    student = session.get(Student, updated_inst.student_id)
    invoice = build_gst_receipt_payload(pay_rec, student, updated_inst)

    return {
        "was_idempotent_replay": was_replay,
        "instalment": serialize_instalment(updated_inst, as_of=REFERENCE_DATE),
        "gst_invoice": invoice,
    }


@router.get("/receipts/{receipt_no}")
def get_gst_receipt(
    receipt_no: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    payment = session.exec(
        select(PaymentRecord).where(PaymentRecord.gst_receipt_no == receipt_no)
    ).first()
    if payment is None:
        raise HTTPException(status_code=404, detail="Receipt not found")

    verify_student_object_access(current_user, payment.student_id)

    student = session.get(Student, payment.student_id)
    instalment = session.get(Instalment, payment.instalment_id)
    return build_gst_receipt_payload(payment, student, instalment)
