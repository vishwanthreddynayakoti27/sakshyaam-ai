"""
Narration Generator API — exposes the curated keyword bank and the
deterministic narrative composer.

Endpoints (all under /api/narration/...):
  GET  /categories
  GET  /keywords?category=...&q=...
  POST /compose      (body: {selected_phrases, fir_number, police_station, io_name, ...})
"""
from __future__ import annotations

import os
from typing import List, Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from services.narration_generator import (
    KEYWORD_BANK,
    compose_narration,
    get_categories,
    get_keywords,
    total_keywords,
)

router = APIRouter(prefix="/narration", tags=["narration"])

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
security = HTTPBearer()


def _verify_token(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        return jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


# ─────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────
class KeywordItem(BaseModel):
    category: str
    keyword: str
    phrase: str


class ComposeRequest(BaseModel):
    selected_phrases: List[str] = Field(default_factory=list)
    fir_number: str = ""
    police_station: str = ""
    io_name: str = ""
    complainant_name: str = ""
    accused_names: List[str] = Field(default_factory=list)
    occurrence_dtp: str = ""
    sections: str = ""
    custom_intro: str = ""


class ComposeResponse(BaseModel):
    narration: str
    word_count: int


# ─────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────
@router.get("/categories")
async def list_categories(_: dict = Depends(_verify_token)):
    return {
        "categories": get_categories(),
        "total_keywords": total_keywords(),
        "keywords_by_category": {cat: len(items) for cat, items in KEYWORD_BANK.items()},
    }


@router.get("/keywords", response_model=List[KeywordItem])
async def list_keywords(
    category: Optional[str] = None,
    q: Optional[str] = None,
    _: dict = Depends(_verify_token),
):
    return get_keywords(category=category, query=q)


@router.post("/compose", response_model=ComposeResponse)
async def compose(req: ComposeRequest, _: dict = Depends(_verify_token)):
    text = compose_narration(
        selected_phrases=req.selected_phrases,
        fir_number=req.fir_number,
        police_station=req.police_station,
        io_name=req.io_name,
        complainant_name=req.complainant_name,
        accused_names=req.accused_names,
        occurrence_dtp=req.occurrence_dtp,
        sections=req.sections,
        custom_intro=req.custom_intro,
    )
    return ComposeResponse(narration=text, word_count=len(text.split()))
