import pytest
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool

from app.models import User
from app.services.auth_service import (
    AuthError,
    DPDPConsentRequiredError,
    create_access_token,
    decode_access_token,
    issue_demo_switch_token,
    require_roles,
    verify_otp_and_login,
    verify_student_object_access,
)


def get_test_session() -> Session:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def test_jwt_create_and_decode_valid():
    user = User(
        id=1,
        phone="9829012345",
        name="Test Parent",
        role="PARENT",
        student_id="STU-0412",
        preferred_lang="hi",
        dpdp_consent_given=True,
    )
    token = create_access_token(user)
    assert isinstance(token, str)

    payload = decode_access_token(token)
    assert payload["sub"] == "1"
    assert payload["phone"] == "9829012345"
    assert payload["role"] == "PARENT"
    assert payload["student_id"] == "STU-0412"
    assert "exp" in payload


def test_jwt_tampered_raises_auth_error():
    user = User(id=1, phone="9829012345", name="Test Parent", role="PARENT")
    token = create_access_token(user)
    tampered_token = token[:-5] + "xxxxx"
    with pytest.raises(AuthError, match="Invalid or expired authentication token"):
        decode_access_token(tampered_token)


def test_verify_otp_parent_first_time_requires_dpdp_consent():
    with get_test_session() as session:
        user = User(
            id=10,
            phone="9829011111",
            name="Rajesh Meena",
            role="PARENT",
            student_id="STU-0412",
            dpdp_consent_given=False,
        )
        session.add(user)
        session.commit()

        # 1. Login attempt without consent must raise DPDPConsentRequiredError
        with pytest.raises(DPDPConsentRequiredError, match="DPDP Act 2023"):
            verify_otp_and_login(session, "9829011111", "123456", dpdp_consent=False)

        # 2. Login with dpdp_consent=True must succeed and record timestamp
        logged_user, token = verify_otp_and_login(
            session, "9829011111", "123456", dpdp_consent=True, preferred_lang="hi"
        )
        assert logged_user.dpdp_consent_given is True
        assert logged_user.dpdp_consent_timestamp is not None
        assert logged_user.preferred_lang == "hi"
        assert token is not None

        # 3. Subsequent login does not need dpdp_consent passed again
        user_again, token2 = verify_otp_and_login(session, "9829011111", "123456", dpdp_consent=False)
        assert user_again.dpdp_consent_given is True
        assert token2 is not None


def test_verify_otp_invalid_code_or_missing_user():
    with get_test_session() as session:
        user = User(id=11, phone="9829022222", name="Staff User", role="ACCOUNTS")
        session.add(user)
        session.commit()

        # Invalid OTP code
        with pytest.raises(AuthError, match="Invalid OTP code"):
            verify_otp_and_login(session, "9829022222", "999999")

        # Non-existent user
        with pytest.raises(AuthError, match="No registered account found"):
            verify_otp_and_login(session, "9999999999", "123456")


def test_verify_otp_staff_does_not_require_dpdp():
    with get_test_session() as session:
        user = User(
            id=12,
            phone="9829033333",
            name="Accounts Staff",
            role="ACCOUNTS",
            dpdp_consent_given=False,
        )
        session.add(user)
        session.commit()

        # ACCOUNTS role logs in without DPDP consent
        staff_user, token = verify_otp_and_login(session, "9829033333", "123456", dpdp_consent=False)
        assert staff_user.role == "ACCOUNTS"
        assert token is not None


def test_issue_demo_switch_token():
    with get_test_session() as session:
        user = User(id=13, phone="9829044444", name="Counsellor Neha", role="COUNSELLOR")
        session.add(user)
        session.commit()

        switched_user, token = issue_demo_switch_token(session, "9829044444")
        assert switched_user.name == "Counsellor Neha"
        payload = decode_access_token(token)
        assert payload["role"] == "COUNSELLOR"

        # Missing user
        with pytest.raises(AuthError, match="Demo user 9829099999 not found"):
            issue_demo_switch_token(session, "9829099999")


def test_verify_student_object_access_bola():
    parent_user = User(
        id=20,
        phone="9829055555",
        name="Parent Aarav",
        role="PARENT",
        student_id="STU-0412",
    )
    accounts_user = User(id=21, phone="9829066666", name="Accounts Head", role="ACCOUNTS")
    counsellor_user = User(id=22, phone="9829077777", name="Counsellor Head", role="COUNSELLOR")

    # 1. Parent can access their own child
    verify_student_object_access(parent_user, "STU-0412")  # Should not raise

    # 2. Parent accessing another child raises 403 Forbidden
    with pytest.raises(HTTPException) as exc_info:
        verify_student_object_access(parent_user, "STU-0587")
    assert exc_info.value.status_code == 403
    assert "You can only view or pay your own child's fee ledger" in exc_info.value.detail

    # 3. Staff can access any student across centres
    verify_student_object_access(accounts_user, "STU-0412")
    verify_student_object_access(accounts_user, "STU-0587")
    verify_student_object_access(counsellor_user, "STU-0219")


def test_require_roles_guard():
    parent_user = User(id=30, phone="9829088888", name="Parent User", role="PARENT")
    accounts_user = User(id=31, phone="9829099999", name="Accounts User", role="ACCOUNTS")

    guard_accounts_only = require_roles("ACCOUNTS")

    # Accounts user passes
    assert guard_accounts_only(accounts_user) == accounts_user

    # Parent user blocked with 403 Forbidden
    with pytest.raises(HTTPException) as exc_info:
        guard_accounts_only(parent_user)
    assert exc_info.value.status_code == 403
    assert "Role 'PARENT' is not permitted" in exc_info.value.detail
