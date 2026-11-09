from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlmodel import Session, select

from app.config import DEMO_MODE, REFERENCE_DATE
from app.database import get_session
from app.models import Instalment, Student, UnmatchedPayment, User
from app.schemas import BankWebhookRequest, ReconcilePaymentRequest
from app.services.ai_risk_service import sync_all_counsellor_tasks
from app.services.auth_service import require_roles
from app.services.payment_service import (
    PaymentError,
    ingest_bank_transfer_webhook,
    reconcile_unmatched_payment,
    verify_webhook_signature,
)
from app.utils.serializers import serialize_instalment

router = APIRouter()


@router.post("/webhooks/bank-transfer")
async def bank_transfer_webhook(
    request: Request,
    payload: BankWebhookRequest,
    x_webhook_signature: Optional[str] = Header(default=None),
    session: Session = Depends(get_session),
):
    raw_body = await request.body()
    if not DEMO_MODE:
        if not x_webhook_signature or not verify_webhook_signature(raw_body, x_webhook_signature):
            raise HTTPException(status_code=401, detail="Invalid webhook HMAC signature")

    try:
        return ingest_bank_transfer_webhook(
            session=session,
            utr_reference=payload.utr_reference,
            amount=payload.amount,
            payer_phone=payload.payer_phone,
            raw_narration=payload.raw_narration,
            student_id_hint=payload.student_id_hint,
            instalment_id_hint=payload.instalment_id_hint,
        )
    except PaymentError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/accounts/unmatched")
def list_unmatched_payments(
    current_user: User = Depends(require_roles("ACCOUNTS")),
    session: Session = Depends(get_session),
):
    rows = session.exec(
        select(UnmatchedPayment).order_by(UnmatchedPayment.id.desc())
    ).all()
    open_instalments = session.exec(
        select(Instalment).where(
            Instalment.status != "PAID",
            Instalment.status != "CANCELLED_WITHDRAWN",
        )
    ).all()
    candidate_targets = []
    for inst in open_instalments:
        st = session.get(Student, inst.student_id)
        candidate_targets.append(
            {
                "instalment_id": inst.id,
                "student_id": inst.student_id,
                "student_name": st.name if st else inst.student_id,
                "instalment_no": inst.instalment_no,
                "remaining_balance": inst.amount_due - inst.amount_paid,
                "due_date": inst.due_date.isoformat(),
            }
        )
    return {
        "unmatched_payments": [r.model_dump(mode="json") for r in rows],
        "candidate_instalments": candidate_targets,
    }


@router.post("/accounts/unmatched/{unmatched_id}/reconcile")
def reconcile_unmatched_bank_transfer(
    unmatched_id: int,
    req: ReconcilePaymentRequest,
    current_user: User = Depends(require_roles("ACCOUNTS")),
    session: Session = Depends(get_session),
):
    try:
        unmatched, inst, pay_rec = reconcile_unmatched_payment(
            session=session,
            unmatched_id=unmatched_id,
            target_instalment_id=req.target_instalment_id,
        )
    except PaymentError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        sync_all_counsellor_tasks(session, as_of=REFERENCE_DATE)
    except Exception:
        pass

    return {
        "unmatched": unmatched.model_dump(mode="json"),
        "instalment": serialize_instalment(inst, as_of=REFERENCE_DATE),
        "receipt_no": pay_rec.gst_receipt_no,
    }
