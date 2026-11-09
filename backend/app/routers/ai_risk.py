from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.config import REFERENCE_DATE, VALID_DISMISS_REASONS
from app.database import get_session
from app.models import CounsellorTask, User
from app.schemas import CompleteCallRequest, DismissFlagRequest
from app.services.ai_risk_service import (
    AIRiskError,
    dismiss_false_flag,
    sync_all_counsellor_tasks,
)
from app.services.auth_service import require_roles

router = APIRouter()


@router.get("/accounts/ai-risk")
def get_ai_risk_queue(
    current_user: User = Depends(require_roles("ACCOUNTS", "COUNSELLOR")),
    session: Session = Depends(get_session),
):
    assessments = sync_all_counsellor_tasks(session, as_of=REFERENCE_DATE)
    return {
        "reference_date": REFERENCE_DATE.isoformat(),
        "valid_dismiss_reasons": sorted(VALID_DISMISS_REASONS),
        "assessments": assessments,
    }


@router.post("/accounts/ai-risk/{student_id}/dismiss")
def dismiss_student_ai_flag(
    student_id: str,
    req: DismissFlagRequest,
    current_user: User = Depends(require_roles("ACCOUNTS", "COUNSELLOR")),
    session: Session = Depends(get_session),
):
    try:
        return dismiss_false_flag(
            session=session,
            student_id=student_id,
            user_id=current_user.id,
            reason=req.reason,
            notes=req.notes,
            as_of=REFERENCE_DATE,
        )
    except AIRiskError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/accounts/ai-risk/{student_id}/complete-call")
def complete_counsellor_call_task(
    student_id: str,
    req: CompleteCallRequest,
    current_user: User = Depends(require_roles("ACCOUNTS", "COUNSELLOR")),
    session: Session = Depends(get_session),
):
    open_tasks = session.exec(
        select(CounsellorTask).where(
            CounsellorTask.student_id == student_id,
            CounsellorTask.status == "OPEN",
        )
    ).all()
    if not open_tasks:
        raise HTTPException(status_code=404, detail="No open counsellor task found for this student")

    now_ts = datetime.now(timezone.utc)
    for t in open_tasks:
        t.status = "COMPLETED"
        t.counsellor_notes = req.notes
        t.updated_at = now_ts
        session.add(t)
    session.commit()
    return {"status": "COMPLETED", "student_id": student_id, "notes": req.notes}
