"""
Document Generator Router - API endpoints for generating legal documents.
Charge Sheets, Case Diaries, Remand Reports, BSA 63 Certificates.
"""
from fastapi import APIRouter, HTTPException, Depends, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone
from typing import Optional
import os
import jwt
import logging

from services.document_generator import (
    generate_charge_sheet,
    generate_case_diary,
    generate_remand_report,
    generate_bsa_63_certificate
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["Document Generator"])
security = HTTPBearer()

# Database connection (will be set by main app)
db = None

JWT_SECRET = os.environ.get('JWT_SECRET', 'nyaya-prahari-secret-key-2025-secure')


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


@router.post("/{context_id}/charge-sheet")
async def generate_charge_sheet_endpoint(
    context_id: str,
    officer_id: str = Depends(get_current_officer)
):
    """
    Generate a Charge Sheet (Sec 193 BNSS) from Global Case Context.
    """
    ctx = await db.case_contexts.find_one(
        {"id": context_id, "created_by": officer_id},
        {"_id": 0}
    )
    
    if not ctx:
        raise HTTPException(status_code=404, detail="Case context not found")
    
    result = await generate_charge_sheet(ctx)
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Generation failed"))
    
    # Save generated document reference
    doc_record = {
        "context_id": context_id,
        "document_type": "charge_sheet",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "officer_id": officer_id,
        "fir_number": ctx.get("fir_number", "")
    }
    await db.generated_documents.insert_one(doc_record)
    
    return result


@router.post("/{context_id}/case-diary")
async def generate_case_diary_endpoint(
    context_id: str,
    entry_number: int = Form(default=1),
    investigation_progress: str = Form(default=""),
    officer_id: str = Depends(get_current_officer)
):
    """
    Generate a Case Diary Entry (Sec 172 BNSS) from Global Case Context.
    """
    ctx = await db.case_contexts.find_one(
        {"id": context_id, "created_by": officer_id},
        {"_id": 0}
    )
    
    if not ctx:
        raise HTTPException(status_code=404, detail="Case context not found")
    
    result = await generate_case_diary(ctx, entry_number, investigation_progress)
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Generation failed"))
    
    return result


@router.post("/{context_id}/remand-report")
async def generate_remand_report_endpoint(
    context_id: str,
    accused_serial: str = Form(...),
    grounds_for_remand: str = Form(default=""),
    officer_id: str = Depends(get_current_officer)
):
    """
    Generate a Remand Report for a specific accused.
    """
    ctx = await db.case_contexts.find_one(
        {"id": context_id, "created_by": officer_id},
        {"_id": 0}
    )
    
    if not ctx:
        raise HTTPException(status_code=404, detail="Case context not found")
    
    result = await generate_remand_report(ctx, accused_serial, grounds_for_remand)
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Generation failed"))
    
    return result


@router.post("/{context_id}/bsa-63-certificate")
async def generate_bsa_63_certificate_endpoint(
    context_id: str,
    evidence_id: str = Form(...),
    officer_id: str = Depends(get_current_officer)
):
    """
    Generate a BSA Section 63 Digital Evidence Certificate.
    """
    ctx = await db.case_contexts.find_one(
        {"id": context_id, "created_by": officer_id},
        {"_id": 0}
    )
    
    if not ctx:
        raise HTTPException(status_code=404, detail="Case context not found")
    
    result = await generate_bsa_63_certificate(ctx, evidence_id)
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Generation failed"))
    
    # Mark evidence as having BSA certificate
    await db.case_contexts.update_one(
        {"id": context_id, "evidence_items.id": evidence_id},
        {"$set": {"evidence_items.$.bsa_certificate_generated": True}}
    )
    
    return result


@router.get("/{context_id}/history")
async def get_document_history(
    context_id: str,
    officer_id: str = Depends(get_current_officer)
):
    """
    Get history of generated documents for a case context.
    """
    docs = await db.generated_documents.find(
        {"context_id": context_id, "officer_id": officer_id},
        {"_id": 0}
    ).to_list(100)
    
    return {"documents": docs}
