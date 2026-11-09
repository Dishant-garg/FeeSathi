from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.config import REFERENCE_DATE
from app.database import get_session
from app.models import Instalment, ReminderLog, Student, User
from app.services.auth_service import require_roles
from app.services.reminder_service import dispatch_due_reminders

router = APIRouter()


@router.get("/accounts/reminders")
def list_reminders(
    status_filter: Optional[str] = Query(default=None),
    current_user: User = Depends(require_roles("ACCOUNTS", "COUNSELLOR")),
    session: Session = Depends(get_session),
):
    reminders = session.exec(
        select(ReminderLog).order_by(ReminderLog.scheduled_date.desc(), ReminderLog.id.desc())
    ).all()
    if status_filter and status_filter != "ALL":
        reminders = [r for r in reminders if r.status == status_filter]

    items = []
    for r in reminders:
        student = session.get(Student, r.student_id)
        inst = session.get(Instalment, r.instalment_id)
        items.append(
            {
                "id": r.id,
                "student_id": r.student_id,
                "student_name": student.name if student else r.student_id,
                "batch": student.batch if student else "",
                "centre": student.centre if student else "",
                "instalment_id": r.instalment_id,
                "instalment_no": inst.instalment_no if inst else 0,
                "trigger_type": r.trigger_type,
                "scheduled_date": r.scheduled_date.isoformat(),
                "message_en": r.message_en,
                "message_hi": r.message_hi,
                "status": r.status,
                "stopped_reason": r.stopped_reason,
                "updated_at": r.updated_at.isoformat(),
            }
        )
    return {"reminders": items}


@router.post("/accounts/reminders/dispatch")
def trigger_due_reminders_now(
    as_of_date: Optional[date] = None,
    current_user: User = Depends(require_roles("ACCOUNTS")),
    session: Session = Depends(get_session),
):
    target_date = as_of_date or REFERENCE_DATE
    return dispatch_due_reminders(session, as_of_date=target_date)
