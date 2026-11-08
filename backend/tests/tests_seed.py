from datetime import date
from sqlmodel import SQLModel, Session, create_engine, select
from sqlmodel.pool import StaticPool

from app.config import REFERENCE_DATE
from app.models import Instalment, Student, UnmatchedPayment
from app.seed import seed_database


def get_memory_session() -> Session:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def test_seed_matches_prompt_sample_rows_and_reference_date():
    with get_memory_session() as session:
        seed_database(session)

        assert REFERENCE_DATE == date(2026, 11, 2)

        # 1. Verify STU-0412 Aarav Meena
        aarav_insts = session.exec(
            select(Instalment).where(Instalment.student_id == "STU-0412").order_by(Instalment.instalment_no)
        ).all()
        assert len(aarav_insts) == 4
        assert aarav_insts[2].due_date == date(2026, 10, 10)
        assert aarav_insts[2].amount_due == 30000
        assert aarav_insts[2].amount_paid == 30000
        assert aarav_insts[2].status == "PAID"
        assert sum(i.amount_paid for i in aarav_insts) == 90000

        # 2. Verify STU-0587 Ishita Sharma
        ishita_insts = session.exec(
            select(Instalment).where(Instalment.student_id == "STU-0587").order_by(Instalment.instalment_no)
        ).all()
        assert len(ishita_insts) == 4
        inst3 = ishita_insts[2]
        assert inst3.due_date == date(2026, 10, 10)
        assert inst3.amount_due == 30000
        assert inst3.amount_paid == 15000
        assert inst3.status == "PART_PAID_OVERDUE"
        assert (REFERENCE_DATE - inst3.due_date).days == 23
        assert sum(i.amount_paid for i in ishita_insts) == 75000

        # 3. Verify STU-0219 Mohit Gurjar
        mohit_insts = session.exec(
            select(Instalment).where(Instalment.student_id == "STU-0219").order_by(Instalment.instalment_no)
        ).all()
        assert len(mohit_insts) == 3
        m_inst3 = mohit_insts[2]
        assert m_inst3.due_date == date(2026, 11, 15)
        assert m_inst3.amount_due == 40000
        assert m_inst3.amount_paid == 0
        assert (m_inst3.due_date - REFERENCE_DATE).days == 13


def test_seed_is_idempotent():
    with get_memory_session() as session:
        seed_database(session)
        seed_database(session)  # Second call should be a no-op
        students = session.exec(select(Student)).all()
        unmatched = session.exec(select(UnmatchedPayment)).all()
        assert len(students) == 6
        assert len(unmatched) == 2
