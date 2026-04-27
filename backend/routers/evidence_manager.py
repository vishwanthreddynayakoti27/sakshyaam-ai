"""
Evidence Manager Router - Digital Evidence handling with SHA-256 hashing.
Integrates with Global Case Context for automatic data pulling.
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone
from typing import Optional, List
import os
import jwt
import hashlib
import logging
import uuid
import base64

from models.case_context import EvidenceItem

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/evidence", tags=["Evidence Manager"])
security = HTTPBearer()

# Database connection (will be set by main app)
db = None

JWT_SECRET = os.environ['JWT_SECRET']

# Local storage for evidence files
EVIDENCE_STORAGE_PATH = "/app/backend/evidence_files"


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


def compute_sha256(file_content: bytes) -> str:
    """Compute SHA-256 hash of file content"""
    return hashlib.sha256(file_content).hexdigest()


@router.post("/upload")
async def upload_evidence(
    context_id: str = Form(...),
    file: UploadFile = File(...),
    description: str = Form(default=""),
    seized_from: str = Form(default=""),
    seizure_date: str = Form(default=""),
    officer_id: str = Depends(get_current_officer)
):
    """
    Upload digital evidence and compute SHA-256 hash.
    Automatically links to Global Case Context.
    """
    # Verify context exists
    ctx = await db.case_contexts.find_one(
        {"id": context_id, "created_by": officer_id},
        {"_id": 0}
    )
    
    if not ctx:
        raise HTTPException(status_code=404, detail="Case context not found")
    
    try:
        # Read file content
        file_content = await file.read()
        
        # Compute SHA-256 hash
        sha256_hash = compute_sha256(file_content)
        
        # Get file type
        file_type = file.content_type or "application/octet-stream"
        
        # Create evidence item
        evidence_id = str(uuid.uuid4())
        evidence = EvidenceItem(
            id=evidence_id,
            file_name=file.filename,
            file_type=file_type,
            sha256_hash=sha256_hash,
            description=description,
            seized_from=seized_from or ctx.get("complainant_name", ""),
            seizure_date=seizure_date or datetime.now().strftime("%d.%m.%Y")
        )
        
        # Add to case context
        await db.case_contexts.update_one(
            {"id": context_id},
            {
                "$push": {"evidence_items": evidence.model_dump()},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
        
        # Store file reference (in production, would store actual file)
        file_record = {
            "evidence_id": evidence_id,
            "context_id": context_id,
            "file_name": file.filename,
            "file_type": file_type,
            "file_size": len(file_content),
            "sha256_hash": sha256_hash,
            "officer_id": officer_id,
            "uploaded_at": datetime.now(timezone.utc).isoformat()
        }
        await db.evidence_files.insert_one(file_record)
        
        return {
            "success": True,
            "evidence_id": evidence_id,
            "file_name": file.filename,
            "file_type": file_type,
            "file_size": len(file_content),
            "sha256_hash": sha256_hash,
            "message": "Evidence uploaded and hashed successfully",
            "fir_number": ctx.get("fir_number", ""),
            "accused_name": ctx.get("accused_persons", [{}])[0].get("name", "") if ctx.get("accused_persons") else ""
        }
        
    except Exception as e:
        logger.error(f"Evidence upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/{context_id}/list")
async def list_evidence(
    context_id: str,
    officer_id: str = Depends(get_current_officer)
):
    """
    List all evidence items for a case context.
    """
    ctx = await db.case_contexts.find_one(
        {"id": context_id, "created_by": officer_id},
        {"_id": 0}
    )
    
    if not ctx:
        raise HTTPException(status_code=404, detail="Case context not found")
    
    return {
        "context_id": context_id,
        "fir_number": ctx.get("fir_number", ""),
        "evidence_count": len(ctx.get("evidence_items", [])),
        "evidence_items": ctx.get("evidence_items", [])
    }


@router.post("/{evidence_id}/verify-hash")
async def verify_evidence_hash(
    evidence_id: str,
    file: UploadFile = File(...),
    officer_id: str = Depends(get_current_officer)
):
    """
    Verify the hash of a file against stored evidence hash.
    Used to confirm evidence integrity.
    """
    try:
        # Find evidence record
        file_record = await db.evidence_files.find_one(
            {"evidence_id": evidence_id, "officer_id": officer_id},
            {"_id": 0}
        )
        
        if not file_record:
            raise HTTPException(status_code=404, detail="Evidence not found")
        
        # Read file and compute hash
        file_content = await file.read()
        computed_hash = compute_sha256(file_content)
        
        stored_hash = file_record.get("sha256_hash", "")
        is_valid = computed_hash == stored_hash
        
        return {
            "evidence_id": evidence_id,
            "file_name": file.filename,
            "stored_hash": stored_hash,
            "computed_hash": computed_hash,
            "is_valid": is_valid,
            "verdict": "INTEGRITY VERIFIED - File unchanged" if is_valid else "INTEGRITY FAILED - File has been modified",
            "verified_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Hash verification error: {e}")
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")


@router.post("/compute-hash")
async def compute_hash_only(
    file: UploadFile = File(...),
    officer_id: str = Depends(get_current_officer)
):
    """
    Compute SHA-256 hash of a file without storing it.
    Useful for quick verification.
    """
    try:
        file_content = await file.read()
        sha256_hash = compute_sha256(file_content)
        
        return {
            "file_name": file.filename,
            "file_type": file.content_type,
            "file_size": len(file_content),
            "sha256_hash": sha256_hash,
            "computed_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Hash computation error: {e}")
        raise HTTPException(status_code=500, detail=f"Hash computation failed: {str(e)}")


@router.delete("/{context_id}/{evidence_id}")
async def delete_evidence(
    context_id: str,
    evidence_id: str,
    officer_id: str = Depends(get_current_officer)
):
    """
    Delete evidence from case context.
    """
    result = await db.case_contexts.update_one(
        {"id": context_id, "created_by": officer_id},
        {
            "$pull": {"evidence_items": {"id": evidence_id}},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Case context not found")
    
    # Also delete file record
    await db.evidence_files.delete_one({"evidence_id": evidence_id})
    
    return {"success": True, "message": f"Evidence {evidence_id} deleted"}
