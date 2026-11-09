import json
from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.config import REFERENCE_DATE
from app.database import get_session
from app.models import Student, User
from app.schemas import BulkUploadRequest
from app.services.ai_risk_service import sync_all_counsellor_tasks
from app.services.auth_service import require_roles

router = APIRouter()


@router.post("/accounts/bulk-upload")
def bulk_upload_attendance_and_tests(
    req: BulkUploadRequest,
    current_user: User = Depends(require_roles("ACCOUNTS", "COUNSELLOR")),
    session: Session = Depends(get_session),
):
    updated_ids = []
    for row in req.records:
        student = session.get(Student, row.student_id)
        if student is None:
            continue
        student.attendance_pct = row.attendance_pct
        student.test_scores_json = json.dumps(row.test_scores)
        session.add(student)
        updated_ids.append(student.id)

    session.commit()
    assessments = sync_all_counsellor_tasks(session, as_of=REFERENCE_DATE)
    return {
        "updated_count": len(updated_ids),
        "updated_student_ids": updated_ids,
        "assessments": assessments,
    }
