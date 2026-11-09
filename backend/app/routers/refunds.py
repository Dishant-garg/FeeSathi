from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.config import REFERENCE_DATE
from app.database import get_session
from app.models import RefundRecord, Student, User
from app.schemas import RefundCalcRequest
from app.services.auth_service import require_roles
from app.services.refund_service import (
    RefundError,
    calculate_pro_rata_refund,
    issue_pro_rata_refund,
)

router = APIRouter()


@router.post("/accounts/refunds/calculate")
def preview_pro_rata_refund(
    req: RefundCalcRequest,
    current_user: User = Depends(require_roles("ACCOUNTS", "COUNSELLOR")),
    session: Session = Depends(get_session),
):
    try:
        return calculate_pro_rata_refund(
            session=session,
            student_id=req.student_id,
            exit_date=req.exit_date,
            request_date=req.request_date or REFERENCE_DATE,
        )
    except RefundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/accounts/refunds/issue")
def approve_and_issue_refund(
    req: RefundCalcRequest,
    current_user: User = Depends(require_roles("ACCOUNTS")),
    session: Session = Depends(get_session),
):
    try:
        rec = issue_pro_rata_refund(
            session=session,
            student_id=req.student_id,
            exit_date=req.exit_date,
            request_date=req.request_date or REFERENCE_DATE,
        )
        return rec.model_dump(mode="json")
    except RefundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/accounts/refunds")
def list_issued_refunds(
    current_user: User = Depends(require_roles("ACCOUNTS", "COUNSELLOR")),
    session: Session = Depends(get_session),
):
    records = session.exec(select(RefundRecord).order_by(RefundRecord.id.desc())).all()
    out = []
    for r in records:
        student = session.get(Student, r.student_id)
        days_remaining = (r.sla_deadline_date - REFERENCE_DATE).days
        out.append(
            {
                **r.model_dump(mode="json"),
                "student_name": student.name if student else r.student_id,
                "batch": student.batch if student else "",
                "sla_days_remaining": days_remaining,
            }
        )
    return {"refunds": out}
