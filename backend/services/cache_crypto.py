"""
Cache Encryption Utility
========================
AES-128-CBC + HMAC (via Fernet) encryption for petition/complaint cache.

- Master key: CACHE_ENCRYPTION_KEY env var (Fernet 256-bit URL-safe base64).
- Each cache record gets a fresh per-record data key (DEK) derived via HKDF
  from the master key and a random 16-byte salt stored alongside the
  ciphertext. This provides forward-secrecy: leaking one record's key
  does not expose other records.
- Plaintext payload (dict) is JSON-serialized, then encrypted. Output is
  a dict {"v":1, "salt":..., "ct":...} stored directly in MongoDB.

If CACHE_ENCRYPTION_KEY is missing the module logs a CRITICAL error and
falls back to plaintext (so the app keeps working) — but ops must set it
in production.
"""
import base64
import json
import logging
import os
from typing import Any, Dict, Optional

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

logger = logging.getLogger(__name__)

_MASTER_KEY: Optional[bytes] = None
_FALLBACK_WARNED = False


def _load_master_key() -> Optional[bytes]:
    global _MASTER_KEY, _FALLBACK_WARNED
    if _MASTER_KEY is not None:
        return _MASTER_KEY
    raw = os.environ.get("CACHE_ENCRYPTION_KEY", "").strip()
    if not raw:
        if not _FALLBACK_WARNED:
            logger.critical(
                "CACHE_ENCRYPTION_KEY not set — petition/complaint cache will "
                "be stored in PLAINTEXT. Set CACHE_ENCRYPTION_KEY in backend/.env."
            )
            _FALLBACK_WARNED = True
        return None
    try:
        # Validate it's a usable Fernet key
        Fernet(raw.encode("utf-8"))
        _MASTER_KEY = raw.encode("utf-8")
        return _MASTER_KEY
    except Exception as e:
        logger.critical(f"CACHE_ENCRYPTION_KEY is invalid Fernet key: {e}")
        return None


def _derive_dek(master: bytes, salt: bytes) -> bytes:
    """Derive a per-record data encryption key from the master key + salt."""
    # master is base64-urlsafe; decode to raw 32 bytes for HKDF input
    master_raw = base64.urlsafe_b64decode(master)
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        info=b"nyaya-prahari-cache-v1",
    )
    derived = hkdf.derive(master_raw)
    # Fernet expects url-safe base64 of 32-byte key
    return base64.urlsafe_b64encode(derived)


def encrypt_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Encrypt a JSON-serializable payload. Returns a dict suitable for
    direct storage in MongoDB. Falls back to plaintext if no master key.
    """
    master = _load_master_key()
    plaintext = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
    if not master:
        return {"v": 0, "plaintext": payload}  # fallback (dev only)

    salt = os.urandom(16)
    dek = _derive_dek(master, salt)
    token = Fernet(dek).encrypt(plaintext)
    return {
        "v": 1,
        "salt": base64.b64encode(salt).decode("ascii"),
        "ct": token.decode("ascii"),
    }


def decrypt_payload(blob: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Decrypt a blob produced by encrypt_payload. Returns None on failure."""
    if not blob or not isinstance(blob, dict):
        return None
    if blob.get("v") == 0:
        return blob.get("plaintext")
    if blob.get("v") != 1:
        return None
    master = _load_master_key()
    if not master:
        logger.error("Cannot decrypt cache record — CACHE_ENCRYPTION_KEY missing")
        return None
    try:
        salt = base64.b64decode(blob["salt"])
        dek = _derive_dek(master, salt)
        plaintext = Fernet(dek).decrypt(blob["ct"].encode("ascii"))
        return json.loads(plaintext.decode("utf-8"))
    except InvalidToken:
        logger.error("Cache record decryption failed — wrong key or tampered ciphertext")
        return None
    except Exception as e:
        logger.error(f"Cache record decryption error: {e}")
        return None


def encryption_enabled() -> bool:
    return _load_master_key() is not None
