"""
Test encrypted cache for petition/complaint translation.
Verifies:
  1. Plaintext is NEVER stored in MongoDB document_cache collection.
  2. Cache MISS -> SET -> HIT flow returns correct decrypted result.
  3. Tampering with ciphertext makes the record unreadable (security).
  4. Cache stats expose encryption_enabled=True.
"""
import asyncio
import os
import sys

sys.path.insert(0, "/app/backend")

from services.document_cache import (
    get_cached_result,
    set_cached_result,
    get_cache_stats,
    generate_cache_key,
)
from services.cache_crypto import encryption_enabled
from motor.motor_asyncio import AsyncIOMotorClient


PETITION_TEXT = (
    "I am Y. Bhagya Lakshmi Reddy, complainant. On 15.04.2026 at about 21:00 hrs, "
    "the accused Ramesh Kumar S/o Suresh of Makthal village did beat me with a stick "
    "causing grievous injuries. He also threatened me saying he will kill my family. "
    "I am submitting this complaint and request the SHO Makthal PS to register an FIR "
    "and take immediate legal action under appropriate sections of BNS."
)

EXPECTED_TRANSLATION = {
    "success": True,
    "translated_text": "[FORMAL ENGLISH TRANSLATION]",
    "legal_text": "[FORMAL ENGLISH TRANSLATION]",
    "source_language": "te",
}


async def main():
    assert encryption_enabled(), "CACHE_ENCRYPTION_KEY must be set in .env"
    print("[OK] encryption_enabled = True")

    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "test_database")]
    cache_key = generate_cache_key(PETITION_TEXT, "translation")

    # Clean previous record
    await db.document_cache.delete_one({"cache_key": cache_key})

    # 1. MISS
    miss = await get_cached_result(PETITION_TEXT, "translation")
    assert miss is None, "Expected cache miss, got hit"
    print("[OK] Initial cache MISS")

    # 2. SET
    ok = await set_cached_result(PETITION_TEXT, "translation", EXPECTED_TRANSLATION, "te")
    assert ok, "set_cached_result returned False"
    print("[OK] set_cached_result succeeded")

    # 3. Verify raw record in DB has NO plaintext
    raw = await db.document_cache.find_one({"cache_key": cache_key})
    assert raw is not None, "Record not in DB"
    raw_str = str(raw)
    assert "Bhagya Lakshmi" not in raw_str, "PLAINTEXT NAME LEAKED in MongoDB!"
    assert "Ramesh Kumar" not in raw_str, "PLAINTEXT ACCUSED NAME LEAKED!"
    assert "Makthal" not in raw_str, "PLAINTEXT LOCATION LEAKED!"
    assert "FORMAL ENGLISH TRANSLATION" not in raw_str, "PLAINTEXT TRANSLATION LEAKED!"
    assert raw.get("encrypted") is True, "encrypted flag missing"
    assert "cached_data_enc" in raw, "Encrypted blob missing"
    assert raw["cached_data_enc"].get("v") == 1, "Wrong version"
    assert "ct" in raw["cached_data_enc"], "Ciphertext missing"
    assert "salt" in raw["cached_data_enc"], "Salt missing"
    print("[OK] MongoDB record contains ONLY ciphertext — no plaintext leakage")
    print(f"     ciphertext sample: {raw['cached_data_enc']['ct'][:60]}...")

    # 4. HIT — should decrypt correctly
    hit = await get_cached_result(PETITION_TEXT, "translation")
    assert hit == EXPECTED_TRANSLATION, f"Decrypted result mismatch: {hit}"
    print("[OK] Cache HIT — decrypted payload matches original")

    # 5. Tampering test — flip a byte in ciphertext, expect decryption to fail
    tampered_ct = raw["cached_data_enc"]["ct"][:-2] + "AA"
    await db.document_cache.update_one(
        {"cache_key": cache_key},
        {"$set": {"cached_data_enc.ct": tampered_ct}},
    )
    tampered = await get_cached_result(PETITION_TEXT, "translation")
    assert tampered is None, "Tampered ciphertext should NOT decrypt"
    print("[OK] Tampered ciphertext rejected (HMAC integrity check works)")

    # 6. Stats
    stats = await get_cache_stats()
    assert stats["encryption_enabled"] is True, "Stats should report encryption_enabled=True"
    assert "Fernet" in stats["encryption_algorithm"], "Algorithm name missing"
    print(f"[OK] Cache stats: {stats}")

    # Cleanup
    await db.document_cache.delete_one({"cache_key": cache_key})
    print("\nALL ENCRYPTION TESTS PASSED")


if __name__ == "__main__":
    asyncio.run(main())
