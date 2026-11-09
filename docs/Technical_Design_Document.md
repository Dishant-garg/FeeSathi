# Technical Design Document (TDD)
# FeeSathi — Enterprise Fee Intelligence, MoE 2024 Refund Engine & Parent Portal

> **GitHub Repository:** `https://github.com/dishantgarg/FeeSathi`
> **Live Application Demo:** `http://localhost:5173` 
> **Client:** Company A, Jaipur (Engineering & Medical Entrance Coaching — JEE / NEET)  
> **Target Scope:** 4 Centres, 2,600 Students, 140 Staff, ₹31.2 Crore Annual Billing  
> **Author:** Software Engineering Candidate  
> **Date:** November 2026

---

## Executive Summary

Company A operates four coaching centres across Jaipur (Tonk Road, Vaishali Nagar, Malviya Nagar, Mansarovar) enrolling 2,600 students with an average annual fee of ₹1.2 lakh (total billing ₹31.2 crore/year). Today, the institute suffers from **₹79.2 lakh/year in financial leakage and operational drag**:
1. **Uncollected Fees (₹62.4 lakh/yr):** 2% of annual billing is permanently lost due to late, irregular, and manual phone follow-ups.
2. **Severe Ageing Default (12% of instalments):** Over ₹3.74 crore arrives more than 60 days late, strangling centre cash flow.
3. **Staff Chasing Friction (₹16.8 lakh/yr):** 8 accounts staff spend half their working hours (4 FTEs × ₹4.2 lakh) making manual balance phone calls.
4. **Reconciliation Lag:** Month-end reconciliation across Excel sheets, desktop fee software, and Tally takes **4 full days per month**.

**FeeSathi** solves these problems with a focused, production-grade slice:
* **Parents** view exact dues in 5 seconds on low-end mobile devices and pay via an integrated test gateway, stopping reminders automatically.
* **Accounts Executives** gain consolidated visibility across all 4 centres, automated ageing buckets, one-click Tally XML voucher export, and a manual reconciliation queue for unmatched bank deposits.
* **Academic Counsellors** receive automated AI dropout-risk alerts to intervene pastorally before students default or leave.
* **The Founder-Director** gets verifiable compliance with the **Ministry of Education's 2024 Coaching Guidelines** (published 10-day pro-rata refund statutory SLA) and the **DPDP Act 2023** (verifiable parental consent for minors).

---

