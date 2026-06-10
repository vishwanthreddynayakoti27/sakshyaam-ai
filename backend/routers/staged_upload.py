"""
Staged Upload System for Charge Sheet Fusion
- Zero-credit file collection into Case Folder
- Single credit deduction on "Generate Triple Fusion" trigger
- Supports unlimited batch uploads
- Roll-back on failure (no credits deducted)
- ASYNC BACKGROUND PROCESSING for large batches
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone
from typing import Optional, List
from pathlib import Path
import os
import jwt
import logging
import shutil
import uuid
import json
import io
import tempfile
import subprocess
import asyncio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/staging", tags=["Staged Upload"])
security = HTTPBearer()

# Staging folder base path
STAGING_BASE = Path("/app/backend/staging")
STAGING_BASE.mkdir(parents=True, exist_ok=True)

# Database connection
db = None
JWT_SECRET = os.environ['JWT_SECRET']


def set_database(database):
    global db
    db = database


async def get_current_officer(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_case_folder(officer_id: str, case_id: str) -> Path:
    """Get or create case staging folder."""
    folder = STAGING_BASE / officer_id / case_id
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def get_file_info(file_path: Path) -> dict:
    """Get file metadata."""
    stat = file_path.stat()
    return {
        "filename": file_path.name,
        "size": stat.st_size,
        "size_kb": round(stat.st_size / 1024, 2),
        "uploaded_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        "extension": file_path.suffix.lower()
    }


# =============================================================================
# STAGING ENDPOINTS - ZERO CREDIT COST
# =============================================================================

@router.post("/create-case")
async def create_staging_case(
    police_station: str = Form(...),
    district: str = Form(...),
    fir_number: str = Form(default=""),
    sections: str = Form(default=""),
    officer: dict = Depends(get_current_officer)
):
    """
    Create a new case folder for staging files.
    COST: 0 CREDITS
    """
    case_id = f"CASE-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"
    folder = get_case_folder(officer.get("officer_id", "unknown"), case_id)
    
    # Save case metadata
    metadata = {
        "case_id": case_id,
        "officer_id": officer.get("officer_id"),
        "police_station": police_station,
        "district": district,
        "fir_number": fir_number,
        "sections": sections,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "staging",
        "files": []
    }
    
    with open(folder / "metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)
    
    logger.info(f"Created staging case: {case_id} (0 credits)")
    
    return {
        "success": True,
        "case_id": case_id,
        "message": "Case folder created for file staging",
        "credits_used": 0
    }


@router.post("/upload-files/{case_id}")
async def upload_files_to_staging(
    case_id: str,
    files: List[UploadFile] = File(...),
    officer: dict = Depends(get_current_officer)
):
    """
    Upload files to staging folder in batches.
    COST: 0 CREDITS - Files are saved without processing.
    Supports: PDF, DOCX, DOC, JPEG, PNG, JPG
    """
    folder = get_case_folder(officer.get("officer_id", "unknown"), case_id)
    
    if not folder.exists():
        raise HTTPException(status_code=404, detail="Case folder not found")
    
    # Load existing metadata
    metadata_path = folder / "metadata.json"
    if metadata_path.exists():
        with open(metadata_path) as f:
            metadata = json.load(f)
    else:
        metadata = {"files": []}
    
    saved_files = []
    allowed_extensions = {'.pdf', '.docx', '.doc', '.jpeg', '.jpg', '.png', '.gif', '.webp'}
    
    for file in files:
        ext = Path(file.filename).suffix.lower()
        if ext not in allowed_extensions:
            logger.warning(f"Skipped unsupported file: {file.filename}")
            continue
        
        # Generate unique filename to avoid overwrite
        unique_name = f"{uuid.uuid4().hex[:8]}_{file.filename}"
        file_path = folder / unique_name
        
        # Save file
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)
        
        file_info = {
            "original_name": file.filename,
            "saved_name": unique_name,
            "size": len(contents),
            "type": ext,
            "uploaded_at": datetime.now(timezone.utc).isoformat()
        }
        metadata["files"].append(file_info)
        saved_files.append(file_info)
    
    # Update metadata
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)
    
    logger.info(f"Staged {len(saved_files)} files for case {case_id} (0 credits)")
    
    return {
        "success": True,
        "case_id": case_id,
        "files_saved": len(saved_files),
        "total_files_in_case": len(metadata["files"]),
        "saved_files": saved_files,
        "credits_used": 0,
        "message": f"{len(saved_files)} files saved to staging. No credits deducted."
    }


@router.get("/case/{case_id}")
async def get_staged_files(
    case_id: str,
    officer: dict = Depends(get_current_officer)
):
    """
    Get list of all staged files in a case folder.
    COST: 0 CREDITS
    """
    folder = get_case_folder(officer.get("officer_id", "unknown"), case_id)
    
    if not folder.exists():
        raise HTTPException(status_code=404, detail="Case folder not found")
    
    metadata_path = folder / "metadata.json"
    if metadata_path.exists():
        with open(metadata_path) as f:
            metadata = json.load(f)
    else:
        metadata = {"files": []}
    
    return {
        "success": True,
        "case_id": case_id,
        "metadata": metadata,
        "file_count": len(metadata.get("files", [])),
        "credits_used": 0
    }


@router.delete("/case/{case_id}/file/{filename}")
async def delete_staged_file(
    case_id: str,
    filename: str,
    officer: dict = Depends(get_current_officer)
):
    """
    Delete a file from staging.
    COST: 0 CREDITS
    """
    folder = get_case_folder(officer.get("officer_id", "unknown"), case_id)
    file_path = folder / filename
    
    if file_path.exists():
        file_path.unlink()
        
        # Update metadata
        metadata_path = folder / "metadata.json"
        if metadata_path.exists():
            with open(metadata_path) as f:
                metadata = json.load(f)
            metadata["files"] = [f for f in metadata["files"] if f["saved_name"] != filename]
            with open(metadata_path, "w") as f:
                json.dump(metadata, f, indent=2)
        
        return {"success": True, "message": f"File {filename} deleted", "credits_used": 0}
    
    raise HTTPException(status_code=404, detail="File not found")


@router.get("/my-cases")
async def list_my_cases(
    officer: dict = Depends(get_current_officer)
):
    """
    List all staging cases for current officer.
    COST: 0 CREDITS
    """
    officer_folder = STAGING_BASE / officer.get("officer_id", "unknown")
    
    if not officer_folder.exists():
        return {"cases": [], "count": 0, "credits_used": 0}
    
    cases = []
    for case_folder in officer_folder.iterdir():
        if case_folder.is_dir():
            metadata_path = case_folder / "metadata.json"
            if metadata_path.exists():
                with open(metadata_path) as f:
                    metadata = json.load(f)
                cases.append({
                    "case_id": case_folder.name,
                    "fir_number": metadata.get("fir_number", ""),
                    "police_station": metadata.get("police_station", ""),
                    "file_count": len(metadata.get("files", [])),
                    "status": metadata.get("status", "staging"),
                    "created_at": metadata.get("created_at", "")
                })
    
    return {"cases": cases, "count": len(cases), "credits_used": 0}


# =============================================================================
# TRIPLE FUSION - CREDIT DEDUCTION ONLY HERE
# =============================================================================

async def extract_text_from_staged_file(file_path: Path) -> str:
    """Extract text from a staged file using OCR/parsing."""
    ext = file_path.suffix.lower()
    
    with open(file_path, "rb") as f:
        contents = f.read()
    
    # DOCX
    if ext == '.docx':
        try:
            from docx import Document
            doc = Document(io.BytesIO(contents))
            text_parts = []
            for para in doc.paragraphs:
                if para.text.strip():
                    text_parts.append(para.text)
            for table in doc.tables:
                for row in table.rows:
                    row_text = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                    if row_text:
                        text_parts.append(" | ".join(row_text))
            return "\n".join(text_parts)
        except Exception as e:
            return f"[DOCX error: {e}]"
    
    # DOC (legacy)
    elif ext == '.doc':
        try:
            with tempfile.NamedTemporaryFile(suffix='.doc', delete=False) as tmp:
                tmp.write(contents)
                tmp_path = tmp.name
            
            result = subprocess.run(['antiword', tmp_path], capture_output=True, text=True, timeout=30)
            os.unlink(tmp_path)
            
            if result.returncode == 0:
                return result.stdout
            return f"[DOC extraction failed: {result.stderr}]"
        except Exception as e:
            return f"[DOC error: {e}]"
    
    # PDF
    elif ext == '.pdf':
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(io.BytesIO(contents))
            text_parts = []
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
            return "\n".join(text_parts) if text_parts else "[No text in PDF]"
        except Exception as e:
            return f"[PDF error: {e}]"
    
    # Images (JPG, PNG) - Use OCR
    elif ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
        GOOGLE_VISION_CREDENTIALS = os.environ.get('GOOGLE_VISION_CREDENTIALS', '')
        GOOGLE_TRANSLATE_CREDENTIALS = os.environ.get('GOOGLE_TRANSLATE_CREDENTIALS', '')
        
        if GOOGLE_VISION_CREDENTIALS and os.path.exists(GOOGLE_VISION_CREDENTIALS):
            try:
                from google.cloud import vision
                from google.oauth2 import service_account
                
                credentials = service_account.Credentials.from_service_account_file(GOOGLE_VISION_CREDENTIALS)
                vision_client = vision.ImageAnnotatorClient(credentials=credentials)
                
                image = vision.Image(content=contents)
                response = vision_client.text_detection(image=image)
                
                if response.text_annotations:
                    text = response.text_annotations[0].description
                    
                    # Translate if needed
                    if GOOGLE_TRANSLATE_CREDENTIALS and os.path.exists(GOOGLE_TRANSLATE_CREDENTIALS):
                        from google.cloud import translate_v2 as translate
                        trans_creds = service_account.Credentials.from_service_account_file(GOOGLE_TRANSLATE_CREDENTIALS)
                        translate_client = translate.Client(credentials=trans_creds)
                        translation = translate_client.translate(text, target_language='en')
                        return translation['translatedText']
                    
                    return text
                return "[No text detected in image]"
            except Exception as e:
                return f"[OCR error: {e}]"
        else:
            return f"[OCR not configured - file: {file_path.name}]"
    
    return f"[Unsupported format: {ext}]"


@router.post("/generate-triple-fusion/{case_id}")
async def generate_triple_fusion(
    case_id: str,
    force: bool = False,
    officer: dict = Depends(get_current_officer)
):
    """
    Kick off Triple Fusion generation (Charge Sheet + Case Diary + Remand CD).

    Uses a DB-backed async job queue:
    - Returns immediately with status="processing" and a job_id
    - Background task persists progress to `triple_fusion_jobs` collection
    - Frontend polls GET /api/staging/job-status/{case_id}

    COST: Credits are deducted inside the background task only on success.
          Failed jobs deduct 0 credits (rollback-safe).

    Pass `?force=true` to bypass the result cache and re-run a fresh
    OpenAI pipeline (full 5-credit charge applies).
    """
    officer_id = officer.get("officer_id", "unknown")
    folder = get_case_folder(officer_id, case_id)

    if not folder.exists():
        raise HTTPException(status_code=404, detail="Case folder not found")

    metadata_path = folder / "metadata.json"
    if not metadata_path.exists():
        raise HTTPException(status_code=404, detail="Case metadata not found")

    with open(metadata_path) as f:
        metadata = json.load(f)

    if not metadata.get("files"):
        raise HTTPException(status_code=400, detail="No files staged for fusion")

    # If forcing a fresh run, purge ALL cached fusion rows + any stale extraction
    # cache entries for the files in this case BEFORE the credit check.
    if force and db is not None:
        await db.triple_fusions.delete_many({"case_id": case_id, "officer_id": officer_id})
        await db.triple_fusion_jobs.delete_many({"case_id": case_id, "officer_id": officer_id})
        # Best-effort: also evict document_cache entries whose key matches any
        # ocr_text we have on disk (used by legal_llm for entity extraction).
        try:
            from services.document_cache import generate_cache_key
            keys = []
            for f_meta in metadata.get("files", []):
                txt = (f_meta.get("ocr_text") or f_meta.get("text") or "").strip()
                if txt:
                    keys.append(generate_cache_key(txt, "entity_extraction"))
                    keys.append(generate_cache_key(txt, "translation"))
            if keys:
                deleted = await db.document_cache.delete_many({"cache_key": {"$in": keys}})
                logger.info(f"[force=true] evicted {deleted.deleted_count} document_cache entries")
        except Exception as e:
            logger.warning(f"force-purge: document_cache evict skipped: {e}")
        logger.info(f"[force=true] Purged cache for case {case_id}")

    # Credit balance pre-check (idempotent: cached fusions cost 0 and skip this)
    if db is not None:
        cached = await db.triple_fusions.find_one(
            {"case_id": case_id, "officer_id": officer_id, "status": "completed"},
            {"_id": 0, "status": 1}
        )
        if not cached:
            officer_doc = await db.officers.find_one({"officer_id": officer_id}, {"_id": 0, "credits": 1})
            current = int((officer_doc or {}).get("credits", 0) or 0)
            if current < 5:
                raise HTTPException(
                    status_code=402,
                    detail=f"Insufficient credits — Triple Fusion costs 5 credits, you have {current}. Buy more at /credits.",
                )

    # Fast path: return cached fusion if already completed (skipped if force=true above)
    if db is not None:
        existing_fusion = await db.triple_fusions.find_one(
            {"case_id": case_id, "officer_id": officer_id},
            {"_id": 0}
        )
        if existing_fusion and existing_fusion.get("status") == "completed":
            logger.info(f"Returning cached fusion for case {case_id}")
            return {
                "success": True,
                "status": "completed",
                "transaction_id": existing_fusion.get("transaction_id"),
                "case_id": case_id,
                "documents_processed": existing_fusion.get("documents_processed", 0),
                "credits_used": 0,
                "extracted_data": existing_fusion.get("extracted_data", {}),
                "documents": {
                    "charge_sheet": existing_fusion.get("charge_sheet_html", ""),
                    "case_diary": existing_fusion.get("case_diary_html", ""),
                    "remand_cd": existing_fusion.get("remand_cd_html", "")
                },
                "message": "Triple Fusion retrieved from cache (0 credits used)"
            }

    # Idempotency: if a job is already processing, return current state
    if db is not None:
        existing_job = await db.triple_fusion_jobs.find_one(
            {"case_id": case_id, "officer_id": officer_id},
            {"_id": 0}
        )
        if existing_job and existing_job.get("status") == "processing":
            return {
                "success": True,
                "status": "processing",
                "job_id": existing_job.get("job_id"),
                "case_id": case_id,
                "progress": existing_job.get("progress", 0),
                "stage": existing_job.get("stage", "queued"),
                "message": "Job already in progress. Poll /job-status/{case_id} for updates."
            }

    # Create a new job and fire off background task
    job_id = f"JOB-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    job_doc = {
        "job_id": job_id,
        "case_id": case_id,
        "officer_id": officer_id,
        "status": "processing",
        "progress": 0,
        "stage": "queued",
        "created_at": now_iso,
        "updated_at": now_iso,
        "file_count": len(metadata.get("files", [])),
        "error": None,
    }

    if db is not None:
        await db.triple_fusion_jobs.update_one(
            {"case_id": case_id, "officer_id": officer_id},
            {"$set": job_doc},
            upsert=True
        )

    # Detach background processing (non-blocking)
    asyncio.create_task(
        _process_triple_fusion_background(
            case_id=case_id,
            officer=officer,
            metadata=metadata,
            folder=folder,
            job_id=job_id,
        )
    )

    logger.info(f"Triple Fusion job {job_id} queued for case {case_id} ({len(metadata.get('files', []))} files)")

    return {
        "success": True,
        "status": "processing",
        "job_id": job_id,
        "case_id": case_id,
        "progress": 0,
        "stage": "queued",
        "file_count": len(metadata.get("files", [])),
        "message": "Triple Fusion started. Poll /api/staging/job-status/{case_id} for updates."
    }


@router.get("/fusion/{case_id}")
async def get_fusion_result(
    case_id: str,
    officer: dict = Depends(get_current_officer)
):
    """
    Get previously generated Triple Fusion result.
    COST: 0 CREDITS
    """
    if db is not None:
        result = await db.triple_fusions.find_one(
            {"case_id": case_id, "officer_id": officer.get("officer_id")},
            {"_id": 0}
        )
        
        if result:
            return {"success": True, "fusion": result, "credits_used": 0}
    
    raise HTTPException(status_code=404, detail="Fusion result not found")


@router.get("/download/{case_id}/{doc_type}")
async def download_fusion_document(
    case_id: str,
    doc_type: str,
    officer: dict = Depends(get_current_officer)
):
    """
    Download generated Word document.
    doc_type: 'chargesheet', 'casediary', 'remand'
    """
    from fastapi.responses import FileResponse
    
    folder = get_case_folder(officer.get("officer_id", "unknown"), case_id)
    
    file_map = {
        "chargesheet": f"{case_id}_ChargeSheet.docx",
        "casediary": f"{case_id}_CaseDiary.docx",
        "remand": f"{case_id}_RemandCD.docx"
    }
    
    filename = file_map.get(doc_type)
    if not filename:
        raise HTTPException(status_code=400, detail="Invalid document type")
    
    file_path = folder / filename
    if not file_path.exists():
        # Try global staging folder
        file_path = STAGING_BASE / filename
    
    if file_path.exists():
        return FileResponse(
            path=str(file_path),
            filename=filename,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
    
    raise HTTPException(status_code=404, detail="Document not found")



async def _update_job(case_id: str, officer_id: str, **fields):
    """Persist job progress/status to `triple_fusion_jobs` collection."""
    if db is None:
        return
    fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    try:
        await db.triple_fusion_jobs.update_one(
            {"case_id": case_id, "officer_id": officer_id},
            {"$set": fields},
            upsert=True
        )
    except Exception as e:
        logger.error(f"Failed to update job status in DB: {e}")


async def _process_triple_fusion_background(
    case_id: str,
    officer: dict,
    metadata: dict,
    folder: Path,
    job_id: str
):
    """
    Background task to process Triple Fusion.

    Persists progress to `triple_fusion_jobs` collection so frontend can
    safely poll `/api/staging/job-status/{case_id}` regardless of which
    backend worker served the request.
    """
    from services.template_generator import (
        generate_html_table_charge_sheet,
        generate_case_diary_html,
    )
    from services.remand_generator import generate_remand_case_diary_html

    officer_id = officer.get("officer_id", "unknown")
    transaction_id = f"TXN-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4]}"
    credits_to_deduct = 5

    try:
        logger.info(f"[BACKGROUND] Job {job_id} starting for case {case_id} ({len(metadata.get('files', []))} files)")
        await _update_job(case_id, officer_id, status="processing", progress=10, stage="extracting_text", job_id=job_id)

        # Collect valid file paths
        file_paths = []
        for file_info in metadata.get("files", []):
            fp = folder / file_info["saved_name"]
            if fp.exists():
                file_paths.append(fp)

        if not file_paths:
            raise RuntimeError("No valid files found in staging folder")

        # Extract text from each staged file in parallel (async but chunked for memory safety)
        extracted_texts = []
        total = len(file_paths)
        for idx, fp in enumerate(file_paths, start=1):
            try:
                txt = await extract_text_from_staged_file(fp)
                if txt:
                    extracted_texts.append(txt)
            except Exception as ex:
                logger.warning(f"Text extraction failed for {fp.name}: {ex}")
            # progress 10% -> 50% across files
            progress = 10 + int(40 * idx / max(total, 1))
            await _update_job(case_id, officer_id, progress=progress, stage=f"extracting_text ({idx}/{total})")

        combined_text = "\n\n".join(extracted_texts)[:20000]  # cap for memory

        # Build case_info dict (ALWAYS a dict - this is the fix for
        # `'str' object has no attribute 'get'` bug in generators)
        case_info = {
            "police_station": metadata.get("police_station", ""),
            "district": metadata.get("district", ""),
            "fir_number": metadata.get("fir_number", ""),
            "sections": metadata.get("sections", ""),
            "io_name": officer.get("name", ""),
            "io_rank": officer.get("rank", "Sub Inspector of Police"),
        }

        await _update_job(case_id, officer_id, progress=55, stage="parsing_entities")

        # Attempt structured parsing via enhanced_legal_parser
        extracted_data = {
            "complainant": {},
            "accused_persons": [],
            "witnesses": [],
            "fir_number": case_info["fir_number"],
            "police_station": case_info["police_station"],
            "district": case_info["district"],
            "sections": case_info["sections"].split(",") if case_info["sections"] else [],
            "act_type": "BNS",
            "io_name": case_info["io_name"],
            "io_rank": case_info["io_rank"],
            "incident_date": "",
            "incident_time": "",
            "incident_place": case_info["police_station"],
            "brief_facts": combined_text[:3000] if combined_text else "Case details to be extracted from uploaded documents.",
        }

        try:
            from services.enhanced_legal_parser import EnhancedLegalParser
            parser = EnhancedLegalParser()
            parsed = parser.parse(combined_text) if combined_text else None
            if parsed:
                extracted_data["complainant"] = parsed.get("complainant", {}) or {}
                extracted_data["accused_persons"] = parsed.get("accused", []) or []
                extracted_data["witnesses"] = parsed.get("witnesses", []) or []
        except Exception as ex:
            logger.warning(f"Parser fallback - using metadata-only extraction: {ex}")

        await _update_job(case_id, officer_id, progress=75, stage="generating_documents")

        # Generate HTML documents (pass case_info DICT, not fir_number string!)
        charge_sheet_html = generate_html_table_charge_sheet(extracted_data, case_info)
        case_diary_html = generate_case_diary_html(extracted_data, case_info)
        remand_cd_html = generate_remand_case_diary_html(extracted_data, case_info)

        await _update_job(case_id, officer_id, progress=90, stage="persisting_result")

        # Persist fusion result + deduct credits
        if db is not None:
            fusion_result = {
                "case_id": case_id,
                "transaction_id": transaction_id,
                "officer_id": officer_id,
                "police_station": metadata.get("police_station", ""),
                "district": metadata.get("district", ""),
                "fir_number": metadata.get("fir_number", ""),
                "documents_processed": len(file_paths),
                "extracted_data": extracted_data,
                "charge_sheet_html": charge_sheet_html,
                "case_diary_html": case_diary_html,
                "remand_cd_html": remand_cd_html,
                "credits_used": credits_to_deduct,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "status": "completed"
            }
            await db.triple_fusions.update_one(
                {"case_id": case_id, "officer_id": officer_id},
                {"$set": fusion_result},
                upsert=True
            )
            await db.officers.update_one(
                {"officer_id": officer_id},
                {"$inc": {"credits": -credits_to_deduct}}
            )
            await db.action_logs.insert_one({
                "officer_id": officer_id,
                "action": "TRIPLE_FUSION_GENERATE",
                "credit_cost": credits_to_deduct,
                "status": "SUCCESS",
                "correlation_id": transaction_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "case_id": case_id,
                "files_processed": len(file_paths),
            })

        # Update staging metadata
        metadata["status"] = "completed"
        metadata["fusion_transaction_id"] = transaction_id
        with open(folder / "metadata.json", "w") as f:
            json.dump(metadata, f, indent=2)

        # Finalize job record with full result so polling can fetch it
        final_result = {
            "success": True,
            "transaction_id": transaction_id,
            "case_id": case_id,
            "documents_processed": len(file_paths),
            "credits_used": credits_to_deduct,
            "documents": {
                "charge_sheet": charge_sheet_html,
                "case_diary": case_diary_html,
                "remand_cd": remand_cd_html
            },
            "extracted_data": extracted_data,
            "message": "Triple Fusion completed successfully!"
        }
        await _update_job(
            case_id, officer_id,
            status="completed", progress=100, stage="done",
            transaction_id=transaction_id, result=final_result,
            error=None,
        )
        logger.info(f"[BACKGROUND] Job {job_id} completed for case {case_id}")

    except Exception as e:
        logger.exception(f"[BACKGROUND] Job {job_id} FAILED for case {case_id}: {e}")
        if db is not None:
            try:
                await db.action_logs.insert_one({
                    "officer_id": officer_id,
                    "action": "TRIPLE_FUSION_GENERATE",
                    "credit_cost": 0,
                    "status": "FAILED",
                    "correlation_id": f"ERR-{transaction_id}",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "case_id": case_id,
                    "error": str(e)
                })
            except Exception:
                pass
        await _update_job(
            case_id, officer_id,
            status="failed", progress=0, stage="failed",
            error=str(e), result=None,
        )


@router.get("/job-status/{case_id}")
async def get_job_status(
    case_id: str,
    officer: dict = Depends(get_current_officer)
):
    """
    Check the status of the Triple Fusion job for this case.
    Reads from the `triple_fusion_jobs` collection (DB-backed queue).
    """
    officer_id = officer.get("officer_id", "unknown")

    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    job = await db.triple_fusion_jobs.find_one(
        {"case_id": case_id, "officer_id": officer_id},
        {"_id": 0}
    )

    if not job:
        # No job ever queued — maybe fusion was completed earlier
        existing = await db.triple_fusions.find_one(
            {"case_id": case_id, "officer_id": officer_id},
            {"_id": 0}
        )
        if existing and existing.get("status") == "completed":
            return {
                "success": True,
                "status": "completed",
                "case_id": case_id,
                "message": "Triple Fusion already completed. POST /generate-triple-fusion to view cached result.",
                "cached": True
            }
        return {
            "success": False,
            "status": "not_found",
            "case_id": case_id,
            "message": "No processing job found for this case"
        }

    status = job.get("status", "processing")

    if status == "completed":
        return {
            "success": True,
            "status": "completed",
            "case_id": case_id,
            "job_id": job.get("job_id"),
            "progress": 100,
            "stage": "done",
            **(job.get("result") or {})
        }

    if status == "failed":
        return {
            "success": False,
            "status": "failed",
            "case_id": case_id,
            "job_id": job.get("job_id"),
            "progress": job.get("progress", 0),
            "stage": job.get("stage", "failed"),
            "error": job.get("error", "Unknown error"),
            "message": f"Triple Fusion failed. NO CREDITS DEDUCTED. Error: {job.get('error', 'Unknown')}"
        }

    # processing / queued
    return {
        "success": True,
        "status": status,
        "case_id": case_id,
        "job_id": job.get("job_id"),
        "progress": job.get("progress", 0),
        "stage": job.get("stage", "queued"),
        "message": f"Processing... {job.get('progress', 0)}% ({job.get('stage', 'queued')})"
    }



# =====================================================================
# Intelligent Charge Sheet Generator (station-writer grade)
# =====================================================================
# Schema adapter: LLM JSON → fixed_layout_renderer schema
# =====================================================================
NOT_FOUND = "NOT FOUND IN DOCUMENTS"


def _nf(value, default=NOT_FOUND):
    """Return value or 'NOT FOUND IN DOCUMENTS' instead of an empty string.

    Phase-1 (manual) values that come in as empty are rare; they should
    still be flagged so the officer sees the gap.
    """
    if value is None:
        return default
    s = str(value).strip()
    if not s or s == "_____":
        return default
    return s


def _adapt_person(p: dict) -> dict:
    """Translate LLM person schema → fixed_layout_renderer schema."""
    if not isinstance(p, dict):
        return {}
    return {
        "salutation": p.get("salutation") or "",
        "name": _nf(p.get("name"), ""),
        "father": _nf(p.get("father_name") or p.get("father"), ""),
        "age": _nf(p.get("age"), ""),
        "caste": _nf(p.get("caste"), ""),
        "occupation": _nf(p.get("occupation") or p.get("occ"), ""),
        "address": _nf(p.get("address") or p.get("permanent_address"), ""),
        "phone": _nf(p.get("phone"), ""),
        "gender": p.get("gender") or "",
        "aadhaar_number": p.get("aadhaar_number") or "",
        "type": p.get("role") or p.get("type") or "",
        "role": p.get("role") or p.get("type") or "",
        "alias": p.get("alias") or "",
    }


def _adapt_llm_schema_to_fixed_layout(cs: dict) -> dict:
    """
    Translate the V3.0 intelligent_charge_sheet LLM JSON output into the
    schema expected by services.fixed_layout_renderer.render_charge_sheet
    so the AUTHENTIC 18-section Telangana layout is produced.

    "Not found" policy: blank cells render as 'NOT FOUND IN DOCUMENTS'
    (never '_____').
    """
    if not isinstance(cs, dict):
        return {}
    court = (cs.get("court") or "").strip()
    court_name, court_place = "", ""
    if " AT " in court.upper():
        idx = court.upper().rfind(" AT ")
        court_name = court[:idx].replace("IN THE COURT OF", "").strip()
        court_place = court[idx + 4:].strip().rstrip(",.").strip()
    brief = cs.get("brief_facts") or ""
    if isinstance(brief, list):
        brief_paragraphs = [str(x).strip() for x in brief if x]
    elif isinstance(brief, str):
        brief_paragraphs = [p.strip() for p in brief.split("\n\n") if p.strip()]
    else:
        brief_paragraphs = []
    prayer = (cs.get("prayer") or "").strip()
    if prayer and (not brief_paragraphs or prayer not in brief_paragraphs[-1]):
        brief_paragraphs.append(prayer)

    io_d = cs.get("io") or {}
    return {
        "court_name": court_name or "JUDICIAL FIRST CLASS MAGISTRATE",
        "court_place": court_place or _nf(cs.get("district"), "NOT FOUND IN DOCUMENTS"),
        "police_station": _nf(cs.get("police_station")),
        "district": _nf(cs.get("district")),
        "fir_number": _nf(cs.get("fir_number")),
        "fir_date": _nf(cs.get("fir_date")),
        "charge_sheet_no": _nf(cs.get("chargesheet_no")),
        "today_date": _nf(cs.get("chargesheet_date")),
        "sections": _nf(cs.get("sections")),
        "final_report_type": _nf(cs.get("report_type"), "Charge Sheet."),
        "fr_unoccurred": _nf(cs.get("un_occurred_reason"), "----"),
        "charge_sheet_kind": _nf(cs.get("chargesheet_type"), "Original."),
        "io": {
            "salutation": io_d.get("salutation") or "Sri.",
            "name": _nf(io_d.get("name"), "NOT FOUND IN DOCUMENTS"),
            "designation": _nf(io_d.get("rank") or io_d.get("designation"),
                                "Sub Inspector of Police"),
            "rank": _nf(io_d.get("rank") or io_d.get("designation"),
                         "Sub Inspector of Police"),
        },
        "complainant": _adapt_person(cs.get("complainant") or {}),
        "accused": [_adapt_person(a) for a in (cs.get("accused") or [])],
        "witnesses": [_adapt_person(w) for w in (cs.get("witnesses") or [])],
        "properties_seized": _nf(cs.get("property_recovered"), "---"),
        "ack_notice_enclosed": _nf(cs.get("notice_ack_enclosed"), "No."),
        "dispatch_date": _nf(cs.get("dispatch_date")),
        "brief_facts_paragraphs": brief_paragraphs,
        "arrest_release": _nf(cs.get("arrest_release"), "--"),
        "sureties": _nf(cs.get("sureties"), "--"),
        "previous_convictions": _nf(cs.get("previous_convictions"), "--"),
        "absconding": _nf(cs.get("absconding"), "--"),
        "accused_not_chargesheeted": _nf(cs.get("accused_not_chargesheeted"), "Nil"),
        "fr_false_action": _nf(cs.get("fr_false_action"), "--Nil--"),
        "lab_result": _nf(cs.get("lab_result"), "--Nil--"),
        # Pass-through fields used by the response (not rendered)
        "_extraction_report": cs.get("extraction_report") or {},
        "_corrections_applied": cs.get("corrections_applied") or [],
    }


# =====================================================================
@router.post("/generate-intelligent-charge-sheet/{case_id}")
async def generate_intelligent_charge_sheet_endpoint(
    case_id: str,
    officer: dict = Depends(get_current_officer),
):
    """
    Generate a production-grade charge sheet for a staged case.
    Takes the last Triple Fusion extracted data, runs it through
    Claude Sonnet 4.5 for validation/correction/narrative composition,
    then renders a station-format DOCX.
    COST: 3 credits (deducted only on success).
    """
    from fastapi.responses import Response
    from services.intelligent_charge_sheet import generate_intelligent_charge_sheet
    from services.station_charge_sheet_renderer import render_charge_sheet_docx  # legacy renderer (unused, kept for compat)  # noqa: F401
    from services.fixed_layout_renderer import render_charge_sheet as render_authentic_charge_sheet

    officer_id = officer.get("officer_id", "unknown")
    credits_to_deduct = 3

    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    # Credit balance pre-check
    officer_doc = await db.officers.find_one({"officer_id": officer_id}, {"_id": 0, "credits": 1})
    current = int((officer_doc or {}).get("credits", 0) or 0)
    if current < credits_to_deduct:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits — Intelligent Charge Sheet costs {credits_to_deduct} credits, you have {current}. Buy more at /credits.",
        )

    existing = await db.triple_fusions.find_one(
        {"case_id": case_id, "officer_id": officer_id},
        {"_id": 0}
    )
    if not existing:
        raise HTTPException(
            status_code=400,
            detail="No Triple Fusion result found. Run Generate Triple Fusion first."
        )

    extracted = existing.get("extracted_data") or {}
    folder = get_case_folder(officer_id, case_id)
    metadata_path = folder / "metadata.json"
    metadata = {}
    if metadata_path.exists():
        with open(metadata_path) as f:
            metadata = json.load(f)

    sections_raw = extracted.get("sections") or []
    sections_text = ", ".join(sections_raw) if isinstance(sections_raw, list) else str(sections_raw)

    raw_data = {
        "fir_number": extracted.get("fir_number") or metadata.get("fir_number", ""),
        "fir_date": extracted.get("fir_date", ""),
        "chargesheet_date": datetime.now(timezone.utc).strftime("%d.%m.%Y"),
        "police_station": extracted.get("police_station") or metadata.get("police_station", ""),
        "district": extracted.get("district") or metadata.get("district", ""),
        "sections": sections_text or metadata.get("sections", ""),
        "io": {
            "name": extracted.get("io_name") or officer.get("name", ""),
            "rank": extracted.get("io_rank") or officer.get("rank", "SI of Police"),
            "station": f"PS {metadata.get('police_station','Makthal')}",
            "salutation": "Sri.",
        },
        "complainant": extracted.get("complainant") or {},
        "accused_persons": extracted.get("accused_persons") or [],
        "witnesses": extracted.get("witnesses") or [],
        "incident_date": extracted.get("incident_date", ""),
        "incident_time": extracted.get("incident_time", ""),
        "incident_place": extracted.get("incident_place", ""),
        "medical_findings": extracted.get("medical_findings", ""),
        "section_35_3_dates": extracted.get("section_35_3_dates", ""),
        "brief_facts": extracted.get("brief_facts", ""),
    }

    try:
        logger.info(f"[ICGS] Generating intelligent charge sheet for case {case_id}")
        cs_data = await generate_intelligent_charge_sheet(raw_data, session_id=f"ics-{case_id}")
        # Adapt the LLM JSON schema → fixed_layout_renderer schema and render the
        # AUTHENTIC 18-section Telangana layout (matches 156.2025 CS.docx sample
        # 1-to-1). The AI's role is purely to fill cell VALUES; structure cannot drift.
        adapted = _adapt_llm_schema_to_fixed_layout(cs_data)
        docx_bytes = render_authentic_charge_sheet(adapted)

        await db.intelligent_chargesheets.update_one(
            {"case_id": case_id, "officer_id": officer_id},
            {"$set": {
                "case_id": case_id,
                "officer_id": officer_id,
                "fir_number": cs_data.get("fir_number", ""),
                "structured_data": cs_data,
                "corrections_applied": cs_data.get("corrections_applied", []),
                "model_used": cs_data.get("_model_used", ""),
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "credits_used": credits_to_deduct,
            }},
            upsert=True,
        )
        await db.officers.update_one(
            {"officer_id": officer_id},
            {"$inc": {"credits": -credits_to_deduct}}
        )
        await db.action_logs.insert_one({
            "officer_id": officer_id,
            "action": "INTELLIGENT_CHARGESHEET_GENERATE",
            "credit_cost": credits_to_deduct,
            "status": "SUCCESS",
            "correlation_id": case_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "model_used": cs_data.get("_model_used", ""),
        })

        fir_safe = (cs_data.get("fir_number") or "case").replace("/", "-")
        filename = f"{fir_safe}_IntelligentChargeSheet.docx"
        # Surface the extraction report on response headers so the frontend can
        # show it in a toast / inline panel without re-fetching.
        report = cs_data.get("extraction_report") or {}
        import json as _json
        report_header = _json.dumps({
            "manual_input_fields_used": report.get("manual_input_fields_used", 10),
            "extracted_fields_count": report.get("extracted_fields_count", 0),
            "total_accused": len(cs_data.get("accused") or []),
            "total_witnesses": len(cs_data.get("witnesses") or []),
            "brief_facts_paragraphs": report.get("brief_facts_paragraphs",
                                                  len((cs_data.get("brief_facts") or "").split("\n\n"))),
            "not_found_fields": report.get("not_found_fields", []),
            "confidence": report.get("confidence", "High"),
            "confidence_reason": report.get("confidence_reason", ""),
        })[:6000]
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "X-Corrections-Count": str(len(cs_data.get("corrections_applied", []))),
                "X-Model-Used": cs_data.get("_model_used", ""),
                "X-Extraction-Report": report_header,
                "Access-Control-Expose-Headers": (
                    "X-Corrections-Count, X-Model-Used, X-Extraction-Report"
                ),
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[ICGS] Intelligent charge sheet FAILED for case {case_id}: {e}")
        if db is not None:
            await db.action_logs.insert_one({
                "officer_id": officer_id,
                "action": "INTELLIGENT_CHARGESHEET_GENERATE",
                "credit_cost": 0,
                "status": "FAILED",
                "correlation_id": case_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "error": str(e),
            })
        raise HTTPException(
            status_code=500,
            detail=f"Intelligent charge sheet failed. NO CREDITS DEDUCTED. Error: {str(e)}"
        )


@router.get("/intelligent-chargesheet/{case_id}")
async def get_intelligent_chargesheet_metadata(
    case_id: str,
    officer: dict = Depends(get_current_officer),
):
    """Return the corrections applied + structured data for the last intelligent charge sheet."""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    doc = await db.intelligent_chargesheets.find_one(
        {"case_id": case_id, "officer_id": officer.get("officer_id", "unknown")},
        {"_id": 0}
    )
    if not doc:
        return {"success": False, "message": "No intelligent charge sheet generated for this case yet"}
    return {"success": True, **doc}


# =====================================================================
# Intelligent Case Diary Part-I Generator
# Reuses the already-corrected ICGS structured data to compose the
# chronological investigation log narrative via Claude Sonnet 4.5.
# =====================================================================
@router.post("/generate-intelligent-case-diary/{case_id}")
async def generate_intelligent_case_diary_endpoint(
    case_id: str,
    officer: dict = Depends(get_current_officer),
):
    """
    Generate Case Diary Part-I for a case that already has an ICGS output.

    Must be called AFTER /generate-intelligent-charge-sheet/{case_id} so the
    structured data is available. COST: 2 credits (deducted on success).
    """
    from fastapi.responses import Response
    from services.intelligent_case_diary import generate_intelligent_case_diary
    from services.station_case_diary_renderer import render_case_diary_docx

    officer_id = officer.get("officer_id", "unknown")
    credits_to_deduct = 2

    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    # Credit balance pre-check
    officer_doc = await db.officers.find_one({"officer_id": officer_id}, {"_id": 0, "credits": 1})
    current = int((officer_doc or {}).get("credits", 0) or 0)
    if current < credits_to_deduct:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits — Intelligent Case Diary costs {credits_to_deduct} credits, you have {current}. Buy more at /credits.",
        )

    ics = await db.intelligent_chargesheets.find_one(
        {"case_id": case_id, "officer_id": officer_id},
        {"_id": 0}
    )
    if not ics or not ics.get("structured_data"):
        raise HTTPException(
            status_code=400,
            detail="No intelligent charge sheet found. Run 'Generate Station-Format Charge Sheet' first."
        )

    try:
        logger.info(f"[ICD] Generating case diary for case {case_id}")
        cd_data = await generate_intelligent_case_diary(
            ics["structured_data"],
            session_id=f"icd-{case_id}",
        )
        docx_bytes = render_case_diary_docx(cd_data)

        await db.intelligent_case_diaries.update_one(
            {"case_id": case_id, "officer_id": officer_id},
            {"$set": {
                "case_id": case_id,
                "officer_id": officer_id,
                "fir_number": cd_data.get("fir_number", ""),
                "structured_data": cd_data,
                "entries_count": len(cd_data.get("entries", [])),
                "model_used": cd_data.get("_model_used", ""),
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "credits_used": credits_to_deduct,
            }},
            upsert=True,
        )
        await db.officers.update_one(
            {"officer_id": officer_id},
            {"$inc": {"credits": -credits_to_deduct}}
        )
        await db.action_logs.insert_one({
            "officer_id": officer_id,
            "action": "INTELLIGENT_CASE_DIARY_GENERATE",
            "credit_cost": credits_to_deduct,
            "status": "SUCCESS",
            "correlation_id": case_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "model_used": cd_data.get("_model_used", ""),
        })

        fir_safe = (cd_data.get("fir_number") or "case").replace("/", "-")
        filename = f"{fir_safe}_IntelligentCaseDiary.docx"
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "X-Entries-Count": str(len(cd_data.get("entries", []))),
                "X-Model-Used": cd_data.get("_model_used", ""),
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[ICD] Case Diary FAILED for case {case_id}: {e}")
        if db is not None:
            await db.action_logs.insert_one({
                "officer_id": officer_id,
                "action": "INTELLIGENT_CASE_DIARY_GENERATE",
                "credit_cost": 0,
                "status": "FAILED",
                "correlation_id": case_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "error": str(e),
            })
        raise HTTPException(
            status_code=500,
            detail=f"Case Diary generation failed. NO CREDITS DEDUCTED. Error: {str(e)}"
        )



# ============================================================
# FIXED-LAYOUT DOCUMENT GENERATION
# (Charge Sheet, Case Diary Part-I, Remand Report)
# Layout never changes. Missing fields render as blank "_____".
# Aadhaar is auto-extracted from already-staged files when present.
# ============================================================

from services.fixed_layout_renderer import render_fixed_doc, extract_aadhaar_from_files
from fastapi.responses import StreamingResponse


def _build_case_data_from_metadata(metadata: dict, officer: dict, doc_type: str) -> dict:
    """
    Walk the staged metadata + per-file extracted_data and build a normalised
    `case_data` dict the renderer understands. We stay strictly mechanical here
    — no AI, no inference. Whatever the OCR/parser produced is what we plug in.
    """
    files = metadata.get("files", []) or []
    case = {
        "police_station": metadata.get("police_station") or metadata.get("ps_name") or "",
        "district": metadata.get("district") or "",
        "fir_number": metadata.get("fir_number") or metadata.get("fir_no") or "",
        "fir_date": metadata.get("fir_date") or "",
        "sections": metadata.get("sections") or "",
        "place": metadata.get("place") or metadata.get("police_station") or "",
        "today_date": datetime.now().strftime("%d-%m-%Y"),
        "io": {
            "name": officer.get("name", ""),
            "designation": officer.get("rank") or officer.get("role", ""),
            "phone": officer.get("phone", ""),
        },
        "complainant": metadata.get("complainant") or {},
        "accused": metadata.get("accused") or [],
        "witnesses": metadata.get("witnesses") or [],
        "material_objects": metadata.get("material_objects") or [],
        "brief_facts": metadata.get("brief_facts") or "",
        # Case-diary-specific
        "diary_no": metadata.get("diary_no", ""),
        "diary_date": metadata.get("diary_date", ""),
        "places_visited": metadata.get("places_visited", ""),
        "distance_travelled": metadata.get("distance_travelled", ""),
        "time_departure": metadata.get("time_departure", ""),
        "time_arrival": metadata.get("time_arrival", ""),
        "witnesses_examined": metadata.get("witnesses_examined", []),
        "search_seizure": metadata.get("search_seizure", ""),
        "material_seized": metadata.get("material_seized", ""),
        "actions_today": metadata.get("actions_today", ""),
        "findings": metadata.get("findings", ""),
        "next_steps": metadata.get("next_steps", ""),
        # Remand-specific
        "court_name": metadata.get("court_name", ""),
        "court_address": metadata.get("court_address", ""),
        "arrest_datetime": metadata.get("arrest_datetime", ""),
        "production_datetime": metadata.get("production_datetime", ""),
        "grounds_of_arrest": metadata.get("grounds_of_arrest", ""),
        "investigation_done": metadata.get("investigation_done", ""),
        "reasons_for_remand": metadata.get("reasons_for_remand", ""),
        "further_investigation": metadata.get("further_investigation", ""),
        "remand_type": metadata.get("remand_type", ""),
        "remand_duration": metadata.get("remand_duration", ""),
        "remand_from": metadata.get("remand_from", ""),
        "remand_to": metadata.get("remand_to", ""),
    }

    # Auto-extract Aadhaar fields from any staged file with OCR text and
    # plug them into A1 if A1 has no aadhaar number yet.
    aad = extract_aadhaar_from_files(files)
    if aad.get("aadhaar_number"):
        if not case["accused"]:
            case["accused"] = [{}]
        a1 = case["accused"][0] if isinstance(case["accused"][0], dict) else {}
        if not a1.get("aadhaar_number"):
            a1["aadhaar_number"] = aad["aadhaar_number"]
        if not a1.get("name") and aad.get("aadhaar_name"):
            a1["name"] = aad["aadhaar_name"]
        if not a1.get("permanent_address") and aad.get("aadhaar_address"):
            a1["permanent_address"] = aad["aadhaar_address"]
            # Also set the generic 'address' so the renderer's R/o block uses it
            if not a1.get("address"):
                a1["address"] = aad["aadhaar_address"]
        if not a1.get("gender") and aad.get("aadhaar_gender"):
            a1["gender"] = aad["aadhaar_gender"]
        # DOB is metadata, not the literal age — keep it in a separate field
        if not a1.get("dob") and aad.get("aadhaar_dob"):
            a1["dob"] = aad["aadhaar_dob"]
        case["accused"][0] = a1

    return case


@router.get("/render-fixed/{doc_type}/{case_id}")
async def render_fixed_layout_doc(
    doc_type: str,
    case_id: str,
    officer: dict = Depends(get_current_officer)
):
    """
    Generate one of the 3 fixed-layout documents from the staged case files.
    Layout is hard-coded; values are taken from metadata.json + auto-extracted
    Aadhaar fields. Missing fields render as `_____` blanks for the officer
    to fill in Word.

    doc_type ∈ {charge_sheet, case_diary_part1, remand_report}
    """
    if doc_type not in ("charge_sheet", "case_diary_part1", "remand_report"):
        raise HTTPException(status_code=400, detail="Invalid doc_type")

    folder = get_case_folder(officer.get("officer_id", "unknown"), case_id)
    if not folder.exists():
        raise HTTPException(status_code=404, detail="Case folder not found")

    metadata_path = folder / "metadata.json"
    if not metadata_path.exists():
        raise HTTPException(status_code=404, detail="Case metadata not found — upload files first")

    with open(metadata_path) as f:
        metadata = json.load(f)

    try:
        case_data = _build_case_data_from_metadata(metadata, officer, doc_type)
        docx_bytes, filename = render_fixed_doc(doc_type, case_data)
    except Exception as e:
        logger.error(f"Fixed-layout render failed for {doc_type}/{case_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Rendering failed: {str(e)}")

    return StreamingResponse(
        io.BytesIO(docx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ────────────────────────────────────────────────────────────────
# Convenience alias endpoints (1-to-1 mapping for clearer URLs)
# ────────────────────────────────────────────────────────────────
@router.get("/generate-fixed-charge-sheet/{case_id}")
async def generate_fixed_charge_sheet(
    case_id: str,
    officer: dict = Depends(get_current_officer),
):
    return await render_fixed_layout_doc("charge_sheet", case_id, officer)


@router.get("/generate-fixed-case-diary/{case_id}")
async def generate_fixed_case_diary(
    case_id: str,
    officer: dict = Depends(get_current_officer),
):
    return await render_fixed_layout_doc("case_diary_part1", case_id, officer)


@router.get("/generate-fixed-remand/{case_id}")
async def generate_fixed_remand(
    case_id: str,
    officer: dict = Depends(get_current_officer),
):
    return await render_fixed_layout_doc("remand_report", case_id, officer)
