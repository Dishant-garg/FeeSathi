"""Clock utility for deterministic simulation and production time handling."""
import os
from datetime import date
from typing import Optional


def get_today(custom_date: Optional[date] = None) -> date:
    """
    Returns explicit custom_date if passed (useful in unit tests),
    or REFERENCE_DATE from environment if set,
    or falls back to real calendar date.today().
    """
    if custom_date:
        return custom_date
    env_ref = os.getenv("REFERENCE_DATE")
    if env_ref:
        return date.fromisoformat(env_ref)
    return date.today()
