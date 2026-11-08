import os
from datetime import date
from pathlib import Path

# Automatically load .env if python-dotenv is available
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    load_dotenv(dotenv_path=env_path)
except ImportError:
    pass


# Database
DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./coaching.db")

# Reference Date: defaults to 2026-11-02 for sample data / tests, overridable in .env
_ref_date_env = os.getenv("REFERENCE_DATE")
REFERENCE_DATE: date = date.fromisoformat(_ref_date_env) if _ref_date_env else date(2026, 11, 2)

# Academic Session Constants (Labelled Assumptions A2, A3, A4)
SESSION_START_DATE: date = date(2026, 4, 1)
SESSION_END_DATE: date = date(2027, 1, 25)
TOTAL_SESSION_DAYS: int = 300
NON_REFUNDABLE_REG_FEE: int = 1500
REFUND_SLA_DAYS: int = 10

# Fee Structure Defaults (Annual Fee ₹1,20,000)
ANNUAL_FEE_AMOUNT: int = 120000
DEFAULT_INSTALMENT_PLANS = {
    1: [120000],                      # Full payment (1-shot)
    2: [60000, 60000],                # Half & Half (2 instalments)
    3: [40000, 40000, 40000],         # 3 instalments
    4: [30000, 30000, 30000, 30000],  # 4 instalments
}


# Tax & Institute Metadata (Labelled Assumption A6)
INSTITUTE_NAME: str = "Sankalp Coaching Institute Pvt. Ltd., Jaipur"
INSTITUTE_GSTIN: str = "08AAACJ1234F1Z5"
FINANCIAL_YEAR_CODE: str = "2627"

# Centres in Jaipur (Labelled Assumption A15)
JAIPUR_CENTRES = [
    "Tonk Road",
    "Vaishali Nagar",
    "Malviya Nagar",
    "Mansarovar",
]

# Unified Counsellor False-Flag Dismissal Reasons (Labelled Assumption A10)
VALID_DISMISS_REASONS = {
    "MEDICAL_LEAVE",
    "FAMILY_EMERGENCY",
    "BATCH_TRANSFER",
    "FEE_EXTENSION_APPROVED",
    "DATA_ENTRY_ERROR",
}

# Security & Feature Flags
JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-only-jaipur-coaching-jwt-secret-key-2026")
JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))
WEBHOOK_SECRET: str = os.getenv("WEBHOOK_SECRET", "dev-webhook-secret-2026")
DEMO_MODE: bool = os.getenv("DEMO_MODE", "true").lower() == "true"
GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
