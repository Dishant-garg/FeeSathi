import asyncio
import contextlib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from app.config import REFERENCE_DATE
from app.database import engine, init_db
from app.routers import (
    accounts_router,
    ai_risk_router,
    auth_router,
    bulk_upload_router,
    parent_router,
    refunds_router,
    reminders_router,
    webhooks_router,
)
from app.seed import seed_database
from app.services.ai_risk_service import sync_all_counsellor_tasks
from app.services.reminder_service import dispatch_due_reminders


async def _reminder_scheduler_loop() -> None:
    """
    Background loop that periodically dispatches due reminders and re-verifies
    payment status at send time (Requirement #6: automatic reminders).
    """
    while True:
        try:
            with Session(engine) as session:
                dispatch_due_reminders(session, as_of_date=REFERENCE_DATE)
        except Exception:
            pass
        await asyncio.sleep(60)


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize database schema
    init_db()
    # 2. Seed default data & compute baseline AI risk
    with Session(engine) as session:
        seed_database(session)
        sync_all_counsellor_tasks(session, as_of=REFERENCE_DATE)
    # 3. Launch background reminder scheduler
    scheduler_task = asyncio.create_task(_reminder_scheduler_loop())
    try:
        yield
    finally:
        scheduler_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await scheduler_task


app = FastAPI(
    title="FeeSathi — Coaching Fee Ledger, Refund & AI Risk API",
    description="Backend API for Company A, Jaipur: Fee schedules, parent portal, pro-rata refunds, and AI dropout risk.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "app": "FeeSathi API",
        "status": "online",
        "reference_date": REFERENCE_DATE.isoformat(),
        "docs_url": "/docs",
    }


# Register modular routers with clear Swagger tags
app.include_router(auth_router, prefix="/api", tags=["Authentication & Reviewer Switcher"])
app.include_router(parent_router, prefix="/api", tags=["Parent Portal & Payments"])
app.include_router(accounts_router, prefix="/api", tags=["Accounts Dashboard & Tally"])
app.include_router(refunds_router, prefix="/api", tags=["MoE 2024 Refunds"])
app.include_router(reminders_router, prefix="/api", tags=["Bilingual Reminders"])
app.include_router(ai_risk_router, prefix="/api", tags=["AI Dropout Risk & Counsellor"])
app.include_router(webhooks_router, prefix="/api", tags=["Bank Webhooks & Unmatched Queue"])
app.include_router(bulk_upload_router, prefix="/api", tags=["Bulk CSV Academic Upload"])
