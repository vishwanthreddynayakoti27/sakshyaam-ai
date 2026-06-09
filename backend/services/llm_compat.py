"""
Drop-in compatibility shim for `emergentintegrations.llm.chat` that routes
EVERY call directly through the user's own OpenAI API key (gpt-4o by default
for both text and vision). No proxy, no Emergent.

Usage (existing code keeps working unchanged):
    from services.llm_compat import LlmChat, UserMessage, ImageContent

    chat = (LlmChat(api_key=<any>, session_id=..., system_message=...)
            .with_model("openai", "gpt-4o"))   # provider/model args are tolerated
                                                # but the SHIM always uses gpt-4o
                                                # via OPENAI_API_KEY env var
    resp = await chat.send_message(UserMessage(text="...",
                                                file_contents=[ImageContent(image_base64=...)]))

NOTES
-----
- `api_key` arg is intentionally IGNORED — we always read OPENAI_API_KEY
  from the environment, so legacy code passing `EMERGENT_LLM_KEY` keeps
  compiling but the call goes to the user's OpenAI account.
- `with_model("gemini", "gemini-2.5-pro")` and similar provider/model
  arguments are also ignored — every call uses
  `os.environ.get("OPENAI_DEFAULT_MODEL", "gpt-4o")` (or VISION_MODEL when an
  image is attached).
- `send_message` is async and returns the model's text content as a str,
  matching the original Emergent API.
- Retries with exponential backoff on 429 / 5xx transient errors.
- Errors surface as RuntimeError with a clean message (matches old behavior).
"""
from __future__ import annotations

import asyncio
import base64
import logging
import os
from dataclasses import dataclass, field
from typing import Any, List, Optional

from openai import AsyncOpenAI, APIConnectionError, APIError, RateLimitError

logger = logging.getLogger(__name__)

# Build one async client per process. The constructor will raise immediately
# if OPENAI_API_KEY is unset, which is exactly the fail-fast we want.
_OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
_OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL")  # optional, for Azure-style routing
_DEFAULT_MODEL = os.environ.get("OPENAI_DEFAULT_MODEL", "gpt-4o")
_VISION_MODEL = os.environ.get("OPENAI_VISION_MODEL", "gpt-4o")

if _OPENAI_API_KEY:
    _client_kwargs: dict[str, Any] = {"api_key": _OPENAI_API_KEY}
    if _OPENAI_BASE_URL:
        _client_kwargs["base_url"] = _OPENAI_BASE_URL
    _async_client = AsyncOpenAI(**_client_kwargs)
else:
    _async_client = None  # type: ignore[assignment]
    logger.error(
        "OPENAI_API_KEY is not set — every LLM call will fail until it is configured."
    )


# ─────────────────────────────────────────────────────────────────────
# Data classes matching the original Emergent surface
# ─────────────────────────────────────────────────────────────────────
@dataclass
class ImageContent:
    """An image attachment, base64-encoded (matches Emergent's API)."""
    image_base64: str
    mime_type: str = "image/jpeg"


@dataclass
class UserMessage:
    """A single user message, optionally with image attachments."""
    text: str = ""
    file_contents: List[ImageContent] = field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────
