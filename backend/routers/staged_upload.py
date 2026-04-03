"""
Staged Upload System for Charge Sheet Fusion
- Zero-credit file collection into Case Folder
- Single credit deduction on "Generate Triple Fusion" trigger
- Supports unlimited batch uploads
- Roll-back on failure (no credits deducted)
- ASYNC BACKGROUND PROCESSING for large batches
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
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
JWT_SECRET = os.environ.get('JWT_SECRET', 'nyaya-prahari-secret-key-2025-secure')

# In-memory job status tracking (for background processing)
processing_jobs = {}


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
    officer: dict = Depends(get_current_officer)
):
    """
    Generate Triple Fusion (Charge Sheet + Case Diary 1 + Remand CD) from all staged files.
    
    PIPELINE FLOW:
    Upload → OCR → Classification → Extraction → Aggregation → Validation → AI Facts → DOCX → CCTNS
    
    COST: CREDITS DEDUCTED HERE ONLY
    - Processes all files in the case folder using MODULAR PIPELINE
    - Merges data via regex/rules (AI ONLY for Brief Facts & Remand Narrative)
    - Uses DOCX TEMPLATES for stable table output (no code-generated layouts)
    - ROLLBACK: If generation fails, no credits are deducted
    """
    from services.pipeline import DocumentPipeline
    from services.template_generator import (
        generate_18_column_charge_sheet,
        generate_case_diary_part1,
        generate_html_table_charge_sheet,
        generate_case_diary_html
    )
    from services.remand_generator import generate_remand_case_diary_html
    
    EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
    
    folder = get_case_folder(officer.get("officer_id", "unknown"), case_id)
    
    if not folder.exists():
        raise HTTPException(status_code=404, detail="Case folder not found")
    
    # Load metadata
    metadata_path = folder / "metadata.json"
    if not metadata_path.exists():
        raise HTTPException(status_code=404, detail="Case metadata not found")
    
    with open(metadata_path) as f:
        metadata = json.load(f)
    
    if not metadata.get("files"):
        raise HTTPException(status_code=400, detail="No files staged for fusion")
    
    # CHECK FOR CACHED RESULT - Return immediately if already generated
    if db is not None and metadata.get("status") == "completed":
        existing_fusion = await db.triple_fusions.find_one(
            {"case_id": case_id, "officer_id": officer.get("officer_id")},
            {"_id": 0}
        )
        if existing_fusion and existing_fusion.get("status") == "completed":
            logger.info(f"Returning cached fusion for case {case_id}")
            # Format response to match frontend expectations
            return {
                "success": True,
                "transaction_id": existing_fusion.get("transaction_id"),
                "case_id": case_id,
                "documents_processed": existing_fusion.get("documents_processed", 0),
                "credits_used": 0,  # No credits for cached result
                "extracted_data": existing_fusion.get("extracted_data", {}),
                "cctns_json": existing_fusion.get("cctns_json", {}),
                "validation": existing_fusion.get("validation", {}),
                "pipeline_stats": existing_fusion.get("pipeline_stats", {}),
                "documents": {
                    "charge_sheet": existing_fusion.get("charge_sheet_table") or existing_fusion.get("charge_sheet_html", ""),
                    "charge_sheet_table": existing_fusion.get("charge_sheet_table", ""),
                    "case_diary": existing_fusion.get("case_diary_html", ""),
                    "remand_cd": existing_fusion.get("remand_cd_html", "")
                },
                "processing_log": existing_fusion.get("processing_log", [])[:20],
                "warnings": [],
                "message": "Triple Fusion retrieved from cache (0 credits used)"
            }
    
    # CHECK FOR IN-PROGRESS PROCESSING
    job_key = f"{officer.get('officer_id')}_{case_id}"
    if job_key in processing_jobs:
        job_status = processing_jobs[job_key]
        if job_status.get("status") == "processing":
            # Return processing status for frontend to poll
            return {
                "success": False,
                "status": "processing",
                "case_id": case_id,
                "message": f"Triple Fusion is being generated. Please wait... ({job_status.get('progress', 0)}%)",
                "progress": job_status.get("progress", 0),
                "started_at": job_status.get("started_at"),
                "estimated_time_remaining": job_status.get("estimated_time_remaining", "2-3 minutes")
            }
        elif job_status.get("status") == "completed":
            # Processing completed, return result
            result = job_status.get("result")
            del processing_jobs[job_key]  # Clear job
            return result
        elif job_status.get("status") == "failed":
            error = job_status.get("error", "Unknown error")
            del processing_jobs[job_key]  # Clear job
            raise HTTPException(status_code=500, detail=f"Processing failed: {error}")
    
    # LARGE BATCH HANDLING: For 6+ files, return immediately and process in background
    num_files = len(metadata.get("files", []))
    if num_files >= 6:
        logger.info(f"Large batch ({num_files} files) - starting background processing for case {case_id}")
        
        # Mark as processing
        processing_jobs[job_key] = {
            "status": "processing",
            "progress": 0,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "estimated_time_remaining": f"{num_files * 15} seconds",
            "case_id": case_id
        }
        
        # Start background task
        asyncio.create_task(_process_triple_fusion_background(
            case_id=case_id,
            officer=officer,
            metadata=metadata,
            folder=folder,
            job_key=job_key
        ))
        
        # Return immediately with processing status
        return {
            "success": False,
            "status": "processing",
            "case_id": case_id,
            "message": f"Processing {num_files} files in background. Click 'Generate' again in 30-60 seconds to check status.",
            "progress": 5,
            "estimated_time_remaining": f"{num_files * 10} seconds"
        }
    
    # Transaction tracking (for rollback)
    transaction_id = f"TXN-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4]}"
    credits_to_deduct = 5  # Charge for Triple Fusion
    
    try:
        logger.info(f"Starting Triple Fusion Pipeline for case {case_id} (Transaction: {transaction_id})")
        logger.info(f"Files to process: {len(metadata['files'])}")
        
        # Initialize the modular pipeline
        pipeline = DocumentPipeline(emergent_llm_key=EMERGENT_LLM_KEY)
        
        # Collect file paths
        file_paths = []
        for file_info in metadata["files"]:
            file_path = folder / file_info["saved_name"]
            if file_path.exists():
                file_paths.append(file_path)
        
        if not file_paths:
            raise HTTPException(status_code=400, detail="No valid files found in staging folder")
        
        # Prepare case info for pipeline
        case_info = {
            "police_station": metadata.get("police_station", ""),
            "district": metadata.get("district", ""),
            "fir_number": metadata.get("fir_number", ""),
            "sections": metadata.get("sections", ""),
            "io_name": officer.get("name", ""),
            "io_rank": officer.get("rank", "Sub Inspector of Police")
        }
        
        # Run the full pipeline
        pipeline_result = await pipeline.process(
            file_paths=file_paths,
            case_info=case_info,
            generate_ai_facts=bool(EMERGENT_LLM_KEY)
        )
        
        # Extract data from pipeline result
        unified_schema = pipeline_result.unified_schema
        
        # Convert unified schema to legacy format for HTML generators
        extracted_data = {
            "complainant": {
                "name": unified_schema.complainant.name,
                "father_name": unified_schema.complainant.father_name,
                "age": unified_schema.complainant.age,
                "caste": unified_schema.complainant.caste,
                "occupation": unified_schema.complainant.occupation,
                "address": unified_schema.complainant.address,
                "phone": unified_schema.complainant.phone
            } if unified_schema.complainant else {},
            "accused_persons": [
                {
                    "serial": a.serial,
                    "name": a.name,
                    "father_name": a.father_name,
                    "age": a.age,
                    "caste": a.caste,
                    "occupation": a.occupation,
                    "address": a.address,
                    "phone": a.phone
                } for a in unified_schema.accused
            ],
            "witnesses": [
                {
                    "serial": w.serial,
                    "name": w.name,
                    "father_name": w.father_name,
                    "age": w.age,
                    "caste": w.caste,
                    "occupation": w.occupation,
                    "address": w.address,
                    "phone": w.phone,
                    "role": w.role
                } for w in unified_schema.witnesses
            ],
            "offense_details": {
                "type": unified_schema.incident.type,
                "date": unified_schema.incident.date,
                "time": unified_schema.incident.time,
                "place": unified_schema.incident.place
            },
            "sections_of_law": unified_schema.fir.sections,
            "brief_facts": unified_schema.facts.ai_generated or unified_schema.facts.raw[:3000],
            "property_lost": unified_schema.property.lost,
            "property_recovered": unified_schema.property.recovered,
            "medical_findings": unified_schema.medical.findings,
            "section_35_3_dates": unified_schema.notices.section_35_3_dates,
            "notice_date": unified_schema.notices.section_35_3_dates[0] if unified_schema.notices.section_35_3_dates else ""
        }
        
        # Generate HTML previews (for UI display)
        charge_sheet_html = generate_18_column_charge_sheet(extracted_data, case_info)
        charge_sheet_table = generate_html_table_charge_sheet(extracted_data, case_info)
        case_diary_html = generate_case_diary_html(extracted_data, case_info)
        remand_cd_html = generate_remand_case_diary_html(extracted_data, case_info)
        
        # Save DOCX files from pipeline (template-based)
        fir_safe = metadata.get("fir_number", "case").replace("/", "-")
        
        if pipeline_result.documents.get('chargesheet'):
            chargesheet_path = STAGING_BASE / f"{fir_safe}_ChargeSheet.docx"
            with open(chargesheet_path, "wb") as f:
                f.write(pipeline_result.documents['chargesheet'])
        
        if pipeline_result.documents.get('casediary'):
            casediary_path = STAGING_BASE / f"{fir_safe}_CaseDiary.docx"
            with open(casediary_path, "wb") as f:
                f.write(pipeline_result.documents['casediary'])
        
        if pipeline_result.documents.get('remand'):
            remand_path = STAGING_BASE / f"{fir_safe}_RemandCD.docx"
            with open(remand_path, "wb") as f:
                f.write(pipeline_result.documents['remand'])
        
        logger.info(f"Generated template-based Word documents for {fir_safe}")
        
        # Save to database
        fusion_record = {
            "case_id": case_id,
            "transaction_id": transaction_id,
            "officer_id": officer.get("officer_id"),
            "police_station": metadata.get("police_station"),
            "district": metadata.get("district"),
            "fir_number": metadata.get("fir_number"),
            "documents_processed": len(metadata["files"]),
            "extracted_data": extracted_data,
            "unified_schema": pipeline_result.unified_schema.to_dict() if pipeline_result.unified_schema else None,
            "cctns_json": pipeline_result.cctns_json,
            "validation": pipeline_result.validation.to_dict() if pipeline_result.validation else None,
            "charge_sheet_html": charge_sheet_html,
            "charge_sheet_table": charge_sheet_table,
            "case_diary_html": case_diary_html,
            "remand_cd_html": remand_cd_html,
            "processing_log": pipeline_result.processing_log,
            "pipeline_stats": {
                "files_classified": pipeline_result.files_classified,
                "extraction_stats": pipeline_result.extraction_stats
            },
            "credits_used": credits_to_deduct,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "completed"
        }
        
        if db is not None:
            await db.triple_fusions.insert_one(fusion_record)
            
            # Log action
            await db.action_logs.insert_one({
                "officer_id": officer.get("officer_id"),
                "action": "TRIPLE_FUSION_GENERATE",
                "credit_cost": credits_to_deduct,
                "status": "SUCCESS",
                "correlation_id": transaction_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "case_id": case_id,
                "files_processed": len(metadata["files"]),
                "pipeline_used": True
            })
        
        # Update case status
        metadata["status"] = "completed"
        metadata["fusion_transaction_id"] = transaction_id
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"Triple Fusion Pipeline completed for case {case_id} ({credits_to_deduct} credits)")
        
        return {
            "success": True,
            "transaction_id": transaction_id,
            "case_id": case_id,
            "documents_processed": len(metadata["files"]),
            "credits_used": credits_to_deduct,
            "extracted_data": {
                "accused_count": len(unified_schema.accused),
                "witness_count": len(unified_schema.witnesses),
                "complainant": {
                    "name": unified_schema.complainant.name,
                    "father_name": unified_schema.complainant.father_name
                } if unified_schema.complainant else {}
            },
            "cctns_json": pipeline_result.cctns_json,
            "validation": {
                "is_valid": pipeline_result.validation.is_valid if pipeline_result.validation else False,
                "completeness_score": pipeline_result.validation.completeness_score if pipeline_result.validation else 0
            },
            "pipeline_stats": {
                "files_classified": pipeline_result.files_classified,
                "extraction_stats": pipeline_result.extraction_stats
            },
            "documents": {
                "charge_sheet": charge_sheet_table,  # Use HTML table version for frontend
                "charge_sheet_table": charge_sheet_table,
                "case_diary": case_diary_html,
                "remand_cd": remand_cd_html
            },
            "processing_log": pipeline_result.processing_log[:20],  # Limit log entries
            "warnings": pipeline_result.warnings,
            "message": "Triple Fusion generated successfully with modular pipeline!"
        }
        
    except Exception as e:
        # ROLLBACK: No credits deducted on failure
        logger.error(f"Triple Fusion Pipeline FAILED for case {case_id} (Transaction: {transaction_id}): {e}")
        
        if db is not None:
            await db.action_logs.insert_one({
                "officer_id": officer.get("officer_id"),
                "action": "TRIPLE_FUSION_GENERATE",
                "credit_cost": 0,  # ROLLBACK - NO CREDITS
                "status": "FAILED",
                "correlation_id": f"ERR-{transaction_id}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "case_id": case_id,
                "error": str(e)
            })
        
        raise HTTPException(
            status_code=500,
            detail=f"Triple Fusion failed. NO CREDITS DEDUCTED. Reference: ERR-{transaction_id}. Error: {str(e)}"
        )


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



async def _process_triple_fusion_background(
    case_id: str,
    officer: dict,
    metadata: dict,
    folder: Path,
    job_key: str
):
    """
    Background task to process Triple Fusion for large batches.
    Updates processing_jobs status as it progresses.
    """
    from services.pipeline import DocumentPipeline
    from services.template_generator import (
        generate_18_column_charge_sheet,
        generate_case_diary_part1,
        generate_html_table_charge_sheet,
        generate_case_diary_html
    )
    from services.remand_generator import generate_remand_case_diary_html
    
    EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
    
    transaction_id = f"TXN-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4]}"
    credits_to_deduct = 5
    
    try:
        logger.info(f"[BACKGROUND] Starting Triple Fusion for case {case_id}")
        processing_jobs[job_key]["progress"] = 10
        
        # Initialize pipeline
        pipeline = DocumentPipeline(emergent_llm_key=EMERGENT_LLM_KEY)
        
        # Collect file paths
        file_paths = []
        for file_info in metadata["files"]:
            file_path = folder / file_info["saved_name"]
            if file_path.exists():
                file_paths.append(file_path)
        
        processing_jobs[job_key]["progress"] = 20
        
        # Prepare case info
        case_info = {
            "police_station": metadata.get("police_station", ""),
            "district": metadata.get("district", ""),
            "fir_number": metadata.get("fir_number", ""),
            "sections": metadata.get("sections", ""),
            "io_name": officer.get("name", ""),
            "io_rank": officer.get("rank", "Sub Inspector of Police")
        }
        
        # Run pipeline
        processing_jobs[job_key]["progress"] = 30
        pipeline_result = await pipeline.process(
            file_paths=file_paths,
            case_info=case_info,
            generate_ai_facts=bool(EMERGENT_LLM_KEY)
        )
        
        processing_jobs[job_key]["progress"] = 60
        
        # Extract data from unified schema with defensive checks
        unified_schema = pipeline_result.unified_schema
        
        # Safely extract complainant data
        comp_data = {}
        if unified_schema.complainant:
            comp_data = {
                "name": getattr(unified_schema.complainant, 'name', '') or '',
                "father_name": getattr(unified_schema.complainant, 'father_name', '') or '',
                "age": getattr(unified_schema.complainant, 'age', '') or '',
                "caste": getattr(unified_schema.complainant, 'caste', '') or '',
                "occupation": getattr(unified_schema.complainant, 'occupation', '') or '',
                "address": getattr(unified_schema.complainant, 'address', '') or '',
                "phone": getattr(unified_schema.complainant, 'phone', '') or ''
            }
        
        # Safely extract FIR data
        fir_number = metadata.get("fir_number", "")
        police_station = metadata.get("police_station", "")
        district = metadata.get("district", "")
        sections = metadata.get("sections", "").split(",") if metadata.get("sections") else []
        
        if unified_schema.fir:
            fir_number = getattr(unified_schema.fir, 'number', '') or fir_number
            police_station = getattr(unified_schema.fir, 'police_station', '') or police_station
            district = getattr(unified_schema.fir, 'district', '') or district
            if hasattr(unified_schema.fir, 'sections') and unified_schema.fir.sections:
                sections = unified_schema.fir.sections
        
        # Safely extract incident data
        incident_date = ""
        incident_time = ""
        incident_place = ""
        if unified_schema.incident:
            incident_date = getattr(unified_schema.incident, 'date', '') or ''
            incident_time = getattr(unified_schema.incident, 'time', '') or ''
            incident_place = getattr(unified_schema.incident, 'place', '') or ''
        
        # Safely extract brief facts
        brief_facts = ""
        if unified_schema.facts:
            brief_facts = getattr(unified_schema.facts, 'ai_generated', '') or getattr(unified_schema.facts, 'raw', '') or ''
        
        # Safely extract IO details
        io_name = officer.get("name", "")
        if isinstance(unified_schema.io_details, dict):
            io_name = unified_schema.io_details.get("name", "") or io_name
        
        # Build extracted_data
        extracted_data = {
            "complainant": comp_data,
            "accused_persons": [
                {
                    "serial": getattr(a, 'serial', ''),
                    "name": getattr(a, 'name', ''),
                    "father_name": getattr(a, 'father_name', ''),
                    "age": getattr(a, 'age', ''),
                    "caste": getattr(a, 'caste', ''),
                    "occupation": getattr(a, 'occupation', ''),
                    "address": getattr(a, 'address', ''),
                    "phone": getattr(a, 'phone', '')
                }
                for a in (unified_schema.accused or [])
            ],
            "witnesses": [
                {
                    "serial": getattr(w, 'serial', ''),
                    "name": getattr(w, 'name', ''),
                    "father_name": getattr(w, 'father_name', ''),
                    "age": getattr(w, 'age', ''),
                    "caste": getattr(w, 'caste', ''),
                    "occupation": getattr(w, 'occupation', ''),
                    "address": getattr(w, 'address', ''),
                    "role": getattr(w, 'role', '')
                }
                for w in (unified_schema.witnesses or [])
            ],
            "fir_number": fir_number,
            "police_station": police_station,
            "district": district,
            "sections": sections,
            "act_type": "BNS",
            "io_name": io_name,
            "io_rank": "Sub Inspector of Police",
            "incident_date": incident_date,
            "incident_time": incident_time,
            "incident_place": incident_place,
            "brief_facts": brief_facts,
        }
        
        processing_jobs[job_key]["progress"] = 70
        
        # Generate HTML documents
        charge_sheet_html = generate_html_table_charge_sheet(extracted_data, extracted_data.get("fir_number", ""))
        case_diary_html = generate_case_diary_html(extracted_data, extracted_data.get("fir_number", ""))
        remand_cd_html = generate_remand_case_diary_html(extracted_data, extracted_data.get("fir_number", ""))
        
        processing_jobs[job_key]["progress"] = 85
        
        # Save to database
        if db is not None:
            fusion_result = {
                "case_id": case_id,
                "transaction_id": transaction_id,
                "officer_id": officer.get("officer_id"),
                "police_station": metadata.get("police_station", ""),
                "district": metadata.get("district", ""),
                "fir_number": metadata.get("fir_number", ""),
                "documents_processed": len(file_paths),
                "extracted_data": extracted_data,
                "charge_sheet_html": charge_sheet_html,
                "case_diary_html": case_diary_html,
                "remand_cd_html": remand_cd_html,
                "pipeline_stats": {
                    "files_processed": pipeline_result.files_processed,
                    "files_classified": pipeline_result.files_classified
                },
                "credits_used": credits_to_deduct,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "status": "completed"
            }
            
            await db.triple_fusions.update_one(
                {"case_id": case_id, "officer_id": officer.get("officer_id")},
                {"$set": fusion_result},
                upsert=True
            )
            
            # Update officer credits
            await db.officers.update_one(
                {"officer_id": officer.get("officer_id")},
                {"$inc": {"credits": -credits_to_deduct}}
            )
        
        # Update metadata
        metadata["status"] = "completed"
        metadata["fusion_transaction_id"] = transaction_id
        with open(folder / "metadata.json", "w") as f:
            json.dump(metadata, f, indent=2)
        
        processing_jobs[job_key]["progress"] = 100
        
        # Store successful result
        processing_jobs[job_key] = {
            "status": "completed",
            "progress": 100,
            "result": {
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
        }
        
        logger.info(f"[BACKGROUND] Triple Fusion completed for case {case_id}")
        
    except Exception as e:
        logger.error(f"[BACKGROUND] Triple Fusion failed for case {case_id}: {e}")
        processing_jobs[job_key] = {
            "status": "failed",
            "error": str(e),
            "progress": 0
        }


@router.get("/job-status/{case_id}")
async def get_job_status(
    case_id: str,
    officer: dict = Depends(get_current_officer)
):
    """
    Check the status of a background processing job.
    """
    job_key = f"{officer.get('officer_id')}_{case_id}"
    
    if job_key in processing_jobs:
        job = processing_jobs[job_key]
        
        if job.get("status") == "completed":
            result = job.get("result")
            del processing_jobs[job_key]
            return result
        elif job.get("status") == "failed":
            error = job.get("error")
            del processing_jobs[job_key]
            raise HTTPException(status_code=500, detail=f"Processing failed: {error}")
        else:
            return {
                "success": False,
                "status": "processing",
                "progress": job.get("progress", 0),
                "message": f"Processing... {job.get('progress', 0)}%"
            }
    
    # Check if already completed in database
    if db is not None:
        existing = await db.triple_fusions.find_one(
            {"case_id": case_id, "officer_id": officer.get("officer_id")},
            {"_id": 0}
        )
        if existing and existing.get("status") == "completed":
            return {
                "success": True,
                "status": "completed",
                "message": "Triple Fusion already completed. Click Generate to view.",
                "cached": True
            }
    
    return {
        "success": False,
        "status": "not_found",
        "message": "No processing job found for this case"
    }
