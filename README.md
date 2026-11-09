# FeeSathi — AI Fee Intelligence & Parent Portal for Coaching Institutes

> **Company A, Jaipur** · 4 Centres · 2,600 Students · ₹31.2 Cr Annual Billing  
> Built for the Software Engineering Core Build Evaluation

---

## What is FeeSathi?

FeeSathi is a production-grade fee management, automated engagement, and AI-driven dropout prevention system built for a Jaipur-based JEE/NEET coaching institute operating across 4 centres.

**The problem it solves:** ₹79.2 lakh/year in financial leakage from late follow-ups (₹62.4L uncollected fees + ₹16.8L staff chasing costs), 12% of instalment value arriving over 60 days late, and 4-day month-end reconciliation cycles.

---

## Key Features (All Working End-to-End)

| # | Feature | Description |
|---|---------|-------------|
| 1 | **5-Second Parent Portal** | Parents see amount due, due date, and Pay Now button instantly on mobile. Hindi/English bilingual. |
| 2 | **OTP Login + DPDP 2023 Consent** | Verifiable parental consent for minor student records under the Digital Personal Data Protection Act. |
| 3 | **Integrated Payment Gateway** | Test mode UPI QR, NetBanking, and Card payments with partial/full amount support. |
| 4 | **Atomic Reminder Kill-Switch** | Automated SMS/WhatsApp reminders (T-7, T=0, T+7) that **stop instantly** upon payment. |
| 5 | **GST Tax Invoice Generation** | Gapless sequential receipt numbering with exact 18% GST split (9% CGST + 9% SGST). |
| 6 | **MoE 2024 Pro-Rata Refund Calculator** | Statutory refund engine: 300-day session, ₹1,500 registration fee, 10-day SLA deadline. |
| 7 | **Central Dues Dashboard** | Consolidated view across all 4 Jaipur centres with ageing buckets and batch filters. |
| 8 | **Tally XML Voucher Export** | Native Tally ERP 9 / Prime import-ready XML for instant month-end reconciliation. |
| 9 | **AI Dropout-Risk Engine** | Deterministic 3-factor scoring (Fee + Attendance + Tests). Creates counsellor tasks only, never fee actions. |
| 10 | **Unmatched Payments Queue** | Bank deposits without student references quarantined for manual reconciliation. |
| 11 | **Bulk Upload** | Batch attendance and mock test score uploads with automatic AI risk recalculation. |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS |
| **Backend** | Python 3.12, FastAPI, Pydantic |
| **ORM** | SQLModel (SQLAlchemy 2.0 + Pydantic) |
| **Database** | SQLite (dev) / PostgreSQL (production) |
| **Auth** | JWT (HS256), Role-Based Access Control |
| **Tests** | pytest (38 tests across 8 test modules) |

---

## Quick Start

### Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev -- --port 5173
```

Open **http://localhost:5173** in your browser.

---

## Demo Credentials

| Persona | Phone | OTP | What to Test |
|---------|-------|-----|-------------|
| **Ishita Sharma** (Parent) | `9829010587` | `123456` | 23d overdue, partial payment, reminder logs |
| **Mohit Gurjar** (Parent) | `9829010219` | `123456` | Due in 13d, Hindi portal, proactive prompt |
| **Aarav Meena** (Parent) | `9829010412` | `123456` | 100% paid, course withdrawal & refund demo |
| **Devansh Rathore** (Parent) | `9829010641` | `123456` | 79d overdue (>60d bucket), high-risk case |
| **Accounts Executive** (Staff) | `9829000001` | `123456` | Central dashboard, Tally export, reconciliation |
| **Academic Counsellor** (Staff) | `9829000002` | `123456` | AI dropout risk queue, false-flag dismissal |

Or use the **Evaluator Sandbox** tab on the login page for instant 1-click access.

---

## Running Tests

```bash
cd backend
source .venv/bin/activate
pytest
```

```
38 passed in 1.09s
```

---

## Project Structure

```
FeeSathi/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application entry point
│   │   ├── models.py            # SQLModel database entities
│   │   ├── seed.py              # Sample data seeder (4 students, 4 centres)
│   │   ├── config.py            # Environment config & labelled constants
│   │   ├── routers/             # API route modules
│   │   │   ├── auth.py          # OTP login, demo-switch, JWT
│   │   │   ├── parent.py        # Parent portal data API
│   │   │   ├── accounts.py      # Dashboard, Tally export, reconciliation
│   │   │   ├── refunds.py       # MoE 2024 refund calculator & issuer
│   │   │   ├── ai_risk.py       # AI risk queue & counsellor actions
│   │   │   ├── webhooks.py      # Payment gateway callback handler
│   │   │   ├── reminders.py     # Reminder status & kill-switch API
│   │   │   └── bulk_upload.py   # Batch attendance & test score upload
│   │   ├── services/            # Business logic engines
│   │   │   ├── payment_service.py   # ACID payment processing & kill-switch
│   │   │   ├── refund_service.py    # Pro-rata statutory refund engine
│   │   │   ├── ai_risk_service.py   # 3-factor dropout risk scoring
│   │   │   ├── reminder_service.py  # Bilingual reminder scheduling
│   │   │   ├── receipt_service.py   # GST split & sequential receipt numbers
│   │   │   └── auth_service.py      # JWT, RBAC, DPDP consent
│   │   └── utils/
│   └── tests/                   # 38 automated tests (8 modules)
├── frontend/
│   └── src/
│       ├── pages/               # LoginPage, ParentPortalPage, AccountsWorkspace
│       ├── components/          # PaymentModal, GstReceiptModal, ReviewerBar
│       │   └── accounts/        # DashboardTab, LedgerTab, RefundTab, AiRiskTab
│       ├── context/             # AuthContext (JWT state management)
│       ├── api/                 # API client with typed interfaces
│       └── i18n/                # Hindi/English translation dictionaries
├── docs/
│   ├── Technical_Design_Document.md
│   └── assumptions.md          # 18 labelled domain assumptions (A1–A18)
├── deployment.md               # Local setup, env vars, demo credentials
├── .env.example                # Environment variable template (no secrets)
└── .gitignore
```

---

## Labelled Assumptions

All domain parameters not fixed in the client brief are documented in [`docs/assumptions.md`](docs/assumptions.md) with 18 labelled assumptions (A1–A18) covering reference dates, session length, GST rules, AI scoring weights, DPDP compliance, and more.

---

## Documentation

- **[Technical Design Document](docs/Technical_Design_Document.md)** — Architecture, data model, AI engine, UI decisions, and scope cuts.
- **[Deployment Guide](deployment.md)** — Step-by-step local setup, environment variables, and demo credentials.
- **[Labelled Assumptions](docs/assumptions.md)** — All 18 domain assumptions with rationale and code enforcement.
