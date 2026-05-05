"""
Integration tests for the new Narration Generator router /api/narration/*

Endpoints tested:
  GET  /api/narration/categories
  GET  /api/narration/keywords?q=&category=
  POST /api/narration/compose
"""
import os
from pathlib import Path

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass

OFFICER = {"officer_id": "TEST001", "password": "Test123!"}


@pytest.fixture(scope="module")
def auth_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=OFFICER, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    token = r.json()["token"]
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


# ------- Auth ----------

def test_categories_unauth_returns_401():
    r = requests.get(f"{BASE_URL}/api/narration/categories", timeout=30)
    assert r.status_code in (401, 403)


def test_keywords_unauth_returns_401():
    r = requests.get(f"{BASE_URL}/api/narration/keywords", timeout=30)
    assert r.status_code in (401, 403)


def test_compose_unauth_returns_401():
    r = requests.post(
        f"{BASE_URL}/api/narration/compose",
        json={"selected_phrases": ["x"]},
        timeout=30,
    )
    assert r.status_code in (401, 403)


# ------- Categories ----------

def test_categories_returns_10_with_111_total(auth_session):
    r = auth_session.get(f"{BASE_URL}/api/narration/categories", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "categories" in data
    assert "total_keywords" in data
    assert "keywords_by_category" in data
    assert isinstance(data["categories"], list)
    assert len(data["categories"]) == 10, f"expected 10 categories, got {len(data['categories'])}"
    # total ~111 (per problem statement)
    assert data["total_keywords"] >= 100, f"total_keywords too low: {data['total_keywords']}"
    # spot check that critical categories exist
    cats = set(data["categories"])
    assert "Scene of Offence" in cats
    assert "Accused Handling" in cats
    assert "Closing Phrases" in cats


# ------- Keywords search ----------

def test_keywords_search_arrest(auth_session):
    r = auth_session.get(f"{BASE_URL}/api/narration/keywords", params={"q": "arrest"}, timeout=30)
    assert r.status_code == 200, r.text
    items = r.json()
    assert isinstance(items, list)
    assert len(items) >= 1, "no results for q=arrest"
    # every result must contain 'arrest' (case insensitive) in keyword OR phrase
    for it in items:
        combined = (it["keyword"] + " " + it["phrase"]).lower()
        assert "arrest" in combined


def test_keywords_filter_by_category_scene_of_offence(auth_session):
    r = auth_session.get(
        f"{BASE_URL}/api/narration/keywords",
        params={"category": "Scene of Offence"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    items = r.json()
    assert len(items) >= 10, f"expected >=10 phrases in Scene of Offence, got {len(items)}"
    for it in items:
        assert it["category"] == "Scene of Offence"
        assert "phrase" in it and it["phrase"]


def test_keywords_unknown_category_returns_empty(auth_session):
    r = auth_session.get(
        f"{BASE_URL}/api/narration/keywords",
        params={"category": "NotARealCategoryXYZ"},
        timeout=30,
    )
    assert r.status_code == 200
    assert r.json() == []


# ------- Compose ----------

def test_compose_two_phrases_present_in_output(auth_session):
    p1 = "An FIR was registered on the basis of the complaint received from the complainant."
    p2 = "The accused was arrested as per procedure."
    payload = {
        "selected_phrases": [p1, p2],
        "fir_number": "TEST/77/2026",
        "police_station": "Makthal",
        "io_name": "Y. Bhagya Lakshmi",
    }
    r = auth_session.post(f"{BASE_URL}/api/narration/compose", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "narration" in body
    assert "word_count" in body
    text = body["narration"]
    assert p1 in text, "first phrase missing"
    assert p2 in text, "second phrase missing"
    # case meta should have been stitched in
    assert "Makthal" in text
    assert "TEST/77/2026" in text
    assert "Bhagya Lakshmi" in text
    assert isinstance(body["word_count"], int)
    assert body["word_count"] == len(text.split())


def test_compose_empty_phrases_still_returns_200(auth_session):
    r = auth_session.post(
        f"{BASE_URL}/api/narration/compose",
        json={"selected_phrases": [], "fir_number": "1/26", "police_station": "PS"},
        timeout=30,
    )
    assert r.status_code == 200
    body = r.json()
    assert "narration" in body
    assert "PS" in body["narration"]
