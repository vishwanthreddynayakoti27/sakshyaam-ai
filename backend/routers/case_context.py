"""
Case Context Router - API endpoints for Global Case Context management.
Handles CRUD operations and CCTNS export.
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from typing import List, Optional
import os
import jwt
import logging

from models.case_context import (
    GlobalCaseContext, CaseContextCreate, CaseContextUpdate,
    AccusedPerson, WitnessPerson, EvidenceItem, CaseDiaryEntry,
    CCTNSExportData
)
from services.legal_llm import process_petition, translate_to_legal_english, extract_entities, suggest_bns_sections

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/case-context", tags=["Case Context"])
security = HTTPBearer()

# Database connection (will be set by main app)
db = None

JWT_SECRET = os.environ['JWT_SECRET']


def set_database(database):
    """Set the database connection from main app"""
    global db
    db = database


async def get_current_officer(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Verify JWT token and return officer_id"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload['officer_id']
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/create", response_model=GlobalCaseContext)
async def create_case_context(
    data: CaseContextCreate,
    officer_id: str = Depends(get_current_officer)
):
    """Create a new Global Case Context"""
    context = GlobalCaseContext(
        fir_number=data.fir_number,
        police_station=data.police_station,
        district=data.district,
        offense_type=data.offense_type,
        created_by=officer_id
    )
    
    doc = context.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.case_contexts.insert_one(doc)
    
    return context


@router.get("/list", response_model=List[GlobalCaseContext])
async def list_case_contexts(
    status: Optional[str] = None,
    officer_id: str = Depends(get_current_officer)
):
    """List all case contexts for the current officer"""
    query = {"created_by": officer_id}
    if status:
        query["status"] = status
    
    contexts = await db.case_contexts.find(query, {"_id": 0}).to_list(100)
    
    for ctx in contexts:
        if isinstance(ctx.get('created_at'), str):
            ctx['created_at'] = datetime.fromisoformat(ctx['created_at'])
        if isinstance(ctx.get('updated_at'), str):
            ctx['updated_at'] = datetime.fromisoformat(ctx['updated_at'])
    
    return contexts


@router.get("/{context_id}", response_model=GlobalCaseContext)
async def get_case_context(
    context_id: str,
    officer_id: str = Depends(get_current_officer)
):
    """Get a specific case context by ID"""
    ctx = await db.case_contexts.find_one(
        {"id": context_id, "created_by": officer_id},
        {"_id": 0}
    )
    
    if not ctx:
        raise HTTPException(status_code=404, detail="Case context not found")
    
    if isinstance(ctx.get('created_at'), str):
        ctx['created_at'] = datetime.fromisoformat(ctx['created_at'])
    if isinstance(ctx.get('updated_at'), str):
        ctx['updated_at'] = datetime.fromisoformat(ctx['updated_at'])
    
    return GlobalCaseContext(**ctx)


@router.put("/{context_id}", response_model=GlobalCaseContext)
async def update_case_context(
    context_id: str,
    data: CaseContextUpdate,
    officer_id: str = Depends(get_current_officer)
):
    """Update a case context"""
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    result = await db.case_contexts.update_one(
        {"id": context_id, "created_by": officer_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Case context not found")
    
    return await get_case_context(context_id, officer_id)


@router.post("/{context_id}/process-petition")
async def process_petition_endpoint(
    context_id: str,
    text: str = Form(...),
    source_language: str = Form(default="auto"),
    officer_id: str = Depends(get_current_officer)
):
    """
    Process a petition/complaint text:
    1. Translate to legal English
    2. Extract entities
    3. Suggest BNS sections
    4. Update the case context with extracted data
    """
    # Verify context exists
    ctx = await db.case_contexts.find_one(
        {"id": context_id, "created_by": officer_id},
        {"_id": 0}
    )
    if not ctx:
        raise HTTPException(status_code=404, detail="Case context not found")
    
    # Process petition
    result = await process_petition(text, source_language)
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail="Petition processing failed")
    
    # Update context with extracted data
    update_data = {
        "brief_facts": result["original_text"],
        "translated_facts": result.get("translated_text", ""),
        "legal_facts": result.get("legal_text", ""),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Extract entities and map to context
    entities = result.get("entities", {})
    
    if entities.get("complainant"):
        comp = entities["complainant"]
        update_data["complainant_name"] = comp.get("name", "")
        update_data["complainant_father_name"] = comp.get("father_name", "")
        update_data["complainant_age"] = comp.get("age")
        update_data["complainant_caste"] = comp.get("caste", "")
        update_data["complainant_occupation"] = comp.get("occupation", "")
        update_data["complainant_address"] = comp.get("address", "")
        update_data["complainant_phone"] = comp.get("phone", "")
    
    if entities.get("accused_persons"):
        accused_list = []
        for i, acc in enumerate(entities["accused_persons"]):
            accused_list.append(AccusedPerson(
                serial=acc.get("serial", f"A{i+1}"),
                name=acc.get("name", ""),
                father_name=acc.get("father_name", ""),
                age=acc.get("age"),
                caste=acc.get("caste", ""),
                occupation=acc.get("occupation", ""),
                address=acc.get("address", ""),
                phone=acc.get("phone", "")
            ).model_dump())
        update_data["accused_persons"] = accused_list
    
    if entities.get("offense_details"):
        offense = entities["offense_details"]
        update_data["offense_type"] = offense.get("type", "")
        update_data["date_of_offense"] = offense.get("date", "")
        update_data["time_of_offense"] = offense.get("time", "")
        update_data["place_of_offense"] = offense.get("place", "")
    
    if entities.get("sections_of_law"):
        update_data["sections_of_law"] = entities["sections_of_law"]
    
    if entities.get("property_details"):
        prop = entities["property_details"]
        update_data["property_lost"] = prop.get("lost", "")
        update_data["property_recovered"] = prop.get("recovered", "")
    
    # Update the context
    await db.case_contexts.update_one(
        {"id": context_id},
        {"$set": update_data}
    )
    
    return {
        "success": True,
        "message": "Petition processed and context updated",
        "translation": result.get("translated_text", ""),
        "legal_text": result.get("legal_text", ""),
        "entities": entities,
        "suggested_sections": result.get("suggested_sections", [])
    }


@router.post("/{context_id}/add-accused")
async def add_accused_person(
    context_id: str,
    accused: AccusedPerson,
    officer_id: str = Depends(get_current_officer)
):
    """Add an accused person to the case context"""
    result = await db.case_contexts.update_one(
        {"id": context_id, "created_by": officer_id},
        {
            "$push": {"accused_persons": accused.model_dump()},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Case context not found")
    
    return {"success": True, "message": f"Accused {accused.serial} added"}


@router.post("/{context_id}/add-witness")
async def add_witness(
    context_id: str,
    witness: WitnessPerson,
    officer_id: str = Depends(get_current_officer)
):
    """Add a witness to the case context"""
    result = await db.case_contexts.update_one(
        {"id": context_id, "created_by": officer_id},
        {
            "$push": {"witnesses": witness.model_dump()},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Case context not found")
    
    return {"success": True, "message": f"Witness {witness.serial} added"}


@router.post("/{context_id}/add-evidence")
async def add_evidence(
    context_id: str,
    evidence: EvidenceItem,
    officer_id: str = Depends(get_current_officer)
):
    """Add evidence item to the case context"""
    result = await db.case_contexts.update_one(
        {"id": context_id, "created_by": officer_id},
        {
            "$push": {"evidence_items": evidence.model_dump()},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Case context not found")
    
    return {"success": True, "message": "Evidence added", "evidence_id": evidence.id}


@router.post("/{context_id}/add-diary-entry")
async def add_case_diary_entry(
    context_id: str,
    entry: CaseDiaryEntry,
    officer_id: str = Depends(get_current_officer)
):
    """Add a case diary entry"""
    result = await db.case_contexts.update_one(
        {"id": context_id, "created_by": officer_id},
        {
            "$push": {"case_diary_entries": entry.model_dump()},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Case context not found")
    
    return {"success": True, "message": f"Case diary entry {entry.entry_number} added"}


@router.get("/{context_id}/export-cctns")
async def export_cctns_json(
    context_id: str,
    officer_id: str = Depends(get_current_officer)
):
    """
    Export case context as CCTNS-compatible JSON.
    This endpoint is designed for browser extension consumption.
    """
    ctx = await db.case_contexts.find_one(
        {"id": context_id, "created_by": officer_id},
        {"_id": 0}
    )
    
    if not ctx:
        raise HTTPException(status_code=404, detail="Case context not found")
    
    # Build CCTNS export structure
    cctns_data = {
        "fir_number": ctx.get("fir_number", ""),
        "police_station": ctx.get("police_station", ""),
        "district": ctx.get("district", ""),
        "date_of_fir": ctx.get("date_of_fir", ""),
        "sections": ctx.get("sections_of_law", []),
        "date_of_offense": ctx.get("date_of_offense", ""),
        "time_of_offense": ctx.get("time_of_offense", ""),
        "place_of_offense": ctx.get("place_of_offense", ""),
        "complainant": {
            "name": ctx.get("complainant_name", ""),
            "father_name": ctx.get("complainant_father_name", ""),
            "age": ctx.get("complainant_age"),
            "caste": ctx.get("complainant_caste", ""),
            "occupation": ctx.get("complainant_occupation", ""),
            "address": ctx.get("complainant_address", ""),
            "phone": ctx.get("complainant_phone", "")
        },
        "accused": [
            {
                "serial": acc.get("serial", ""),
                "name": acc.get("name", ""),
                "father_name": acc.get("father_name", ""),
                "age": acc.get("age"),
                "caste": acc.get("caste", ""),
                "occupation": acc.get("occupation", ""),
                "address": acc.get("address", ""),
                "phone": acc.get("phone", ""),
                "status": acc.get("status", "At Large")
            }
            for acc in ctx.get("accused_persons", [])
        ],
        "witnesses": [
            {
                "serial": wit.get("serial", ""),
                "name": wit.get("name", ""),
                "father_name": wit.get("father_name", ""),
                "age": wit.get("age"),
                "caste": wit.get("caste", ""),
                "occupation": wit.get("occupation", ""),
                "address": wit.get("address", ""),
                "phone": wit.get("phone", ""),
                "role": wit.get("role", "")
            }
            for wit in ctx.get("witnesses", [])
        ],
        "brief_facts": ctx.get("legal_facts", "") or ctx.get("translated_facts", "") or ctx.get("brief_facts", ""),
        "property_details": ctx.get("property_lost", ""),
        "investigating_officer": {
            "name": ctx.get("investigating_officer", ""),
            "rank": ctx.get("io_rank", ""),
            "phone": ctx.get("io_phone", "")
        },
        "status": ctx.get("status", ""),
        "evidence_count": len(ctx.get("evidence_items", [])),
        "case_diary_entries": len(ctx.get("case_diary_entries", []))
    }
    
    return cctns_data


@router.post("/{context_id}/suggest-sections")
async def suggest_sections(
    context_id: str,
    officer_id: str = Depends(get_current_officer)
):
    """Get BNS/BNSS/BSA section suggestions based on case facts"""
    ctx = await db.case_contexts.find_one(
        {"id": context_id, "created_by": officer_id},
        {"_id": 0}
    )
    
    if not ctx:
        raise HTTPException(status_code=404, detail="Case context not found")
    
    facts = ctx.get("legal_facts", "") or ctx.get("translated_facts", "") or ctx.get("brief_facts", "")
    
    if not facts:
        raise HTTPException(status_code=400, detail="No case facts available for analysis")
    
    result = await suggest_bns_sections(facts)
    
    return {
        "success": result["success"],
        "suggested_sections": result.get("sections", []),
        "current_sections": ctx.get("sections_of_law", [])
    }