# LlmChat — main drop-in class
# ─────────────────────────────────────────────────────────────────────
class LlmChat:
    """Drop-in for emergentintegrations.llm.chat.LlmChat — routes to OpenAI direct."""

    # Class-level default kwargs that user can tune at runtime if needed
    _DEFAULT_TEMPERATURE = 0.2
    _DEFAULT_MAX_TOKENS = 4096

    def __init__(
        self,
        api_key: Optional[str] = None,  # ignored — we read OPENAI_API_KEY env var
        session_id: Optional[str] = None,
        system_message: Optional[str] = None,
    ) -> None:
        # api_key is INTENTIONALLY ignored — kept for signature compatibility
        del api_key
        self.session_id = session_id or ""
        self.system_message = (system_message or "").strip()
        self._model = _DEFAULT_MODEL
        self._temperature: float = self._DEFAULT_TEMPERATURE
        self._max_tokens: int = self._DEFAULT_MAX_TOKENS

    # The original Emergent API uses .with_model("provider", "model") and
    # returns self for chaining. We keep the signature but always normalize
    # to a known OpenAI text/vision model — provider arg is ignored.
    def with_model(self, provider: str, model: str) -> "LlmChat":  # noqa: ARG002
        # Accept any provider/model string. If the requested name looks like
        # an OpenAI model (gpt-*), honor it. Otherwise default to gpt-4o.
        if isinstance(model, str) and model.lower().startswith(("gpt-", "o1", "o3", "o4")):
            self._model = model
        else:
            self._model = _DEFAULT_MODEL
        return self

    # Tuning helpers (no-op when called from old code — preserved for future use)
    def with_temperature(self, temperature: float) -> "LlmChat":
        self._temperature = float(temperature)
        return self

    def with_max_tokens(self, max_tokens: int) -> "LlmChat":
        self._max_tokens = int(max_tokens)
        return self

    # ─────────────────────────────────────────────────────────────────
    # send_message — the main RPC
    # ─────────────────────────────────────────────────────────────────
    async def send_message(self, msg: UserMessage) -> str:
        if _async_client is None:
            raise RuntimeError(
                "OPENAI_API_KEY is not configured in the backend. "
                "Set it in /app/backend/.env and restart the backend."
            )
        if not isinstance(msg, UserMessage):
            raise TypeError("send_message expects a UserMessage")

        # Build OpenAI Chat Completions message list
        messages: List[dict[str, Any]] = []
        if self.system_message:
            messages.append({"role": "system", "content": self.system_message})

        # If there are images, switch to multimodal content array
        user_content: Any
        if msg.file_contents:
            parts: List[dict[str, Any]] = []
            if msg.text:
                parts.append({"type": "text", "text": msg.text})
            for img in msg.file_contents:
                if not isinstance(img, ImageContent):
                    raise TypeError("file_contents entries must be ImageContent")
                # Some legacy code passes raw bytes mistakenly — accept those too
                if isinstance(img.image_base64, (bytes, bytearray)):
                    b64 = base64.b64encode(img.image_base64).decode()
                else:
                    b64 = img.image_base64
                parts.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:{img.mime_type};base64,{b64}"},
                })
            user_content = parts
            model_to_use = _VISION_MODEL
        else:
            user_content = msg.text
            model_to_use = self._model

        messages.append({"role": "user", "content": user_content})

        # Call with exponential-backoff retry on transient errors
        attempt = 0
        max_attempts = 4
        last_err: Optional[Exception] = None
        while attempt < max_attempts:
            try:
                resp = await _async_client.chat.completions.create(
                    model=model_to_use,
                    messages=messages,
                    temperature=self._temperature,
                    max_tokens=self._max_tokens,
                )
                content = resp.choices[0].message.content if resp.choices else ""
                return (content or "").strip()
            except RateLimitError as e:
                last_err = e
                wait = 0.6 * (2 ** attempt)
                logger.warning(f"OpenAI 429 rate-limit (attempt {attempt+1}); retrying in {wait:.1f}s")
                await asyncio.sleep(wait)
            except (APIConnectionError, APIError) as e:
                last_err = e
                # Retry only on 5xx-like server errors
                status = getattr(e, "status_code", None) or getattr(e, "http_status", None)
                if status is None or (isinstance(status, int) and status >= 500):
                    wait = 0.6 * (2 ** attempt)
                    logger.warning(f"OpenAI transient error ({e!s}); retry in {wait:.1f}s")
                    await asyncio.sleep(wait)
                else:
                    raise RuntimeError(f"OpenAI API error: {e!s}") from e
            attempt += 1

        raise RuntimeError(
            f"OpenAI request failed after {max_attempts} attempts: {last_err!s}"
        )


# ─────────────────────────────────────────────────────────────────────
# Structured-output helper for the deterministic Triple-Fusion pipeline
# ─────────────────────────────────────────────────────────────────────
async def extract_structured(
    *,
    system_prompt: str,
    user_prompt: str,
    json_schema: dict,
    schema_name: str = "case_fields",
    model: Optional[str] = None,
    temperature: float = 0.1,
    max_tokens: int = 4096,
) -> dict:
    """
    Call OpenAI with Structured Outputs (JSON Schema enforced) and return a
    validated dict. Used by Triple Fusion to extract structured case data
    from Azure-OCR'd files for the deterministic .docx renderer.
    """
    if _async_client is None:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    resp = await _async_client.chat.completions.create(
        model=model or _DEFAULT_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": schema_name,
                "schema": json_schema,
                "strict": True,
            },
        },
        temperature=temperature,
        max_tokens=max_tokens,
    )
    import json as _json
    raw = resp.choices[0].message.content if resp.choices else "{}"
    return _json.loads(raw or "{}")
