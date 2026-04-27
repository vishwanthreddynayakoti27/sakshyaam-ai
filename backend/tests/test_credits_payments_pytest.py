"""Pytest wrapper for credits/payments end-to-end test (auto-loads /app/backend/.env)."""
import asyncio
import os
import pathlib
import sys

from dotenv import load_dotenv

load_dotenv(pathlib.Path("/app/backend/.env"))
sys.path.insert(0, str(pathlib.Path(__file__).parent))


def test_credits_payments_full_flow():
    """Run the full credits + payments + admin grant integration script (14 sub-checks)."""
    from test_credits_payments import main  # type: ignore
    assert os.environ.get("MONGO_URL"), "MONGO_URL missing"
    asyncio.run(main())
