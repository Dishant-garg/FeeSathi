from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlmodel import Session, select

from app.config import INSTITUTE_NAME, JAIPUR_CENTRES, REFERENCE_DATE
from app.database import get_session
from app.models import Instalment, PaymentRecord, Student, UnmatchedPayment, User
from app.services.ai_risk_service import evaluate_student_risk
from app.services.auth_service import require_roles
from app.utils.serializers import build_student_ledger_payload

router = APIRouter()


@router.get("/accounts/dashboard")
def get_accounts_dashboard(
    centre: Optional[str] = Query(default=None),
    batch: Optional[str] = Query(default=None),
    current_user: User = Depends(require_roles("ACCOUNTS", "COUNSELLOR")),
    session: Session = Depends(get_session),
):
    students = session.exec(select(Student)).all()
    if centre and centre != "ALL":
        students = [s for s in students if s.centre == centre]
    if batch and batch != "ALL":
        students = [s for s in students if s.batch == batch]

    total_billed = 0
    total_collected = 0
    matured_instalment_value = 0
    bucket_0_30 = 0
    bucket_31_60 = 0
    bucket_over_60 = 0

    student_rows = []
    for s in students:
        insts = session.exec(
            select(Instalment)
            .where(Instalment.student_id == s.id)
            .order_by(Instalment.instalment_no)
        ).all()
        s_paid = sum(i.amount_paid for i in insts)
        s_overdue_balance = 0
        s_max_days_overdue = 0
        next_due_date = None

        total_billed += s.net_annual_fee
        total_collected += s_paid

        for i in insts:
            if i.status == "CANCELLED_WITHDRAWN":
                continue
            rem = max(0, i.amount_due - i.amount_paid)
            if i.due_date <= REFERENCE_DATE:
                matured_instalment_value += i.amount_due
            if rem > 0 and i.due_date < REFERENCE_DATE:
                days_late = (REFERENCE_DATE - i.due_date).days
                s_overdue_balance += rem
                s_max_days_overdue = max(s_max_days_overdue, days_late)
                if days_late <= 30:
                    bucket_0_30 += rem
                elif days_late <= 60:
                    bucket_31_60 += rem
                else:
                    bucket_over_60 += rem
            elif rem > 0 and next_due_date is None:
                next_due_date = i.due_date.isoformat()

        student_rows.append(
            {
                "student_id": s.id,
                "name": s.name,
                "centre": s.centre,
                "batch": s.batch,
                "status": s.status,
                "net_annual_fee": s.net_annual_fee,
                "total_paid": s_paid,
                "total_balance": max(0, s.net_annual_fee - s_paid),
                "overdue_balance": s_overdue_balance,
                "max_days_overdue": s_max_days_overdue,
                "next_due_date": next_due_date,
                "attendance_pct": s.attendance_pct,
            }
        )

    over_60_pct = (
        round((bucket_over_60 / matured_instalment_value) * 100.0, 2)
        if matured_instalment_value > 0
        else 0.0
    )

    unmatched_queued = session.exec(
        select(UnmatchedPayment).where(UnmatchedPayment.status == "QUEUED")
    ).all()

    all_students = session.exec(select(Student)).all()
    available_batches = sorted({s.batch for s in all_students})

    return {
        "reference_date": REFERENCE_DATE.isoformat(),
        "filters": {
            "available_centres": JAIPUR_CENTRES,
            "available_batches": available_batches,
            "selected_centre": centre or "ALL",
            "selected_batch": batch or "ALL",
        },
        "kpis": {
            "total_billed_inr": total_billed,
            "total_collected_inr": total_collected,
            "total_outstanding_inr": max(0, total_billed - total_collected),
            "matured_instalment_value_inr": matured_instalment_value,
            "ageing_0_30_inr": bucket_0_30,
            "ageing_31_60_inr": bucket_31_60,
            "ageing_over_60_inr": bucket_over_60,
            "over_60_days_pct": over_60_pct,
            "target_over_60_days_pct": 6.0,
            "unmatched_queue_count": len(unmatched_queued),
            "unmatched_queue_inr": sum(u.amount for u in unmatched_queued),
        },
        "students": student_rows,
    }


@router.get("/accounts/students/{student_id}")
def get_student_ledger_for_accounts(
    student_id: str,
    current_user: User = Depends(require_roles("ACCOUNTS", "COUNSELLOR")),
    session: Session = Depends(get_session),
):
    student = session.get(Student, student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")

    ledger = build_student_ledger_payload(session, student, as_of=REFERENCE_DATE)
    ledger["ai_risk"] = evaluate_student_risk(session, student, as_of=REFERENCE_DATE)
    return ledger


@router.get("/accounts/export-tally")
def export_tally_xml(
    current_user: User = Depends(require_roles("ACCOUNTS")),
    session: Session = Depends(get_session),
):
    payments = session.exec(
        select(PaymentRecord).order_by(PaymentRecord.id)
    ).all()

    vouchers_xml = []
    for p in payments:
        student = session.get(Student, p.student_id)
        s_name = student.name if student else p.student_id
        centre = student.centre if student else "Jaipur"
        date_str = p.created_at.strftime("%Y%m%d")
        vouchers_xml.append(
            f"""      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Receipt" ACTION="Create">
          <DATE>{date_str}</DATE>
          <VOUCHERNUMBER>{p.gst_receipt_no}</VOUCHERNUMBER>
          <PARTYLEDGERNAME>{s_name} ({p.student_id})</PARTYLEDGERNAME>
          <NARRATION>Coaching Fee Receipt {p.gst_receipt_no} | Centre: {centre} | Mode: {p.payment_mode}</NARRATION>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Tuition Fee Base</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>{p.base_amount:.2f}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>CGST Output 9%</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>{p.cgst_amount:.2f}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>SGST Output 9%</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>{p.sgst_amount:.2f}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Bank Account ({p.payment_mode})</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>-{p.amount:.2f}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
        </VOUCHER>
      </TALLYMESSAGE>"""
        )

    xml_body = f"""<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>{INSTITUTE_NAME}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
{chr(10).join(vouchers_xml)}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>"""

    return Response(
        content=xml_body,
        media_type="application/xml",
        headers={
            "Content-Disposition": 'attachment; filename="jaipur_coaching_tally_vouchers.xml"'
        },
    )
