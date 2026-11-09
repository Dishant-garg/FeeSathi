from app.routers.accounts import router as accounts_router
from app.routers.ai_risk import router as ai_risk_router
from app.routers.auth import router as auth_router
from app.routers.bulk_upload import router as bulk_upload_router
from app.routers.parent import router as parent_router
from app.routers.refunds import router as refunds_router
from app.routers.reminders import router as reminders_router
from app.routers.webhooks import router as webhooks_router

__all__ = [
    "accounts_router",
    "ai_risk_router",
    "auth_router",
    "bulk_upload_router",
    "parent_router",
    "refunds_router",
    "reminders_router",
    "webhooks_router",
]
