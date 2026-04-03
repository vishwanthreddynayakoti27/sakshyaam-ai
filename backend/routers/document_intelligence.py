"""
Document Intelligence Router
==============================
API endpoints for Azure Document Intelligence OCR pipeline.
Provides high-accuracy tabular extraction for legal documents.
"""
import os
import io
import jwt
import logging
from typing import Optional, List
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse

from services.document_intelligence_service import (
    DocumentIntelligenceService,
    DocumentIntelligenceResult,
    OpenCVPreprocessor,
    get_document_intelligence_service,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/document-intelligence", tags=["Document Intelligence"])
security = HTTPBearer()

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


@router.post("/analyze")
async def analyze_document(
    file: UploadFile = File(...),
    document_type: str = Form(default="chargesheet"),
    preprocess: bool = Form(default=True),
    officer: dict = Depends(get_current_officer)
):
    """
    Analyze a document using Azure Document Intelligence.
    
    Supports: PDF, JPG, PNG, DOCX, DOC
    
    Returns structured extraction with:
    - Full text
    - Tables (with cell structure)
    - Key-value pairs
    - Parsed legal data (FIR, accused, witnesses)
    - Confidence scores
    - Low-confidence field flags
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Validate file type
    ext = Path(file.filename).suffix.lower()
    allowed_extensions = {'.pdf', '.jpg', '.jpeg', '.png', '.docx', '.doc', '.tiff', '.tif'}
    
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # Validate document type
    valid_types = {"chargesheet", "casediary", "remand", "fir", "witness", "medical"}
    if document_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid document type. Allowed: {', '.join(valid_types)}"
        )
    
    try:
        # Read file contents
        contents = await file.read()
        
        if len(contents) == 0:
            raise HTTPException(status_code=400, detail="Empty file")
        
        if len(contents) > 50 * 1024 * 1024:  # 50MB limit
            raise HTTPException(status_code=400, detail="File too large (max 50MB)")
        
        # Initialize service
        service = DocumentIntelligenceService()
        
        # Process document
        result = await service.process_document(
            file_bytes=contents,
            filename=file.filename,
            document_type=document_type,
            preprocess=preprocess
        )
        
        # Log action
        if db is not None:
            await db.action_logs.insert_one({
                "officer_id": officer.get("officer_id"),
                "action": "DOCUMENT_INTELLIGENCE_ANALYZE",
                "filename": file.filename,
                "document_type": document_type,
                "success": result.success,
                "confidence": result.overall_confidence,
                "tables_extracted": len(result.tables),
                "processing_time_ms": result.processing_time_ms,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        
        return {
            "success": result.success,
            "filename": file.filename,
            "document_type": document_type,
            "extraction": result.to_dict(),
            "summary": {
                "full_text_length": len(result.full_text),
                "tables_count": len(result.tables),
                "key_values_count": len(result.key_values),
                "accused_count": len(result.accused_persons),
                "witnesses_count": len(result.witnesses),
                "overall_confidence": result.overall_confidence,
                "low_confidence_fields": len(result.low_confidence_fields),
                "processing_time_ms": result.processing_time_ms
            },
            "quality": {
                "is_high_quality": result.overall_confidence >= 0.90,
                "needs_review": len(result.low_confidence_fields) > 0,
                "warnings": result.warnings,
                "errors": result.errors
            }
        }
        
    except Exception as e:
        logger.error(f"Document analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/batch-analyze")
async def batch_analyze_documents(
    files: List[UploadFile] = File(...),
    document_type: str = Form(default="chargesheet"),
    preprocess: bool = Form(default=True),
    officer: dict = Depends(get_current_officer)
):
    """
    Analyze multiple documents in batch.
    Maximum 10 files per request.
    """
    if len(files) == 0:
        raise HTTPException(status_code=400, detail="No files provided")
    
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 files per batch")
    
    service = DocumentIntelligenceService()
    results = []
    
    for file in files:
        try:
            contents = await file.read()
            
            result = await service.process_document(
                file_bytes=contents,
                filename=file.filename or "unknown",
                document_type=document_type,
                preprocess=preprocess
            )
            
            results.append({
                "filename": file.filename,
                "success": result.success,
                "confidence": result.overall_confidence,
                "tables_count": len(result.tables),
                "accused_count": len(result.accused_persons),
                "witnesses_count": len(result.witnesses),
                "errors": result.errors
            })
            
        except Exception as e:
            results.append({
                "filename": file.filename,
                "success": False,
                "error": str(e)
            })
    
    # Calculate aggregate stats
    successful = [r for r in results if r.get("success")]
    avg_confidence = sum(r.get("confidence", 0) for r in successful) / len(successful) if successful else 0
    
    return {
        "total_files": len(files),
        "successful": len(successful),
        "failed": len(files) - len(successful),
        "average_confidence": avg_confidence,
        "results": results
    }


@router.post("/preprocess-image")
async def preprocess_image(
    file: UploadFile = File(...),
    officer: dict = Depends(get_current_officer)
):
    """
    Apply image preprocessing for OCR optimization.
    
    Steps applied:
    - Grayscale conversion
    - Deskewing
    - Denoising
    - Contrast enhancement (CLAHE)
    - Adaptive binarization
    - Morphological cleanup
    - Sharpening
    
    Returns preprocessed image as PNG.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    ext = Path(file.filename).suffix.lower()
    if ext not in {'.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp'}:
        raise HTTPException(status_code=400, detail="Only image files supported")
    
    try:
        contents = await file.read()
        
        preprocessor = OpenCVPreprocessor()
        processed_bytes, metadata = preprocessor.preprocess_image(contents)
        
        return JSONResponse({
            "success": True,
            "original_filename": file.filename,
            "preprocessing_applied": metadata["steps_applied"],
            "skew_angle_corrected": metadata.get("skew_angle", 0),
            "original_size": metadata.get("original_size"),
            "processed_size_bytes": metadata.get("processed_size"),
            "message": "Image preprocessed successfully. Use /analyze endpoint with preprocessed image."
        })
        
    except Exception as e:
        logger.error(f"Preprocessing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Preprocessing failed: {str(e)}")


@router.post("/detect-tables")
async def detect_table_regions(
    file: UploadFile = File(...),
    officer: dict = Depends(get_current_officer)
):
    """
    Detect table boundaries in an image using computer vision.
    Returns bounding boxes of detected table regions.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    try:
        contents = await file.read()
        
        regions = OpenCVPreprocessor.detect_table_regions(contents)
        
        return {
            "success": True,
            "filename": file.filename,
            "tables_detected": len(regions),
            "regions": regions
        }
        
    except Exception as e:
        logger.error(f"Table detection failed: {e}")
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(e)}")


@router.get("/status")
async def get_service_status(officer: dict = Depends(get_current_officer)):
    """
    Get Document Intelligence service status and configuration.
    """
    azure_endpoint = os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", "")
    azure_configured = bool(azure_endpoint and os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_KEY", ""))
    
    google_vision_path = os.environ.get("GOOGLE_VISION_CREDENTIALS", "")
    google_configured = os.path.exists(google_vision_path) if google_vision_path else False
    
    # Check Tesseract
    tesseract_available = False
    try:
        import pytesseract
        pytesseract.get_tesseract_version()
        tesseract_available = True
    except Exception:
        pass
    
    return {
        "service": "Document Intelligence",
        "engines": {
            "azure": {
                "configured": azure_configured,
                "endpoint": azure_endpoint[:50] + "..." if azure_endpoint else None,
                "priority": 1 if azure_configured else None
            },
            "google_vision": {
                "configured": google_configured,
                "credentials_path": google_vision_path if google_configured else None,
                "priority": 2 if google_configured else None
            },
            "tesseract": {
                "available": tesseract_available,
                "priority": 3 if tesseract_available else None
            }
        },
        "supported_formats": [".pdf", ".jpg", ".jpeg", ".png", ".docx", ".doc", ".tiff"],
        "supported_document_types": ["chargesheet", "casediary", "remand", "fir", "witness", "medical"],
        "features": {
            "table_extraction": azure_configured,
            "key_value_extraction": azure_configured,
            "preprocessing": True,
            "confidence_scoring": True,
            "legal_parsing": True
        }
    }


@router.post("/extract-for-fusion")
async def extract_for_triple_fusion(
    files: List[UploadFile] = File(...),
    case_info: str = Form(default="{}"),
    officer: dict = Depends(get_current_officer)
):
    """
    Extract data from multiple files for Triple Fusion generation.
    Optimized for charge sheet, case diary, and remand document creation.
    
    Returns unified schema ready for document generation.
    """
    import json
    
    if len(files) == 0:
        raise HTTPException(status_code=400, detail="No files provided")
    
    try:
        case_info_dict = json.loads(case_info) if case_info else {}
    except json.JSONDecodeError:
        case_info_dict = {}
    
    service = DocumentIntelligenceService()
    
    # Process all files
    all_accused = []
    all_witnesses = []
    complainant = {}
    fir_number = case_info_dict.get("fir_number", "")
    police_station = case_info_dict.get("police_station", "")
    district = case_info_dict.get("district", "")
    sections = case_info_dict.get("sections", "").split(",") if case_info_dict.get("sections") else []
    brief_facts_parts = []
    processing_logs = []
    
    for file in files:
        try:
            contents = await file.read()
            
            # Determine document type from filename
            filename_lower = file.filename.lower() if file.filename else ""
            if "fir" in filename_lower:
                doc_type = "fir"
            elif "diary" in filename_lower or "cd" in filename_lower:
                doc_type = "casediary"
            elif "remand" in filename_lower:
                doc_type = "remand"
            elif "witness" in filename_lower or "161" in filename_lower:
                doc_type = "witness"
            else:
                doc_type = "chargesheet"
            
            result = await service.process_document(
                file_bytes=contents,
                filename=file.filename or "unknown",
                document_type=doc_type,
                preprocess=True
            )
            
            processing_logs.append({
                "filename": file.filename,
                "success": result.success,
                "confidence": result.overall_confidence,
                "tables": len(result.tables),
                "engine": "azure" if result.success else "fallback"
            })
            
            if result.success:
                # Merge extracted data
                if not fir_number and result.fir_number:
                    fir_number = result.fir_number
                if not police_station and result.police_station:
                    police_station = result.police_station
                if not district and result.district:
                    district = result.district
                
                sections.extend(result.sections)
                
                if not complainant and result.complainant:
                    complainant = result.complainant
                
                all_accused.extend(result.accused_persons)
                all_witnesses.extend(result.witnesses)
                
                if result.full_text:
                    brief_facts_parts.append(f"[{file.filename}]\n{result.full_text[:2000]}")
            
        except Exception as e:
            processing_logs.append({
                "filename": file.filename,
                "success": False,
                "error": str(e)
            })
    
    # Deduplicate
    unique_accused = []
    seen_names = set()
    for acc in all_accused:
        name = acc.get("name", "").lower().strip()
        if name and name not in seen_names:
            seen_names.add(name)
            unique_accused.append(acc)
    
    unique_witnesses = []
    seen_witness_names = set()
    for wit in all_witnesses:
        name = wit.get("name", "").lower().strip()
        if name and name not in seen_witness_names:
            seen_witness_names.add(name)
            unique_witnesses.append(wit)
    
    # Deduplicate sections
    unique_sections = list(set(s.strip() for s in sections if s.strip()))
    
    return {
        "success": True,
        "files_processed": len(files),
        "extraction_summary": {
            "fir_number": fir_number,
            "police_station": police_station,
            "district": district,
            "sections": unique_sections,
            "complainant": complainant,
            "accused_count": len(unique_accused),
            "witness_count": len(unique_witnesses)
        },
        "extracted_data": {
            "complainant": complainant,
            "accused_persons": unique_accused,
            "witnesses": unique_witnesses,
            "sections_of_law": unique_sections,
            "brief_facts": "\n\n---\n\n".join(brief_facts_parts)[:10000]
        },
        "processing_logs": processing_logs,
        "ready_for_fusion": bool(fir_number or unique_accused or unique_witnesses)
    }
