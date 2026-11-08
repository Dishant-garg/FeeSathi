import json
from datetime import date, datetime, timedelta, timezone
from sqlmodel import Session, select, delete
from app.config import (
    FINANCIAL_YEAR_CODE,
    REFERENCE_DATE,
    SESSION_END_DATE,
    SESSION_START_DATE,
)
from app.models import (
    CounsellorTask,
    Instalment,
    PaymentRecord,
    ReceiptCounter,
    RefundRecord,
    ReminderLog,
    Student,
    UnmatchedPayment,
    User,
)


def _exact_gst_parts(amount: int) -> tuple[float, float, float]:
    base = round(amount / 1.18, 2)
    cgst = round(base * 0.09, 2)
    sgst = round(amount - base - cgst, 2)
    return base, cgst, sgst


def seed_database(session: Session, force_reset: bool = False) -> None:
    if force_reset:
        session.exec(delete(CounsellorTask))
        session.exec(delete(RefundRecord))
        session.exec(delete(UnmatchedPayment))
        session.exec(delete(ReminderLog))
        session.exec(delete(PaymentRecord))
        session.exec(delete(Instalment))
        session.exec(delete(User))
        session.exec(delete(Student))
        session.exec(delete(ReceiptCounter))
        session.commit()

    existing = session.exec(select(Student)).first()
    if existing is not None:
        return

    # 1. Seed Students across all 4 Jaipur Centres
    students = [
        # Prompt Sample #1: Aarav Meena — All current instalments paid (₹90,000 paid to date -> ideal Refund Demo)
        Student(
            id="STU-0412",
            name="Aarav Meena",
            centre="Tonk Road",
            batch="JEE 2027 Morning",
            parent_phone="9829010412",
            course_start_date=SESSION_START_DATE,
            course_end_date=SESSION_END_DATE,
            gross_annual_fee=120000,
            scholarship_discount=0,
            net_annual_fee=120000,
            attendance_pct=94.0,
            test_scores_json=json.dumps([82.0, 85.0, 88.0]),
            status="ACTIVE",
        ),
        # Prompt Sample #2: Ishita Sharma — Part paid ₹15,000/₹30,000 on 2026-10-10 (23 days overdue, AI score 74)
        Student(
            id="STU-0587",
            name="Ishita Sharma",
            centre="Vaishali Nagar",
            batch="JEE 2027 Evening",
            parent_phone="9829010587",
            course_start_date=SESSION_START_DATE,
            course_end_date=SESSION_END_DATE,
            gross_annual_fee=120000,
            scholarship_discount=0,
            net_annual_fee=120000,
            attendance_pct=66.0,
            test_scores_json=json.dumps([72.0, 63.0, 54.0]),
            status="ACTIVE",
        ),
        # Prompt Sample #3: Mohit Gurjar — ₹40,000 due on 2026-11-15 (Due in 13 days)
        Student(
            id="STU-0219",
            name="Mohit Gurjar",
            centre="Malviya Nagar",
            batch="NEET 2027 Morning",
            parent_phone="9829010219",
            course_start_date=SESSION_START_DATE,
            course_end_date=SESSION_END_DATE,
            gross_annual_fee=120000,
            scholarship_discount=0,
            net_annual_fee=120000,
            attendance_pct=89.0,
            test_scores_json=json.dumps([76.0, 78.0, 77.0]),
            status="ACTIVE",
        ),
        # Extra #4: Devansh Rathore — Mansarovar centre, >60 days overdue bucket (79 days overdue)
        Student(
            id="STU-0641",
            name="Devansh Rathore",
            centre="Mansarovar",
            batch="NEET 2027 Evening",
            parent_phone="9829010641",
            course_start_date=SESSION_START_DATE,
            course_end_date=SESSION_END_DATE,
            gross_annual_fee=120000,
            scholarship_discount=10000,
            net_annual_fee=110000,
            attendance_pct=61.0,
            test_scores_json=json.dumps([70.0, 58.0, 49.0]),
            status="ACTIVE",
        ),
        # Extra #5: Priyanshi Joshi — 31–60 days overdue bucket (43 days overdue) & Sparse Data (only 2 tests -> UNSURE)
        Student(
            id="STU-0710",
            name="Priyanshi Joshi",
            centre="Tonk Road",
            batch="JEE 2027 Morning",
            parent_phone="9829010710",
            course_start_date=SESSION_START_DATE,
            course_end_date=SESSION_END_DATE,
            gross_annual_fee=120000,
            scholarship_discount=0,
            net_annual_fee=120000,
            attendance_pct=74.0,
            test_scores_json=json.dumps([68.0, 62.0]),
            status="ACTIVE",
        ),
        # Extra #6: Kunal Kachhwaha — Vaishali Nagar, NEET Morning, scholarship holder, all due paid
        Student(
            id="STU-0804",
            name="Kunal Kachhwaha",
            centre="Vaishali Nagar",
            batch="NEET 2027 Morning",
            parent_phone="9829010804",
            course_start_date=SESSION_START_DATE,
            course_end_date=SESSION_END_DATE,
            gross_annual_fee=120000,
            scholarship_discount=15000,
            net_annual_fee=105000,
            attendance_pct=96.0,
            test_scores_json=json.dumps([88.0, 90.0, 91.0]),
            status="ACTIVE",
        ),
    ]
    for s in students:
        session.add(s)
    session.flush()

    # 2. Seed Users (Parents + Accounts Executive + Academic Counsellor)
    users = [
        User(
            phone="9829010412",
            name="Rajesh Meena (Aarav's Parent)",
            role="PARENT",
            student_id="STU-0412",
            preferred_lang="en",
            dpdp_consent_given=True,
            dpdp_consent_timestamp=datetime(2026, 4, 1, 10, 0, tzinfo=timezone.utc),
        ),
        User(
            phone="9829010587",
            name="Sunita Sharma (Ishita's Parent)",
            role="PARENT",
            student_id="STU-0587",
            preferred_lang="hi",
            dpdp_consent_given=True,
            dpdp_consent_timestamp=datetime(2026, 4, 1, 11, 30, tzinfo=timezone.utc),
        ),
        User(
            phone="9829010219",
            name="Mahendra Gurjar (Mohit's Parent)",
            role="PARENT",
            student_id="STU-0219",
            preferred_lang="hi",
            dpdp_consent_given=True,
            dpdp_consent_timestamp=datetime(2026, 4, 2, 9, 15, tzinfo=timezone.utc),
        ),
        User(
            phone="9829000001",
            name="Vikram Khandelwal (Accounts Executive)",
            role="ACCOUNTS",
            student_id=None,
            preferred_lang="en",
            dpdp_consent_given=True,
        ),
        User(
            phone="9829000002",
            name="Dr. Neha Verma (Academic Counsellor)",
            role="COUNSELLOR",
            student_id=None,
            preferred_lang="en",
            dpdp_consent_given=True,
        ),
    ]
    for u in users:
        session.add(u)

    # 3. Seed Instalments & Historical Payment Receipts
    seq_counter = 0

    def add_instalment_with_receipt(
        student_id: str,
        instalment_no: int,
        due_date: date,
        amount_due: int,
        amount_paid: int,
        status: str,
        paid_date: date | None = None,
    ) -> Instalment:
        nonlocal seq_counter
        receipt_no = None
        paid_dt = None
        if amount_paid > 0:
            seq_counter += 1
            receipt_no = f"JPR-{FINANCIAL_YEAR_CODE}-{seq_counter:04d}"
            paid_dt = datetime.combine(paid_date or due_date, datetime.min.time(), tzinfo=timezone.utc)

        inst = Instalment(
            student_id=student_id,
            instalment_no=instalment_no,
            due_date=due_date,
            amount_due=amount_due,
            amount_paid=amount_paid,
            status=status,
            paid_at=paid_dt,
            latest_receipt_no=receipt_no,
        )
        session.add(inst)
        session.flush()

        if amount_paid > 0 and receipt_no and inst.id is not None:
            base, cgst, sgst = _exact_gst_parts(amount_paid)
            session.add(
                PaymentRecord(
                    instalment_id=inst.id,
                    student_id=student_id,
                    amount=amount_paid,
                    base_amount=base,
                    cgst_amount=cgst,
                    sgst_amount=sgst,
                    gst_receipt_no=receipt_no,
                    idempotency_key=f"seed-pay-{student_id}-{instalment_no}",
                    payment_mode="UPI",
                    created_at=paid_dt or datetime(2026, 10, 10, 14, 0, tzinfo=timezone.utc),
                )
            )
        return inst

    # STU-0412 Aarav Meena: 4 x 30,000 (First 3 PAID = 90,000 paid)
    add_instalment_with_receipt("STU-0412", 1, date(2026, 4, 10), 30000, 30000, "PAID")
    add_instalment_with_receipt("STU-0412", 2, date(2026, 7, 10), 30000, 30000, "PAID")
    aarav_inst3 = add_instalment_with_receipt("STU-0412", 3, date(2026, 10, 10), 30000, 30000, "PAID")
    add_instalment_with_receipt("STU-0412", 4, date(2027, 1, 10), 30000, 0, "UPCOMING")

    # STU-0587 Ishita Sharma: 4 x 30,000 (Inst 1 & 2 PAID, Inst 3 due 2026-10-10 has 15,000 paid -> 75,000 total paid)
    add_instalment_with_receipt("STU-0587", 1, date(2026, 4, 10), 30000, 30000, "PAID")
    add_instalment_with_receipt("STU-0587", 2, date(2026, 7, 10), 30000, 30000, "PAID")
    ishita_inst3 = add_instalment_with_receipt(
        "STU-0587", 3, date(2026, 10, 10), 30000, 15000, "PART_PAID_OVERDUE", date(2026, 10, 10)
    )
    add_instalment_with_receipt("STU-0587", 4, date(2027, 1, 10), 30000, 0, "UPCOMING")

    # STU-0219 Mohit Gurjar: 3 x 40,000 (Inst 1 & 2 PAID = 80,000, Inst 3 due 2026-11-15 UPCOMING)
    add_instalment_with_receipt("STU-0219", 1, date(2026, 4, 15), 40000, 40000, "PAID")
    add_instalment_with_receipt("STU-0219", 2, date(2026, 8, 1), 40000, 40000, "PAID")
    mohit_inst3 = add_instalment_with_receipt("STU-0219", 3, date(2026, 11, 15), 40000, 0, "UPCOMING")

    # STU-0641 Devansh Rathore: Inst 2 due 2026-08-15 (79 days overdue -> >60d ageing bucket)
    add_instalment_with_receipt("STU-0641", 1, date(2026, 4, 10), 30000, 30000, "PAID")
    devansh_inst2 = add_instalment_with_receipt("STU-0641", 2, date(2026, 8, 15), 30000, 0, "OVERDUE")
    add_instalment_with_receipt("STU-0641", 3, date(2026, 11, 15), 25000, 0, "UPCOMING")
    add_instalment_with_receipt("STU-0641", 4, date(2027, 1, 15), 25000, 0, "UPCOMING")

    # STU-0710 Priyanshi Joshi: Inst 3 due 2026-09-20 (43 days overdue -> 31-60d ageing bucket)
    add_instalment_with_receipt("STU-0710", 1, date(2026, 4, 10), 30000, 30000, "PAID")
    add_instalment_with_receipt("STU-0710", 2, date(2026, 7, 10), 30000, 30000, "PAID")
    priyanshi_inst3 = add_instalment_with_receipt("STU-0710", 3, date(2026, 9, 20), 30000, 0, "OVERDUE")
    add_instalment_with_receipt("STU-0710", 4, date(2027, 1, 10), 30000, 0, "UPCOMING")

    # STU-0804 Kunal Kachhwaha: 3 x 35,000
    add_instalment_with_receipt("STU-0804", 1, date(2026, 4, 10), 35000, 35000, "PAID")
    add_instalment_with_receipt("STU-0804", 2, date(2026, 8, 10), 35000, 35000, "PAID")
    add_instalment_with_receipt("STU-0804", 3, date(2026, 12, 10), 35000, 0, "UPCOMING")

    # Save ReceiptCounter state
    session.add(ReceiptCounter(financial_year=FINANCIAL_YEAR_CODE, last_seq=seq_counter))

    # 4. Seed Bilingual Reminder Logs (Before, On, After due date)
    reminders = [
        # Aarav Inst #3 (Paid on due date -> AFTER_7_DAYS was automatically STOPPED_ON_PAYMENT)
        ReminderLog(
            instalment_id=aarav_inst3.id,
            student_id="STU-0412",
            trigger_type="BEFORE_7_DAYS",
            scheduled_date=date(2026, 10, 3),
            message_en="Reminder: Instalment #3 of ₹30,000 for Aarav Meena (JEE 2027 Morning) is due on 10 Oct 2026.",
            message_hi="अनुस्मारक: आरव मीना (JEE 2027 Morning) की किस्त #3 (₹30,000) की देय तिथि 10 अक्टूबर 2026 है।",
            status="SENT",
        ),
        ReminderLog(
            instalment_id=aarav_inst3.id,
            student_id="STU-0412",
            trigger_type="AFTER_7_DAYS",
            scheduled_date=date(2026, 10, 17),
            message_en="Overdue Notice: Instalment #3 for Aarav Meena is past due.",
            message_hi="अतिदेय सूचना: आरव मीना की किस्त #3 बकाया है।",
            status="STOPPED_ON_PAYMENT",
            stopped_reason="Automatically stopped upon full payment receipt JPR-2627-0003",
        ),
        # Ishita Inst #3 (Part paid ₹15,000 -> ₹15,000 still overdue, follow-up reminder scheduled)
        ReminderLog(
            instalment_id=ishita_inst3.id,
            student_id="STU-0587",
            trigger_type="BEFORE_7_DAYS",
            scheduled_date=date(2026, 10, 3),
            message_en="Reminder: Instalment #3 of ₹30,000 for Ishita Sharma is due on 10 Oct 2026.",
            message_hi="अनुस्मारक: इशिता शर्मा की किस्त #3 (₹30,000) 10 अक्टूबर 2026 को देय है।",
            status="SENT",
        ),
        ReminderLog(
            instalment_id=ishita_inst3.id,
            student_id="STU-0587",
            trigger_type="ON_DUE_DATE",
            scheduled_date=date(2026, 10, 10),
            message_en="Due Today: Balance of ₹15,000 on Instalment #3 for Ishita Sharma is due today.",
            message_hi="आज देय: इशिता शर्मा की किस्त #3 की शेष राशि ₹15,000 आज देय है।",
            status="SENT",
        ),
        ReminderLog(
            instalment_id=ishita_inst3.id,
            student_id="STU-0587",
            trigger_type="AFTER_7_DAYS",
            scheduled_date=REFERENCE_DATE + timedelta(days=2),
            message_en="Overdue Follow-up: Remaining balance of ₹15,000 for Ishita Sharma (JEE 2027 Evening) is 23 days overdue. Pay via portal link.",
            message_hi="अतिदेय अनुस्मारक: इशिता शर्मा (JEE 2027 Evening) की शेष किस्त ₹15,000 (23 दिन अतिदेय) बकाया है। कृपया पोर्टल लिंक से भुगतान करें।",
            status="SCHEDULED",
        ),
        # Mohit Inst #3 (Due 2026-11-15 -> BEFORE_7_DAYS scheduled for 2026-11-08)
        ReminderLog(
            instalment_id=mohit_inst3.id,
            student_id="STU-0219",
            trigger_type="BEFORE_7_DAYS",
            scheduled_date=date(2026, 11, 8),
            message_en="Upcoming Due: Instalment #3 of ₹40,000 for Mohit Gurjar (NEET 2027 Morning) is due on 15 Nov 2026.",
            message_hi="आगामी किस्त: मोहित गुर्जर (NEET 2027 Morning) की किस्त #3 (₹40,000) 15 नवंबर 2026 को देय है।",
            status="SCHEDULED",
        ),
        ReminderLog(
            instalment_id=mohit_inst3.id,
            student_id="STU-0219",
            trigger_type="ON_DUE_DATE",
            scheduled_date=date(2026, 11, 15),
            message_en="Due Today: Instalment #3 of ₹40,000 for Mohit Gurjar is due today (15 Nov 2026).",
            message_hi="आज देय: मोहित गुर्जर की किस्त #3 (₹40,000) आज 15 नवंबर 2026 को देय है।",
            status="SCHEDULED",
        ),
    ]
    for r in reminders:
        session.add(r)

    # 5. Seed Unmatched Bank Transfers Queue (Accounts Guardrail Demo)
    session.add(
        UnmatchedPayment(
            utr_reference="UTR20261101998812",
            amount=15000,
            payer_phone="9414099999",
            raw_narration="NEFT/SHARMA ENTERPRISES/JAIPUR FEE",
            mismatch_reason="UNKNOWN_PHONE_OR_STUDENT",
            received_at=datetime(2026, 11, 1, 16, 40, tzinfo=timezone.utc),
            status="QUEUED",
        )
    )
    session.add(
        UnmatchedPayment(
            utr_reference="UTR20261102112233",
            amount=30000,
            payer_phone="9829010710",
            raw_narration="UPI/9829010710/NO-STUDENT-ID-IN-REMARK",
            mismatch_reason="MISSING_INSTALMENT_REFERENCE",
            received_at=datetime(2026, 11, 2, 9, 10, tzinfo=timezone.utc),
            status="QUEUED",
        )
    )

    session.commit()