# FeeSathi — Deployment & Reviewer Guide

> **Client:** Company A, Jaipur (Engineering & Medical Entrance Coaching — 4 Centres, 2,600 Students, ₹31.2 Cr Annual Billing)  
> **Product:** FeeSathi — Automated Fee Intelligence, MoE 2024 Refund Engine, and Parent Engagement Portal

---

## 1. Demo Login Credentials (For Evaluator & Reviewer)

FeeSathi supports two authentication modes:
1. **Interactive Production Portal:** Login via 10-digit mobile number + 6-digit test OTP (`123456`) with DPDP Act 2023 verifiable parental consent.
2. **Instant 1-Click Evaluator Sandbox:** Click the floating **`🧪 Sandbox Switcher`** in the bottom-right corner of any screen, or click the **"Evaluator Sandbox"** tab on the login page to bypass OTP and launch directly into any persona.

### Pre-Configured Test Personas & Test Scenarios

| Persona / Role | Phone Number | Test OTP | Role & Centre | Seed Test Scenario |
| :--- | :--- | :---: | :--- | :--- |
| **Ishita Sharma** (Parent) | `9829010587` | `123456` | Parent • Tonk Road Centre | **Part-Paid & 23d Overdue:** Balance ₹15,000 on Instalment #3. Test partial payment, UPI QR, & automated reminder logs. |
| **Mohit Gurjar** (Parent) | `9829010219` | `123456` | Parent • Malviya Nagar | **Due in 13 Days:** Balance ₹40,000 due 2026-11-15. Test proactive discount prompt and payment before due date. Hindi preferred. |
| **Aarav Meena** (Parent) | `9829010412` | `123456` | Parent • Tonk Road Centre | **100% Paid (Refund Demo):** All ₹1,40,000 paid. Perfect for testing course withdrawal & MoE 2024 Pro-Rata Refund Calculator. |
| **Devansh Rathore** (Parent) | `9829010641` | `123456` | Parent • Mansarovar Centre | **79d Overdue (>60d Bucket):** High-risk overdue student. Test severe default warning, reminder kill-switch, and outreach notes. |
| **Accounts Executive** (Staff) | `9829000001` | `123456` | Staff • Central Treasury | **Financial Operations:** Consolidated Central Dues Dashboard across all 4 centres, ageing buckets, Tally XML export, and un-matched payments queue. |
| **Academic Counsellor** (Staff) | `9829000002` | `123456` | Staff • Pastoral Care | **AI Dropout-Risk Desk:** 3-factor risk queue, call logging, false-positive dismissal, and reminder pause kill-switch. |

---

## 2. Local Setup & Execution Guide (Step-by-Step)

### Prerequisites
* **Python**: 3.10, 3.11, or 3.12
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher
* **Git**: Installed

---

### Step A: Backend Setup (FastAPI & SQLite)

1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   ```bash
   # On macOS / Linux
   python3 -m venv .venv
   source .venv/bin/activate

   # On Windows
   python -m venv .venv
   .venv\Scripts\activate
   ```

3. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Create your local environment configuration:
   ```bash
   cp ../.env.example .env
   ```

5. Run the backend server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   * The backend will start on **`http://localhost:8000`**.
   * Database tables and sample seed records (including the 4 student cases, 4 Jaipur centres, reminders, and unmatched payments) are **automatically initialized** on first run.
   * Swagger Interactive API Docs: **`http://localhost:8000/docs`**

6. *(Optional)* Run backend automated unit & integration tests:
   ```bash
   pytest
   ```

---

### Step B: Frontend Setup (React, TypeScript & Vite)

1. Open a second terminal window and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install npm dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev -- --port 5173
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:5173
   ```

5. *(Optional)* Verify frontend production build:
   ```bash
   npm run build
   ```

---

## 3. Production Deployment Architecture

### Deployment Strategy Overview
* **Frontend:** Static Single Page Application (SPA) built with Vite, deployed to **Vercel**, **Cloudflare Pages**, or **AWS S3 + CloudFront CDN**.
* **Backend:** Containerized FastAPI ASGI service deployed on **Render**, **Fly.io**, or **AWS ECS (Fargate)** behind an Application Load Balancer.
* **Database:** Managed **PostgreSQL** instance on **Supabase**, **Neon**, or **AWS RDS PostgreSQL** with connection pooling.

### Dockerized Deployment (Single-Command Run)

A `docker-compose.yml` can spin up both tiers in production:

```bash
docker-compose up --build -d
```

---

## 4. Environment Variables Reference

*(Names only, never secrets or values, as required by submission rules)*

### Backend Environment Variables (`backend/.env`)

| Variable Name | Description | Required / Optional |
| :--- | :--- | :---: |
| `PORT` | Listening port for the FastAPI ASGI server (default: `8000`) | Optional |
| `DATABASE_URL` | SQLAlchemy/SQLModel database connection URI (`sqlite:///./feesathi.db` or PostgreSQL URI) | Required |
| `JWT_SECRET` | Cryptographic secret key used for signing HS256 authentication tokens | Required |
| `JWT_ALGORITHM` | Hashing algorithm for JSON Web Tokens (default: `HS256`) | Required |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Session validity duration before token refresh is required | Required |
| `WEBHOOK_SECRET` | HMAC-SHA256 signature secret for payment gateway callback verification | Required |
| `DEMO_MODE` | Boolean flag enabling 1-click evaluator switcher endpoints (`true`/`false`) | Required |
| `GROQ_API_KEY` | Optional API key for LLM counselling note sentiment extraction | Optional |
| `GEMINI_API_KEY` | Optional API key for conversational parent assistance | Optional |

### Frontend Environment Variables (`frontend/.env`)

| Variable Name | Description | Required / Optional |
| :--- | :--- | :---: |
| `VITE_API_URL` | Base URL of the backend API (e.g. `http://localhost:8000` or production API URL) | Required |

---

## 5. Reviewer Quick-Test Checklist

1. **5-Second Parent Dues Clarity:** Sign in as Ishita (`9829010587` / `123456`) or use the Evaluator Sandbox. Observe Amount Due Now (₹15,000), Due Date, and instant "Pay Now" button.
2. **Atomic Reminder Kill-Switch:** Click "Pay Now" on Ishita's portal, complete a test payment of ₹15,000. Notice that Instalment #3 is marked PAID, a GST Tax Invoice is minted, and scheduled reminders flip immediately to `STOPPED_ON_PAYMENT`.
3. **MoE 2024 Pro-Rata Refund Calculator:** Switch to Accounts Exec (`9829000001`), open Tab 4 (Refund Calculator), select `STU-0412 Aarav Meena`, set exit date. Verify 300-day pro-rata calculation, ₹1,500 registration deduction, and 10-day SLA deadline.
4. **Tally XML Export:** In Accounts Workspace Tab 1 (Central Dues Dashboard), click "Export Tally XML" to download real `jaipur_coaching_tally_vouchers.xml`.
5. **AI Dropout-Risk & False-Flag Dismissal:** Switch to Academic Counsellor (`9829000002`), review Ishita's 74-point risk score, log a call, or mark a false-positive flag. Notice that dismissing suppresses the alert unless her score worsens by $\ge 15$ points.
