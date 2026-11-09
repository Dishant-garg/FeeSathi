from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.config import DEMO_MODE, REFERENCE_DATE
from app.database import get_session
from app.models import User
from app.schemas import DemoSwitchRequest, OTPVerifyRequest
from app.seed import seed_database
from app.services.ai_risk_service import sync_all_counsellor_tasks
from app.services.auth_service import (
    AuthError,
    DPDPConsentRequiredError,
    get_current_user,
    issue_demo_switch_token,
    verify_otp_and_login,
)

router = APIRouter()


@router.post("/auth/login")
def login_with_otp(req: OTPVerifyRequest, session: Session = Depends(get_session)):
    try:
        user, token = verify_otp_and_login(
            session=session,
            phone=req.phone,
            otp=req.otp,
            dpdp_consent=req.dpdp_consent,
            preferred_lang=req.preferred_lang,
        )
    except DPDPConsentRequiredError as exc:
        raise HTTPException(status_code=403, detail="DPDP_CONSENT_REQUIRED") from exc
    except AuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "phone": user.phone,
            "name": user.name,
            "role": user.role,
            "student_id": user.student_id,
            "preferred_lang": user.preferred_lang,
            "dpdp_consent_given": user.dpdp_consent_given,
        },
    }


@router.post("/auth/demo-switch")
def demo_switch_user(req: DemoSwitchRequest, session: Session = Depends(get_session)):
    try:
        user, token = issue_demo_switch_token(session=session, target_phone=req.phone)
    except AuthError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    return {
        "access_token": token,
        "token_type": "bearer",
        "demo_mode": DEMO_MODE,
        "user": {
            "id": user.id,
            "phone": user.phone,
            "name": user.name,
            "role": user.role,
            "student_id": user.student_id,
            "preferred_lang": user.preferred_lang,
            "dpdp_consent_given": user.dpdp_consent_given,
        },
    }


@router.get("/auth/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "phone": current_user.phone,
        "name": current_user.name,
        "role": current_user.role,
        "student_id": current_user.student_id,
        "preferred_lang": current_user.preferred_lang,
        "dpdp_consent_given": current_user.dpdp_consent_given,
    }


@router.post("/demo/reset")
def reset_demo_database(session: Session = Depends(get_session)):
    if not DEMO_MODE:
        raise HTTPException(status_code=403, detail="Reset disabled when DEMO_MODE=false")
    seed_database(session, force_reset=True)
    sync_all_counsellor_tasks(session, as_of=REFERENCE_DATE)
    return {"status": "reset_complete", "reference_date": REFERENCE_DATE.isoformat()}
