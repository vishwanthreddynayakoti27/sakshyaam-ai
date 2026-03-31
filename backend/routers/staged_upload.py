"""
Staged Upload System for Charge Sheet Fusion
- Zero-credit file collection into Case Folder
- Single credit deduction on "Generate Triple Fusion" trigger
- Supports unlimited batch uploads
- Roll-back on failure (no credits deducted)
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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/staging", tags=["Staged Upload"])
security = HTTPBearer()

# Staging folder base path
STAGING_BASE = Path("/app/backend/staging")
STAGING_BASE.mkdir(parents=True, exist_ok=True)

# Database connection
db = None
JWT_SECRET = os.environ.get('JWT_SECRET', 'nyaya-prahari-secret-key-2025-secure')


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
    
    COST: CREDITS DEDUCTED HERE ONLY
    - Processes all files in the case folder
    - Merges data and generates all three documents
    - Uses Word templates for stable table output
    - ROLLBACK: If generation fails, no credits are deducted
    """
    from services.legal_llm import translate_to_legal_english, extract_entities, suggest_bns_sections
    from services.template_generator import (
        generate_18_column_charge_sheet,
        generate_case_diary_part1,
        generate_html_table_charge_sheet,
        suggest_bns_sections as ml_suggest_sections
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
    
    # Transaction tracking (for rollback)
    transaction_id = f"TXN-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4]}"
    credits_to_deduct = 5  # Charge for Triple Fusion
    
    try:
        logger.info(f"Starting Triple Fusion for case {case_id} (Transaction: {transaction_id})")
        
        # Step 1: Extract text from all files
        all_texts = []
        extraction_logs = []
        
        for file_info in metadata["files"]:
            file_path = folder / file_info["saved_name"]
            if file_path.exists():
                text = await extract_text_from_staged_file(file_path)
                all_texts.append({
                    "filename": file_info["original_name"],
                    "text": text,
                    "type": file_info["type"]
                })
                extraction_logs.append(f"{file_info['original_name']}: {len(text)} chars")
        
        # Step 2: Process with LLM to extract structured data
        combined_text = "\n\n---\n\n".join([f"[{t['filename']}]\n{t['text']}" for t in all_texts])
        
        extracted_data = {
            "complainant": {},
            "accused_persons": [],
            "witnesses": [],
            "offense_details": {},
            "sections_of_law": metadata.get("sections", "").split(",") if metadata.get("sections") else [],
            "brief_facts": "",
            "property_lost": "",
            "property_recovered": "",
            "medical_findings": "",
            "section_35_3_dates": []
        }
        
        if EMERGENT_LLM_KEY and combined_text:
            try:
                from emergentintegrations.llm.chat import LlmChat, UserMessage
                
                system_prompt = """You are a Legal Document Processor for Indian Police documents.
                
Extract ALL data from the provided documents and return JSON:
{
  "complainant": {"name": "", "father_name": "", "age": null, "caste": "", "occupation": "", "address": "", "phone": ""},
  "accused_persons": [{"serial": "A1", "name": "", "father_name": "", "age": null, "caste": "", "occupation": "", "address": ""}],
  "witnesses": [{"serial": "LW-1", "name": "", "father_name": "", "age": "", "caste": "", "occupation": "", "address": "", "phone": "", "role": ""}],
  "offense_details": {"type": "", "date": "", "time": "", "place": ""},
  "sections_of_law": [],
  "brief_facts": "",
  "property_lost": "",
  "property_recovered": "",
  "medical_findings": "",
  "section_35_3_dates": [],
  "arrest_details": {"date": "", "time": "", "place": ""}
}

Extract ALL witnesses (LW-1 to LW-13+), all accused (A1 to A5+), and all details.
Return ONLY valid JSON."""

                chat = LlmChat(
                    api_key=EMERGENT_LLM_KEY,
                    session_id=f"fusion-{transaction_id}",
                    system_message=system_prompt
                ).with_model("openai", "gpt-5.2")
                
                user_message = UserMessage(text=f"Extract all data from these {len(all_texts)} documents:\n\n{combined_text[:50000]}")
                response = await chat.send_message(user_message)
                
                # Parse JSON response
                clean_response = response.strip()
                if clean_response.startswith("```json"):
                    clean_response = clean_response[7:]
                if clean_response.startswith("```"):
                    clean_response = clean_response[3:]
                if clean_response.endswith("```"):
                    clean_response = clean_response[:-3]
                
                llm_data = json.loads(clean_response.strip())
                
                # Merge LLM data with extracted_data
                for key in extracted_data:
                    if key in llm_data and llm_data[key]:
                        if isinstance(extracted_data[key], list):
                            extracted_data[key].extend(llm_data[key])
                        elif isinstance(extracted_data[key], dict):
                            extracted_data[key].update(llm_data[key])
                        else:
                            extracted_data[key] = llm_data[key]
                
            except Exception as e:
                logger.error(f"LLM processing error: {e}")
                extraction_logs.append(f"LLM Error: {str(e)}")
        
        # Step 3: Generate all three documents
        case_info = {
            "police_station": metadata.get("police_station", ""),
            "district": metadata.get("district", ""),
            "fir_number": metadata.get("fir_number", ""),
            "sections": metadata.get("sections", ""),
            "io_name": officer.get("name", ""),
            "io_rank": officer.get("rank", "Sub Inspector of Police")
        }
        
        # Generate 18-Column Charge Sheet
        charge_sheet_html = generate_18_column_charge_sheet(extracted_data, case_info)
        charge_sheet_table = generate_html_table_charge_sheet(extracted_data, case_info)
        
        # Generate Case Diary Part-I
        case_diary_html = generate_case_diary_part1(extracted_data, case_info)
        
        # Generate Remand Case Diary
        remand_cd_html = generate_remand_case_diary_html(extracted_data, case_info)
        
        # ML-suggested sections
        brief_facts = extracted_data.get("brief_facts", "")
        suggested_sections = ml_suggest_sections(brief_facts) if brief_facts else []
        
        # Step 4: Save to database
        fusion_record = {
            "case_id": case_id,
            "transaction_id": transaction_id,
            "officer_id": officer.get("officer_id"),
            "police_station": metadata.get("police_station"),
            "district": metadata.get("district"),
            "fir_number": metadata.get("fir_number"),
            "documents_processed": len(metadata["files"]),
            "extracted_data": extracted_data,
            "charge_sheet_html": charge_sheet_html,
            "charge_sheet_table": charge_sheet_table,
            "case_diary_html": case_diary_html,
            "remand_cd_html": remand_cd_html,
            "suggested_sections": suggested_sections,
            "extraction_logs": extraction_logs,
            "credits_used": credits_to_deduct,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "completed"
        }
        
        if db:
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
                "files_processed": len(metadata["files"])
            })
        
        # Update case status
        metadata["status"] = "completed"
        metadata["fusion_transaction_id"] = transaction_id
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"Triple Fusion completed for case {case_id} ({credits_to_deduct} credits)")
        
        return {
            "success": True,
            "transaction_id": transaction_id,
            "case_id": case_id,
            "documents_processed": len(metadata["files"]),
            "credits_used": credits_to_deduct,
            "extracted_data": {
                "accused_count": len(extracted_data.get("accused_persons", [])),
                "witness_count": len(extracted_data.get("witnesses", [])),
                "complainant": extracted_data.get("complainant", {})
            },
            "suggested_sections": suggested_sections,
            "documents": {
                "charge_sheet": charge_sheet_html,
                "charge_sheet_table": charge_sheet_table,
                "case_diary": case_diary_html,
                "remand_cd": remand_cd_html
            },
            "extraction_logs": extraction_logs,
            "message": "Triple Fusion generated successfully!"
        }
        
    except Exception as e:
        # ROLLBACK: No credits deducted on failure
        logger.error(f"Triple Fusion FAILED for case {case_id} (Transaction: {transaction_id}): {e}")
        
        if db:
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
    if db:
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
