import pytest
from fastapi.testclient import TestClient

from app.config import REFERENCE_DATE
from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def reset_db_before_test(client: TestClient):
    client.post("/api/demo/reset")


def test_root_endpoint(client: TestClient):
    resp = client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["app"] == "FeeSathi API"
    assert data["status"] == "online"
    assert data["reference_date"] == REFERENCE_DATE.isoformat()


def test_auth_demo_switch_and_me(client: TestClient):
    # 1. Switch to Parent (Aarav Meena's parent: 9829010412)
    resp = client.post("/api/auth/demo-switch", json={"phone": "9829010412"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["role"] == "PARENT"
    assert data["user"]["student_id"] == "STU-0412"
    parent_token = data["access_token"]

    # 2. Call /api/auth/me with Bearer token
    resp_me = client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {parent_token}"}
    )
    assert resp_me.status_code == 200
    assert resp_me.json()["phone"] == "9829010412"

    # 3. Switch to Accounts Staff (9829000001)
    resp_acc = client.post("/api/auth/demo-switch", json={"phone": "9829000001"})
    assert resp_acc.status_code == 200
    assert resp_acc.json()["user"]["role"] == "ACCOUNTS"


def test_parent_portal_and_bola_protection(client: TestClient):
    # Get Parent Token
    resp_switch = client.post("/api/auth/demo-switch", json={"phone": "9829010412"})
    parent_token = resp_switch.json()["access_token"]
    headers = {"Authorization": f"Bearer {parent_token}"}

    # 1. Authorized access to own child (STU-0412 Aarav Meena)
    resp = client.get("/api/parent/portal", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["student"]["id"] == "STU-0412"
    assert data["student"]["name"] == "Aarav Meena"
    assert "hero_due_card" in data
    assert "instalments" in data
    assert "receipts" in data

    # 2. BOLA: Attempt to access another student (STU-0587 Ishita Sharma) must be 403 Forbidden
    resp_forbidden = client.get(
        "/api/parent/portal?student_id=STU-0587", headers=headers
    )
    assert resp_forbidden.status_code == 403
    assert "Access denied" in resp_forbidden.json()["detail"]


def test_accounts_dashboard_and_tally_export(client: TestClient):
    resp_switch = client.post("/api/auth/demo-switch", json={"phone": "9829000001"})
    acc_token = resp_switch.json()["access_token"]
    headers = {"Authorization": f"Bearer {acc_token}"}

    # 1. Dashboard metrics
    resp = client.get("/api/accounts/dashboard", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "kpis" in data
    assert "students" in data
    assert data["kpis"]["total_billed_inr"] > 0
    assert "over_60_days_pct" in data["kpis"]
    assert len(data["students"]) >= 3

    # 2. Individual student ledger view by accounts
    resp_stu = client.get("/api/accounts/students/STU-0587", headers=headers)
    assert resp_stu.status_code == 200
    stu_data = resp_stu.json()
    assert stu_data["student"]["name"] == "Ishita Sharma"
    assert "ai_risk" in stu_data
    assert stu_data["ai_risk"]["risk_score"] == 74  # Exact 74 pts from prompt math

    # 3. Tally XML export
    resp_tally = client.get("/api/accounts/export-tally", headers=headers)
    assert resp_tally.status_code == 200
    assert "application/xml" in resp_tally.headers["content-type"]
    xml_text = resp_tally.text
    assert "<ENVELOPE>" in xml_text
    assert '<VOUCHER VCHTYPE="Receipt"' in xml_text
    assert "Tuition Fee Base" in xml_text
    assert "CGST Output 9%" in xml_text
    assert "SGST Output 9%" in xml_text


def test_payment_processing_and_receipt(client: TestClient):
    # Switch to Ishita's parent (9829010587, STU-0587)
    resp_switch = client.post("/api/auth/demo-switch", json={"phone": "9829010587"})
    token = resp_switch.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Ishita has instalment #1 (due 2026-10-10, 15000 remaining)
    portal_resp = client.get("/api/parent/portal", headers=headers)
    assert portal_resp.status_code == 200
    hero_card = portal_resp.json()["hero_due_card"]
    assert hero_card is not None
    inst_id = hero_card["id"]

    # Pay 5,000 INR
    pay_payload = {
        "amount": 5000,
        "idempotency_key": "api-test-idem-key-001",
        "payment_mode": "UPI",
    }
    pay_resp = client.post(
        f"/api/instalments/{inst_id}/pay", json=pay_payload, headers=headers
    )
    assert pay_resp.status_code == 200
    pay_data = pay_resp.json()
    assert pay_data["was_idempotent_replay"] is False
    assert pay_data["instalment"]["amount_paid"] == 20000
    assert "gst_invoice" in pay_data
    receipt_no = pay_data["gst_invoice"]["receipt_no"]

    # Idempotent replay with same key
    replay_resp = client.post(
        f"/api/instalments/{inst_id}/pay", json=pay_payload, headers=headers
    )
    assert replay_resp.status_code == 200
    assert replay_resp.json()["was_idempotent_replay"] is True

    # View GST Receipt
    rcpt_resp = client.get(f"/api/receipts/{receipt_no}", headers=headers)
    assert rcpt_resp.status_code == 200
    assert rcpt_resp.json()["receipt_no"] == receipt_no
    assert rcpt_resp.json()["tax_breakdown"]["total_paid_inr"] == 5000


def test_refunds_preview_and_issue(client: TestClient):
    resp_switch = client.post("/api/auth/demo-switch", json={"phone": "9829000001"})
    acc_token = resp_switch.json()["access_token"]
    headers = {"Authorization": f"Bearer {acc_token}"}

    # 1. Preview refund calculation for Aarav Meena (STU-0412, exit date 2026-06-20)
    calc_payload = {
        "student_id": "STU-0412",
        "exit_date": "2026-06-20",
    }
    calc_resp = client.post(
        "/api/accounts/refunds/calculate", json=calc_payload, headers=headers
    )
    assert calc_resp.status_code == 200
    calc_data = calc_resp.json()
    assert calc_data["daily_rate_inr"] == 395
    assert calc_data["refundable_amount"] > 0
    assert "gst_credit_note_preview" in calc_data


def test_ai_risk_queue_and_actions(client: TestClient):
    resp_switch = client.post("/api/auth/demo-switch", json={"phone": "9829000001"})
    acc_token = resp_switch.json()["access_token"]
    headers = {"Authorization": f"Bearer {acc_token}"}

    # 1. List AI risk queue
    risk_resp = client.get("/api/accounts/ai-risk", headers=headers)
    assert risk_resp.status_code == 200
    data = risk_resp.json()
    assert "assessments" in data
    assert "valid_dismiss_reasons" in data

    # 2. Dismiss flag for a student
    dismiss_payload = {
        "reason": "MEDICAL_LEAVE",
        "notes": "Verified dengue fever hospital certificate",
    }
    d_resp = client.post(
        "/api/accounts/ai-risk/STU-0587/dismiss", json=dismiss_payload, headers=headers
    )
    assert d_resp.status_code == 200
    assert d_resp.json()["risk_level"] == "DISMISSED_FALSE_FLAG"


def test_unmatched_payments_queue(client: TestClient):
    resp_switch = client.post("/api/auth/demo-switch", json={"phone": "9829000001"})
    acc_token = resp_switch.json()["access_token"]
    headers = {"Authorization": f"Bearer {acc_token}"}

    resp = client.get("/api/accounts/unmatched", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "unmatched_payments" in data
    assert "candidate_instalments" in data


def test_bulk_upload_academic_data(client: TestClient):
    resp_switch = client.post("/api/auth/demo-switch", json={"phone": "9829000001"})
    acc_token = resp_switch.json()["access_token"]
    headers = {"Authorization": f"Bearer {acc_token}"}

    bulk_payload = {
        "records": [
            {
                "student_id": "STU-0412",
                "attendance_pct": 95.0,
                "test_scores": [88.0, 92.0, 94.0],
            }
        ]
    }
    resp = client.post(
        "/api/accounts/bulk-upload", json=bulk_payload, headers=headers
    )
    assert resp.status_code == 200
    assert resp.json()["updated_count"] == 1