## 1. System Architecture & Tech Stack Justification

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             CLIENT LAYER                                 │
│   Low-End Android Phones (Parents)     │    Desktop / Tablets (Staff)    │
│   • 5-Second Dues Hero                 │    • Central 4-Centre Dashboard │
│   • Hindi / English Bilingual View     │    • Ageing & Tally XML Export  │
│   • Integrated Payment Gateway         │    • MoE 2024 Refund Calculator │
│   • DPDP 2023 Verifiable Consent       │    • AI Risk Intervention Desk  │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │ HTTPS / JSON / JWT
┌────────────────────────────────────▼─────────────────────────────────────┐
│                       FRONTEND SINGLE PAGE APPLICATION                   │
│   React 18 + TypeScript + Vite + Tailwind CSS / Vanilla Design Tokens     │
│   • Sub-75KB gzipped bundle size for instant 3G/4G loading in Rajasthan  │
│   • Zero runtime UI bloat; high-contrast accessible visual hierarchy     │
│   • Collapsible Floating Evaluator Sandbox Switcher (Hackathon / Review) │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │ RESTful JSON APIs + Webhooks
┌────────────────────────────────────▼─────────────────────────────────────┐
│                           BACKEND ENGINE (FastAPI)                       │
│   • Auth & RBAC Service (Signed HS256 JWTs; Parent, Accounts, Counsellor)│
│   • Fee Ledger & State Engine (Installment maturation, partial balances) │
│   • Atomic Reminder Kill-Switch (Instant cancel upon payment receipt)    │
│   • MoE 2024 Statutory Refund Engine (300-day session, ₹1,500 reg fee)   │
│   • Deterministic 3-Factor AI Dropout-Risk Engine (PII-sanitized)        │
│   • Native Tally XML Voucher Generator (Tally 9 / Prime import schema)   │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │ SQLModel / SQLAlchemy ORM
┌────────────────────────────────────▼─────────────────────────────────────┐
│                          PERSISTENCE & AUDIT                             │
│   SQLite (Local / Zero-Config Demo) / PostgreSQL (Production)            │
│   • ACID transactions for double-entry receipts, idempotency keys        │
│   • Immutable Payment Records, GST serial counters, Reminder audit logs   │
└──────────────────────────────────────────────────────────────────────────┘
```

### Why This Tech Stack Was Chosen

1. **FastAPI (Python 3.11+):**
   * **Sub-millisecond execution:** Native async ASGI architecture handles concurrent mobile parent logins during fee deadline surges.
   * **Pydantic schema validation:** Prevents malformed payment payloads, ensures strict type safety, and auto-generates OpenAPI/Swagger documentation.
   * **Extensible data science ecosystem:** Deterministic AI risk scoring integrates cleanly with Python data analytics and LLM APIs without inter-process overhead.

2. **SQLModel (SQLAlchemy 2.0 + Pydantic):**
   * Unifies database models and API response schemas into a single class definition, eliminating translation bugs and schema drift.
   * Fully supports SQLite for zero-configuration reviewer execution, while supporting seamless migration to managed PostgreSQL via a single `DATABASE_URL` switch.

3. **React 18 + TypeScript + Vite:**
   * **Lightweight bundle:** Vite compiles optimized production chunks (~73KB gzip), crucial for parents accessing the portal over spotty mobile networks in suburban Jaipur.
   * **Instant persona remounting:** Keying routes by `user.id` guarantees that switching between parents (e.g. Ishita to Mohit) completely clears local state and re-fetches authoritative data with no cross-contamination.

---

## 2. Comprehensive Data Model

The schema enforces double-entry integrity, immutable audit trails, and strict role segregation across nine entities:

```
┌──────────────────┐           ┌──────────────────┐           ┌──────────────────┐
│     Student      │1        * │    Instalment    │1        * │  PaymentRecord   │
│──────────────────│───────────│──────────────────│───────────│──────────────────│
│ id (PK)          │           │ id (PK)          │           │ id (PK)          │
│ name             │           │ student_id (FK)  │           │ instalment_id(FK)│
│ centre           │           │ instalment_no    │           │ student_id (FK)  │
│ batch            │           │ amount_due       │           │ amount           │
│ parent_phone     │           │ amount_paid      │           │ base_amount      │
│ net_annual_fee   │           │ due_date         │           │ cgst_amount (9%) │
│ attendance_pct   │           │ status           │           │ sgst_amount (9%) │
│ test_scores_json │           │ latest_receipt_no│           │ gst_receipt_no   │
│ status (ACTIVE / │           └────────┬─────────┘           │ idempotency_key  │
│         WITHDRAWN│                    │1                    │ payment_mode     │
│ ai_dismissed     │                    │                     └──────────────────┘
└────────┬─────────┘                    │*
         │1                             ▼
         │                     ┌──────────────────┐
         │*                    │   ReminderLog    │
         ▼                     │──────────────────│
┌──────────────────┐           │ id (PK)          │
│  CounsellorTask  │           │ instalment_id(FK)│
│──────────────────│           │ student_id (FK)  │
│ id (PK)          │           │ reminder_type    │
│ student_id (FK)  │           │ trigger_date     │
│ risk_score       │           │ channel (WHATSAPP│
│ risk_factors_json│           │ status (SENT /   │
│ status (OPEN /   │           │   SCHEDULED /    │
│   RESOLVED /     │           │   STOPPED_ON_PAY)│
│   FALSE_FLAG)    │           │ message_text     │
└──────────────────┘           └──────────────────┘
```

### Table Definitions & Key Attributes

1. **`Student`:** Core student record (`id`, `name`, `centre`, `batch`, `parent_phone`, `gross_annual_fee`, `scholarship_discount`, `net_annual_fee`, `attendance_pct`, `test_scores_json`, `status`).
2. **`Instalment`:** Fee instalment schedule (`id`, `student_id`, `instalment_no`, `amount_due`, `amount_paid`, `due_date`, `status`, `paid_at`, `latest_receipt_no`). Status is computed dynamically: `UPCOMING`, `DUE`, `PART_PAID`, `OVERDUE`, `PAID`, or `WITHDRAWN`.
3. **`PaymentRecord`:** Immutable transaction receipt (`id`, `instalment_id`, `student_id`, `amount`, `base_amount`, `cgst_amount`, `sgst_amount`, `gst_receipt_no`, `idempotency_key`, `payment_mode`, `created_at`).
4. **`ReminderLog`:** Multi-channel notification audit trail (`id`, `instalment_id`, `student_id`, `reminder_type`, `trigger_date`, `channel`, `status`, `message_text`, `stopped_reason`).
5. **`CounsellorTask`:** Pastoral intervention queue (`id`, `student_id`, `risk_score`, `risk_level`, `risk_factors_json`, `status`, `notes`, `created_at`).
6. **`RefundRecord`:** Statutory withdrawal and refund settlement log (`id`, `student_id`, `exit_date`, `request_date`, `sla_deadline_date`, `total_paid`, `pro_rata_consumed`, `refundable_amount`, `shortfall_receivable`, `status`, `gst_credit_note_no`).
7. **`UnmatchedPayment`:** Suspense account ledger for bank deposits missing student references (`id`, `utr_reference`, `bank_account`, `amount`, `deposited_at`, `status`, `matched_student_id`).
8. **`ReceiptCounter`:** Thread-safe sequential receipt generator (`financial_year`, `last_number`).
9. **`User`:** Identity and authentication table (`id`, `phone`, `role`, `student_id`, `preferred_lang`, `dpdp_consent`).

---

## 3. Core Functional Workflows

### Flow 1: 5-Second Parent Dues Clarity & Idempotent Payment
1. Parent logs in using registered mobile number + OTP `123456`.
2. First-time login captures **DPDP Act 2023 verifiable parental consent** with timestamp and mobile audit log.
3. Portal displays the **5-Second Hero Card**:
   * Exact amount due now: `₹15,000` (e.g. for Ishita).
   * Exact due date and overdue badge (`23 days overdue`).
   * One primary action: **"Pay Now • ₹15,000 →"** (or custom partial amount).
4. Parent selects payment method (UPI QR, NetBanking, Card) in test gateway.
5. Frontend generates a unique client UUID (`idempotency_key`).
6. Payment service processes the transaction in a single ACID block:
   * Verifies student is `ACTIVE` and `amount <= remaining_balance`.
   * Allocates gapless GST tax receipt number (e.g. `SKP/2627/0004`).
   * Splits payment into Base (100/118), CGST 9%, and SGST 9%.
   * **Fires the Atomic Kill-Switch:** Updates instalment to `PAID` and immediately cancels all queued reminders.
   * Returns complete GST Tax Invoice modal with SAC code `999293`.

### Flow 2: Atomic Reminder Kill-Switch (Zero Parent Chasing)
* **Cadence:** Three reminders per instalment: `BEFORE_7_DAYS` ($T-7$), `ON_DUE_DATE` ($T=0$), and `AFTER_7_DAYS` ($T+7$).
* **Problem Solved:** Chasing parents who have already paid destroys parent trust and wastes staff hours.
* **Mechanism:**
  ```python
  if instalment.status == "PAID":
      scheduled_reminders = session.exec(
          select(ReminderLog).where(
              ReminderLog.instalment_id == instalment.id,
              ReminderLog.status == "SCHEDULED"
          )
      ).all()
      for rem in scheduled_reminders:
          rem.status = "STOPPED_ON_PAYMENT"
          rem.stopped_reason = f"Automatically stopped upon full payment receipt {receipt_no}"
  ```
* In addition, Academic Counsellors have a **Manual Pause Kill-Switch** in the AI risk queue to halt reminders when a student's family faces genuine bereavement or medical emergencies.

### Flow 3: MoE 2024 Coaching Guidelines Pro-Rata Refund Engine
The Ministry of Education (MoE) 2024 Coaching Guidelines mandate that when a student withdraws:
1. Coaching centres must calculate refunds **strictly pro-rata** based on days enrolled against the published session.
2. The refund must be disbursed **within 10 days**.

#### Mathematical Formulation:
$$\text{Total Session Days} = 300 \text{ calendar days (April 1 to January 25)}$$
$$\text{Allocable Course Fee} = \text{Net Annual Fee} - ₹1,500 \text{ (Administrative Registration Fee)}$$
$$\text{Daily Instructional Rate} = \frac{\text{Allocable Course Fee}}{300}$$
$$\text{Instructional Fee Consumed} = \text{Daily Rate} \times \min(300, \text{Days Attended})$$
$$\text{Pro-Rata Fee Utilized} = ₹1,500 + \text{Instructional Fee Consumed}$$
$$\text{Refundable Amount} = \max(0, \text{Total Paid to Date} - \text{Pro-Rata Fee Utilized})$$
$$\text{Shortfall Receivable} = \max(0, \text{Pro-Rata Fee Utilized} - \text{Total Paid to Date})$$
$$\text{Statutory SLA Deadline} = \text{Request Date} + 10 \text{ calendar days}$$

* **Shortfall Protection:** If a part-paid student attended 150 days but only paid Instalment #1, the engine outputs `Refund = ₹0` and calculates the shortfall receivable owed to the institute.
* **Side-Effects:** Approving a refund atomically marks the student `WITHDRAWN`, cancels all future reminders, closes open counselling tasks, and issues an official GST Credit Note reference.

### Flow 4: Central Accounts Treasury & Tally XML Export
* Consolidates financial metrics across all 4 Jaipur branches:
  * Total Net Billed: ₹6,95,000 (sample view)
  * Total Collected to Date: ₹4,05,000
  * Ageing Buckets: `<30 days`, `31–60 days`, and `>60 days overdue` (tracking the client's 12% to 6% reduction target).
* **Tally XML Voucher Export:** Rather than manual spreadsheet re-entry, the accounts executive clicks "Export Tally XML". The backend renders standard `<TALLYMESSAGE>` XML receipt vouchers with ledger names (`Tuition Fee Base`, `CGST Output 9%`, `SGST Output 9%`, `Bank Account`), allowing direct bulk import into Tally ERP 9 / Tally Prime.

### Flow 5: Unmatched Bank Payments Queue (Suspense Reconciliation)
* Direct NEFT, RTGS, or UPI transfers frequently arrive in coaching bank accounts with truncated narration strings (e.g. `UPI/629103810/HDFC/FEES`).
* Instead of blindly crediting the wrong student or halting automated operations, unmatched transactions enter the **Suspense Queue** (`UnmatchedPayment`).
* The accounts desk views the UTR, bank stamp, and amount, selects the candidate student from a filtered dropdown, and clicks **"Match & Issue GST Receipt"**, atomically updating the student ledger.

---

## 4. AI Dropout-Risk Engine & Counsellor Desk

### Design Philosophy: Safety First, No False Fee Actions
The PRD states:
> *"When it is wrong: the flag only creates a counsellor call task, never a fee action or parent message, and counsellors mark false flags."*

FeeSathi implements a transparent, deterministic 3-factor model that scores student distress from 0 to 100 without hallucinations:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DETERMINISTIC 3-FACTOR SCORING                       │
├─────────────────────────────────────────────────────────────────────────┤
│ Factor 1: Fee Friction (Max 40.0 pts)                                   │
│ • Days Overdue (up to 28 pts): (min(days, 30) / 30) * 28                │
│ • Unpaid Ratio (up to 12 pts): (unpaid_balance / instalment_due) * 12   │
├─────────────────────────────────────────────────────────────────────────┤
│ Factor 2: Attendance Decay (Max 35.0 pts)                               │
│ • Drop below 85% target: min(35, max(0, (85.0 - attendance_pct) * 1.4))│
├─────────────────────────────────────────────────────────────────────────┤
│ Factor 3: Mock Test Score Trajectory (Max 25.0 pts)                     │
│ • Score decline across tests: min(25, max(0, abs(delta) * 1.1))         │
├─────────────────────────────────────────────────────────────────────────┤
│ Final Score: round(fee_pts + att_pts + test_pts)                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Risk Level Classifications
* **`HIGH` ($\ge 70$ pts):** Multiple compounding stress signals (e.g. Ishita Sharma: `27.5 + 26.6 + 19.8 = 74/100`). Triggers immediate priority pastoral call task.
* **`MEDIUM` ($45–69$ pts):** Emerging friction; counsellor check-in scheduled.
* **`LOW` ($< 45$ pts):** Normal healthy student trajectory.
* **`UNSURE_BORDERLINE`:** Assigned when a student has fewer than 3 mock test scores (`confidence = "LOW_SPARSE_DATA"`). Flags to the counsellor that academic data is incomplete.

### False-Flag Dismissal & The +15 Resurfacing Rule
1. If a counsellor investigates and finds a valid explanation (e.g. *Medical Leave, Family Bereavement, Approved Fee Extension*), they click **"Dismiss as False Flag"**.
2. The system logs `ai_dismissed = True`, `ai_dismissed_at_score`, reason, and timestamp.
3. The student is hidden from the active call queue.
4. **Resurfacing Safeguard:** To prevent a one-time dismissal from permanently hiding a student whose situation deteriorates months later, the engine will automatically resurface the student if their risk score subsequently rises by **$\ge 15$ points** above their dismissal score.
5. **Full Healing Recovery:** If the student's attendance improves and dues are cleared such that their score drops below 45 (`LOW`), the dismissal flag is cleanly reset (`ai_dismissed = False`).

### DPDP Act 2023 PII Sanitization
If LLM APIs (Groq or Gemini) are invoked for unstructured call note synthesis or sentiment analysis, all personal identifiers (`student.id`, `student.name`, parent phone number) are stripped prior to transit, preserving student data privacy under Section 9 of the DPDP Act 2023.

---

## 5. UI and UX Design Decisions

### 1. The 5-Second Rule for Parents
* Coaching parents are often working-class or non-technical and use budget Android devices.
* The home screen presents zero cognitive load: large rupee typography, due date, clear badge status, and a prominent pay button. Attendance charts and instalment breakdowns are accessible via clean secondary tabs.

### 2. Native Hindi Localization
* Parents can switch between **Hindi** (`हिंदी संस्करण`) and **English** with a single click.
* All terminology is translated culturally (e.g. *किस्त #3, देय तिथि, रसीद, उपस्थिति*).

### 3. Role-Differentiated Staff Portals
* **Accounts Executive:** Green/slate treasury palette, central dues KPI cards, ageing breakdown, Tally export, and cash ledger.
* **Academic Counsellor:** Purple/indigo welfare palette, prioritized dropout risk list, call desk logger, and emotional distress indicators.

### 4. Collapsible Floating Evaluator Sandbox
* Rather than a jarring, bolted-on dock clashing with the production login screen, the sandbox switcher is tucked away into a sleek floating pill (`[ 🧪 Sandbox Switcher  ^ ]`) in the bottom-right corner.
* When expanded, it reveals instant 1-click test buttons for all 6 personas, a DB reset button, and scenario descriptions for judges.

---

## 6. Labelled Assumptions & Domain Rules

| # | Area | Labelled Assumption | Rationale & Code Enforcement |
|---|---|---|---|
| **A1** | **Reference Clock** | `REFERENCE_DATE = 2026-11-02` | Aligns prompt dates (`2026-10-10` = 23 days overdue for Ishita; `2026-11-15` = due in 13 days for Mohit). |
| **A2** | **Academic Session** | **300 calendar days** (`2026-04-01` to `2027-01-25`) | Denominator for daily instructional fee calculation under MoE guidelines. |
| **A3** | **Registration Fee** | **₹1,500 non-refundable** administrative component | Deducted before computing daily instructional rate: `(Net Fee - 1,500) / 300`. |
| **A4** | **MoE Refund SLA** | **10 calendar days from Request Date** | Statutory clock starts on formal withdrawal application, not retrospective exit date. |
| **A5** | **Shortfall Protection** | `Refund = max(0, Paid - Consumed)`; gap is `shortfall_receivable` | Prevents negative refunds; atomically sets student to `WITHDRAWN` and halts reminders. |
| **A6** | **GST Calculation** | **18% GST** (`9% CGST + 9% SGST` intra-state Rajasthan) | Exact-sum formula: `base = round(total / 1.18, 2)`, `cgst = round(base * 0.09, 2)`, `sgst = total - base - cgst`. |
| **A7** | **Reminder Cadence** | **3 triggers per instalment:** $T-7$, $T=0$, $T+7$ | Pre-checks `status != 'PAID'` at runtime; payment triggers atomic transition to `STOPPED_ON_PAYMENT`. |
| **A8** | **AI Risk Formula** | **Fee (40) + Attendance (35) + Test Trajectory (25)** | Single unrounded float computation rounded once at the end. Ishita scores exactly `74 / 100`. |
| **A9** | **AI Sparse Data** | `confidence = 'LOW_SPARSE_DATA'` when $<3$ mock tests | Flags `UNSURE_BORDERLINE` to prompt counsellor data verification instead of false alarm. |
| **A10**| **AI Resurfacing** | Suppressed alert resurfaces if score rises $\ge 15$ points | Dismissal resets when student heals back to `LOW` ($<45$). |
| **A11**| **RBAC Matrix** | 3 distinct roles: `PARENT`, `ACCOUNTS`, `COUNSELLOR` | Parents restricted to their own child; Accounts handles treasury/refunds; Counsellor manages welfare. |
| **A12**| **Over-60-Day KPI** | $\frac{\text{Unpaid Balance on Instalments } > 60\text{d Overdue}}{\text{Total Matured Value to Date}}$ | Unambiguous denominator measuring progress toward client's 12% to 6% goal. |
| **A13**| **DPDP 2023 Consent**| Mandatory verifiable parental consent on minor student records | Logged on login with timestamp and IP audit trail. |
| **A14**| **Suspense Queue** | Unmatched bank payments quarantined to `UnmatchedPayment` | Reduces month-end reconciliation time from 4 days to 1 without misattributing funds. |
| **A15**| **Centre Hierarchy** | 4 centres: *Tonk Road, Vaishali Nagar, Malviya Nagar, Mansarovar* | Aggregates data Institute $\rightarrow$ Centre $\rightarrow$ Batch for consolidated visibility. |
| **A16**| **Scholarship Rule** | Discounts apply proportionally; refund uses net payable fee | Enforces financial consistency between scholarship awards and statutory refunds. |
| **A17**| **Bulk Upload** | Batch upload for attendance and mock tests with auto AI risk recalc | Enables centre clerks to update batch records in seconds. |
| **A18**| **Low-End Mobile** | Clean, fast UI with responsive layout down to 360px viewport | Guaranteed fast rendering on entry-level Android devices. |

---

## 7. What Was Cut vs What To Do Next

### Explicitly Cut (Out of Scope per Client Brief)
* **Video Lectures & Learning Platform:** Out of scope. FeeSathi is an ERP and financial intelligence portal, not a Zoom clone or LMS.
* **Complex Timetabling & Teacher Scheduling:** Excluded to maintain laser focus on fee collection, reminders, and refunds.
* **Admissions Marketing CRM:** Lead capture and ad campaign tracking were excluded; the portal begins once a student is enrolled at the centre counter.

### What To Do Next (Production Roadmap)
1. **Biometric RFID / Fingerprint Webhook:** Direct integration with centre turnstiles to stream live morning attendance into the database.
2. **Official WhatsApp Business Platform (WABA) BSP Integration:** Connect Meta Cloud API or Gupshup to dispatch interactive WhatsApp templates with embedded UPI payment buttons.
3. **Direct Tally ODBC Real-Time Sync:** In addition to Tally XML voucher export, support background sync directly into on-premise Tally.ERP 9 instances via local desktop agents.
4. **Parent Installment Restructuring Workflow:** Allow parents in financial distress to apply for a counsellor-approved EMI restructuring directly through the portal.
