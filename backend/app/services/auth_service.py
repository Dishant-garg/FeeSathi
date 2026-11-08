from datetime import datetime, timedelta, timezone
from typing import Callable, Optional
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session, select
from app.config import DEMO_MODE, JWT_ALGORITHM, JWT_EXPIRE_MINUTES, JWT_SECRET
from app.database import get_session
from app.models import User

MOCK_VALID_OTP = "123456"
security_scheme = HTTPBearer(auto_error=False)


class AuthError(ValueError):
    """Domain error raised for authentication failures."""


class DPDPConsentRequiredError(AuthError):
    """Raised when a parent user has not yet consented under DPDP Act 2023."""


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {
        "sub": str(user.id),
        "phone": user.phone,
        "name": user.name,
        "role": user.role,
        "student_id": user.student_id,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise AuthError("Invalid or expired authentication token") from exc


def verify_otp_and_login(
    session: Session,
    phone: str,
    otp: str,
    dpdp_consent: bool = False,
    preferred_lang: Optional[str] = None,
) -> tuple[User, str]:
    """
    Verifies the 6-digit OTP (`123456` in demo mode) and enforces DPDP Act 2023
    verifiable parental consent for all `PARENT` logins (Assumption A13).
    """
    if otp != MOCK_VALID_OTP:
        raise AuthError("Invalid OTP code. Use 123456 in demo/test mode.")

    user = session.exec(select(User).where(User.phone == phone)).first()
    if user is None:
        raise AuthError(f"No registered account found for phone {phone}")

    # DPDP Act 2023 Enforcement for Parent role
    if user.role == "PARENT":
        if not user.dpdp_consent_given and not dpdp_consent:
            raise DPDPConsentRequiredError(
                "DPDP Act 2023 verifiable parental consent is required before accessing minor student records."
            )
        if dpdp_consent and not user.dpdp_consent_given:
            user.dpdp_consent_given = True
            user.dpdp_consent_timestamp = datetime.now(timezone.utc)

    if preferred_lang in ("en", "hi"):
        user.preferred_lang = preferred_lang

    session.add(user)
    session.commit()
    session.refresh(user)

    token = create_access_token(user)
    return user, token


def issue_demo_switch_token(session: Session, target_phone: str) -> tuple[User, str]:
    """
    Issues a real signed JWT for the 1-click Reviewer Switcher bar when `DEMO_MODE=true` (Assumption A11).
    """
    if not DEMO_MODE:
        raise AuthError("Quick demo role switching is disabled when DEMO_MODE=false")

    user = session.exec(select(User).where(User.phone == target_phone)).first()
    if user is None:
        raise AuthError(f"Demo user {target_phone} not found")

    return user, create_access_token(user)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    session: Session = Depends(get_session),
) -> User:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer authentication token",
        )
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = int(payload["sub"])
    except (AuthError, KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
        )
    return user


def require_roles(*allowed_roles: str) -> Callable:
    def _role_guard(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' is not permitted. Required: {allowed_roles}",
            )
        return current_user

    return _role_guard


def verify_student_object_access(current_user: User, target_student_id: str) -> None:
    """
    Object-Level Authorization (BOLA / OWASP API1) guard:
    - `ACCOUNTS` and `COUNSELLOR` staff can access any student across the 4 centres.
    - `PARENT` users can ONLY access or pay instalments belonging to `current_user.student_id`.
    """
    if current_user.role in ("ACCOUNTS", "COUNSELLOR"):
        return

    if current_user.role == "PARENT" and current_user.student_id == target_student_id:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied: You can only view or pay your own child's fee ledger.",
    )
