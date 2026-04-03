"""
Azure Document Intelligence Service - Integrated Pipeline with Visual Diff
============================================================================
High-accuracy document OCR pipeline for Indian legal documents.
Targets 90%+ field-level accuracy on Charge Sheets, Case Diaries, and Remand Reports.

Integrated Pipeline:
1. Advanced Pre-processing (OpenCV) - deskew, denoise, enhance, binarize
2. OCR Engine (Azure Document Intelligence / Google Vision fallback)
3. Enhanced Legal Parser - rule-based extraction calibrated on real samples
4. Visual Diff Overlay - color-coded bounding boxes
5. Annotated PDF generation

Visual Diff Color Coding:
- GREEN: High-confidence fields (>90%)
- YELLOW: Low-confidence fields (needs review)
- RED: Detected but unextracted regions
"""
import os
import io
import re
import cv2
import base64
import logging
import asyncio
import tempfile
import numpy as np
from PIL import Image
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple, Union
from dataclasses import dataclass, field
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# Import enhanced parser with visual diff
from services.enhanced_legal_parser import (
    EnhancedLegalParser,
    EnhancedLegalParserService,
    LegalDocumentData,
    PersonRecord,
    ExtractedField,
    BoundingBox,
    OpenCVPreprocessor,
    VisualDiffGenerator,
    ConfidenceColors,
    get_legal_parser,
    get_legal_parser_service,
)


# ============================================
# DATA CLASSES
# ============================================

@dataclass
class ExtractedCell:
    """Single table cell with content and metadata."""
    row_index: int
    col_index: int
    content: str
    confidence: float
    row_span: int = 1
    col_span: int = 1
    is_header: bool = False


@dataclass
class ExtractedTable:
    """Reconstructed table structure."""
    table_id: int
    rows: int
    columns: int
    cells: List[ExtractedCell] = field(default_factory=list)
    confidence: float = 0.0
    
    def to_dict(self) -> Dict:
        return {
            "table_id": self.table_id,
            "rows": self.rows,
            "columns": self.columns,
            "cells": [
                {
                    "row": c.row_index,
                    "col": c.col_index,
                    "content": c.content,
                    "confidence": c.confidence
                }
                for c in self.cells
            ],
            "confidence": self.confidence
        }
    
    def to_matrix(self) -> List[List[str]]:
        """Convert to 2D matrix for easy access."""
        matrix = [["" for _ in range(self.columns)] for _ in range(self.rows)]
        for cell in self.cells:
            if 0 <= cell.row_index < self.rows and 0 <= cell.col_index < self.columns:
                matrix[cell.row_index][cell.col_index] = cell.content
        return matrix


@dataclass
class ExtractedKeyValue:
    """Extracted key-value pair."""
    key: str
    value: str
    confidence: float


@dataclass
class DocumentIntelligenceResult:
    """Complete extraction result with visual diff."""
    success: bool
    source_file: str
    document_type: str
    
    # Raw extracted content
    full_text: str = ""
    
    # Structured data (from Azure/Vision)
    tables: List[ExtractedTable] = field(default_factory=list)
    key_values: List[ExtractedKeyValue] = field(default_factory=list)
    
    # Legal document specific (from EnhancedLegalParser)
    fir_number: str = ""
    fir_date: str = ""
    police_station: str = ""
    district: str = ""
    sections: List[str] = field(default_factory=list)
    act_type: str = ""
    
    complainant: Dict[str, Any] = field(default_factory=dict)
    accused_persons: List[Dict[str, Any]] = field(default_factory=list)
    witnesses: List[Dict[str, Any]] = field(default_factory=list)
    
    io_name: str = ""
    io_rank: str = ""
    
    incident_date: str = ""
    incident_time: str = ""
    incident_place: str = ""
    
    brief_facts: str = ""
    reasons_for_arrest: List[str] = field(default_factory=list)
    
    chargesheet_number: str = ""
    chargesheet_date: str = ""
    section_35_3_dates: List[str] = field(default_factory=list)
    
    # Visual Diff
    annotated_pdf_bytes: Optional[bytes] = None
    annotated_pdf_base64: str = ""
    annotated_filename: str = ""
    
    # Quality metrics
    overall_confidence: float = 0.0
    low_confidence_fields: List[Dict[str, Any]] = field(default_factory=list)
    processing_time_ms: int = 0
    ocr_engine: str = ""
    preprocessing_applied: List[str] = field(default_factory=list)
    
    # Visual diff summary
    visual_diff_summary: Dict[str, Any] = field(default_factory=dict)
    
    # Errors/warnings
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict:
        return {
            "success": self.success,
            "source_file": self.source_file,
            "document_type": self.document_type,
            "full_text": self.full_text[:2000] if self.full_text else "",
            "tables": [t.to_dict() for t in self.tables],
            "key_values": [{"key": kv.key, "value": kv.value, "confidence": kv.confidence} for kv in self.key_values],
            "fir_number": self.fir_number,
            "fir_date": self.fir_date,
            "police_station": self.police_station,
            "district": self.district,
            "sections": self.sections,
            "act_type": self.act_type,
            "complainant": self.complainant,
            "accused_persons": self.accused_persons,
            "witnesses": self.witnesses,
            "io_name": self.io_name,
            "io_rank": self.io_rank,
            "incident_date": self.incident_date,
            "incident_time": self.incident_time,
            "incident_place": self.incident_place,
            "brief_facts": self.brief_facts[:1000] if self.brief_facts else "",
            "reasons_for_arrest": self.reasons_for_arrest,
            "chargesheet_number": self.chargesheet_number,
            "chargesheet_date": self.chargesheet_date,
            "section_35_3_dates": self.section_35_3_dates,
            "overall_confidence": round(self.overall_confidence, 2),
            "low_confidence_fields": self.low_confidence_fields,
            "processing_time_ms": self.processing_time_ms,
            "ocr_engine": self.ocr_engine,
            "preprocessing_applied": self.preprocessing_applied,
            "visual_diff_summary": self.visual_diff_summary,
            "annotated_filename": self.annotated_filename,
            "has_annotated_pdf": bool(self.annotated_pdf_base64),
            "annotated_pdf_base64": self.annotated_pdf_base64,
            "errors": self.errors,
            "warnings": self.warnings
        }


# ============================================
# AZURE DOCUMENT INTELLIGENCE CLIENT
# ============================================

class AzureDocumentIntelligence:
    """Azure AI Document Intelligence client wrapper."""
    
    def __init__(self):
        """Initialize Azure client from environment variables."""
        self.endpoint = os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", "")
        self.key = os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_KEY", "")
        
        self.client = None
        self.is_configured = bool(self.endpoint and self.key)
        
        if self.is_configured:
            self._init_client()
    
    def _init_client(self):
        """Initialize the Azure Document Intelligence client."""
        try:
            from azure.ai.documentintelligence import DocumentIntelligenceClient
            from azure.core.credentials import AzureKeyCredential
            
            self.client = DocumentIntelligenceClient(
                endpoint=self.endpoint,
                credential=AzureKeyCredential(self.key)
            )
            logger.info("Azure Document Intelligence client initialized")
        except ImportError:
            logger.warning("azure-ai-documentintelligence package not installed")
        except Exception as e:
            logger.error(f"Failed to initialize Azure client: {e}")
    
    async def analyze_document(self, document_bytes: bytes, 
                               model_id: str = "prebuilt-layout") -> Dict[str, Any]:
        """Analyze document using Azure Document Intelligence."""
        if not self.client:
            raise RuntimeError("Azure Document Intelligence client not initialized")
        
        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                self._sync_analyze,
                document_bytes,
                model_id
            )
            return result
        except Exception as e:
            logger.error(f"Azure analysis failed: {e}")
            raise
    
    def _sync_analyze(self, document_bytes: bytes, model_id: str) -> Dict[str, Any]:
        """Synchronous analysis wrapper."""
        from azure.ai.documentintelligence.models import AnalyzeDocumentRequest
        
        poller = self.client.begin_analyze_document(
            model_id=model_id,
            analyze_request=AnalyzeDocumentRequest(bytes_source=document_bytes),
            content_type="application/octet-stream"
        )
        
        result = poller.result()
        return self._result_to_dict(result)
    
    def _result_to_dict(self, result) -> Dict[str, Any]:
        """Convert Azure result to dictionary."""
        output = {
            "content": result.content if hasattr(result, 'content') else "",
            "tables": [],
            "key_value_pairs": []
        }
        
        if hasattr(result, 'tables') and result.tables:
            for i, table in enumerate(result.tables):
                table_dict = {
                    "table_id": i,
                    "row_count": table.row_count if hasattr(table, 'row_count') else 0,
                    "column_count": table.column_count if hasattr(table, 'column_count') else 0,
                    "cells": []
                }
                
                if hasattr(table, 'cells') and table.cells:
                    for cell in table.cells:
                        cell_dict = {
                            "row_index": cell.row_index if hasattr(cell, 'row_index') else 0,
                            "column_index": cell.column_index if hasattr(cell, 'column_index') else 0,
                            "content": cell.content if hasattr(cell, 'content') else "",
                            "row_span": cell.row_span if hasattr(cell, 'row_span') else 1,
                            "column_span": cell.column_span if hasattr(cell, 'column_span') else 1,
                            "kind": cell.kind if hasattr(cell, 'kind') else "content"
                        }
                        table_dict["cells"].append(cell_dict)
                
                output["tables"].append(table_dict)
        
        if hasattr(result, 'key_value_pairs') and result.key_value_pairs:
            for kv in result.key_value_pairs:
                kv_dict = {
                    "key": kv.key.content if hasattr(kv, 'key') and hasattr(kv.key, 'content') else "",
                    "value": kv.value.content if hasattr(kv, 'value') and hasattr(kv.value, 'content') else "",
                    "confidence": kv.confidence if hasattr(kv, 'confidence') else 0
                }
                output["key_value_pairs"].append(kv_dict)
        
        return output


# ============================================
# TABLE RECONSTRUCTOR
# ============================================

class TableReconstructor:
    """Spatial clustering and table reconstruction."""
    
    @staticmethod
    def reconstruct_tables(azure_tables: List[Dict]) -> List[ExtractedTable]:
        """Reconstruct clean table structures from Azure output."""
        tables = []
        
        for table_data in azure_tables:
            table_id = table_data.get("table_id", 0)
            row_count = table_data.get("row_count", 0)
            col_count = table_data.get("column_count", 0)
            cells_data = table_data.get("cells", [])
            
            if row_count == 0 or col_count == 0:
                continue
            
            cells = []
            total_confidence = 0
            
            for cell_data in cells_data:
                cell = ExtractedCell(
                    row_index=cell_data.get("row_index", 0),
                    col_index=cell_data.get("column_index", 0),
                    content=cell_data.get("content", "").strip(),
                    confidence=cell_data.get("confidence", 0.8),
                    row_span=cell_data.get("row_span", 1),
                    col_span=cell_data.get("column_span", 1),
                    is_header=cell_data.get("kind") == "columnHeader"
                )
                cells.append(cell)
                total_confidence += cell.confidence
            
            avg_confidence = total_confidence / len(cells) if cells else 0
            
            table = ExtractedTable(
                table_id=table_id,
                rows=row_count,
                columns=col_count,
                cells=cells,
                confidence=avg_confidence
            )
            
            tables.append(table)
        
        return tables


# ============================================
# CONFIDENCE VALIDATOR
# ============================================

class ConfidenceValidator:
    """Validate extracted fields and flag low-confidence items."""
    
    HIGH_CONFIDENCE_THRESHOLD = 0.90
    MEDIUM_CONFIDENCE_THRESHOLD = 0.75
    LOW_CONFIDENCE_THRESHOLD = 0.60
    
    @classmethod
    def validate_result(cls, result: DocumentIntelligenceResult) -> DocumentIntelligenceResult:
        """Validate extraction result and flag low-confidence fields."""
        low_confidence = []
        
        required_fields = [
            ("fir_number", result.fir_number),
            ("police_station", result.police_station),
        ]
        
        for field_name, field_value in required_fields:
            if not field_value:
                result.warnings.append(f"Missing required field: {field_name}")
                low_confidence.append({
                    "field": field_name,
                    "reason": "missing",
                    "severity": "high"
                })
        
        if not result.accused_persons:
            result.warnings.append("No accused persons extracted")
        else:
            for i, acc in enumerate(result.accused_persons):
                if not acc.get("name"):
                    low_confidence.append({
                        "field": f"accused_{i+1}_name",
                        "reason": "missing",
                        "severity": "medium"
                    })
        
        if not result.witnesses:
            result.warnings.append("No witnesses extracted")
        
        result.low_confidence_fields = low_confidence
        
        if result.overall_confidence < cls.LOW_CONFIDENCE_THRESHOLD:
            result.warnings.append(f"Low overall confidence: {result.overall_confidence:.0%}")
        
        return result


# ============================================
# MAIN DOCUMENT INTELLIGENCE SERVICE
# ============================================

class DocumentIntelligenceService:
    """
    Main service orchestrating the document intelligence pipeline with visual diff.
    
    Pipeline:
    1. Image preprocessing (OpenCV)
    2. OCR (Azure Document Intelligence / Google Vision fallback)
    3. Table reconstruction
    4. Enhanced legal parsing (rule-based extraction)
    5. Confidence validation
    6. Visual diff overlay generation
    7. Annotated PDF creation
    """
    
    def __init__(self):
        """Initialize the service with all components."""
        self.preprocessor = OpenCVPreprocessor()
        self.azure_client = AzureDocumentIntelligence()
        self.legal_parser = get_legal_parser()
        self.validator = ConfidenceValidator()
        self.visual_diff = VisualDiffGenerator()
        
        logger.info(f"DocumentIntelligenceService initialized "
                   f"(Azure: {self.azure_client.is_configured})")
    
    async def process_document(self, 
                              file_bytes: bytes,
                              filename: str,
                              document_type: str = "auto",
                              preprocess: bool = True,
                              generate_visual_diff: bool = True) -> DocumentIntelligenceResult:
        """
        Process a document through the full pipeline.
        
        Returns both clean JSON extraction and annotated diff PDF.
        """
        start_time = datetime.now()
        
        result = DocumentIntelligenceResult(
            success=False,
            source_file=filename,
            document_type=document_type
        )
        
        try:
            # Step 1: Preprocess image if applicable
            processed_bytes = file_bytes
            if preprocess and self._is_image(filename):
                try:
                    processed_bytes, preprocess_meta = self.preprocessor.preprocess_image(file_bytes)
                    result.preprocessing_applied = preprocess_meta.get("steps_applied", [])
                    logger.info(f"Preprocessing applied: {result.preprocessing_applied}")
                except Exception as e:
                    logger.warning(f"Preprocessing failed, using original: {e}")
            
            # Step 2: OCR
            ocr_text = ""
            azure_tables = []
            
            if self.azure_client.is_configured and self.azure_client.client:
                try:
                    azure_result = await self.azure_client.analyze_document(processed_bytes)
                    ocr_text = azure_result.get("content", "")
                    azure_tables = azure_result.get("tables", [])
                    result.ocr_engine = "azure_document_intelligence"
                    logger.info(f"Azure OCR: {len(ocr_text)} chars, {len(azure_tables)} tables")
                except Exception as e:
                    logger.warning(f"Azure OCR failed, falling back to Vision: {e}")
            
            # Fallback to Google Vision
            if not ocr_text:
                ocr_text = await self._fallback_ocr(processed_bytes, filename)
                result.ocr_engine = "google_vision"
            
            if not ocr_text or len(ocr_text) < 50:
                result.errors.append("OCR extraction failed or produced insufficient text")
                return result
            
            result.full_text = ocr_text
            
            # Step 3: Reconstruct tables from Azure
            if azure_tables:
                result.tables = TableReconstructor.reconstruct_tables(azure_tables)
            
            # Step 4: Enhanced legal parsing
            parsed_data = self.legal_parser.parse(ocr_text, document_type)
            
            # Transfer parsed data to result
            result.document_type = parsed_data.document_type
            result.fir_number = parsed_data.fir_number
            result.fir_date = parsed_data.fir_date
            result.police_station = parsed_data.police_station
            result.district = parsed_data.district
            result.sections = parsed_data.sections
            result.act_type = parsed_data.act_type
            
            result.complainant = parsed_data.complainant.to_dict() if parsed_data.complainant else {}
            result.accused_persons = [a.to_dict() for a in parsed_data.accused_persons]
            result.witnesses = [w.to_dict() for w in parsed_data.witnesses]
            
            result.io_name = parsed_data.io_name
            result.io_rank = parsed_data.io_rank
            
            result.incident_date = parsed_data.incident_date
            result.incident_time = parsed_data.incident_time
            result.incident_place = parsed_data.incident_place
            
            result.brief_facts = parsed_data.brief_facts
            result.reasons_for_arrest = parsed_data.reasons_for_arrest
            
            result.chargesheet_number = parsed_data.chargesheet_number
            result.chargesheet_date = parsed_data.chargesheet_date
            result.section_35_3_dates = parsed_data.section_35_3_dates
            
            result.overall_confidence = parsed_data.overall_confidence
            result.low_confidence_fields = parsed_data.low_confidence_fields
            result.warnings.extend(parsed_data.parsing_notes)
            
            # Visual diff summary
            result.visual_diff_summary = {
                "extracted_fields_count": len(parsed_data.extracted_fields),
                "high_confidence_count": sum(1 for f in parsed_data.extracted_fields if f.confidence >= 0.90),
                "medium_confidence_count": sum(1 for f in parsed_data.extracted_fields if 0.70 <= f.confidence < 0.90),
                "low_confidence_count": sum(1 for f in parsed_data.extracted_fields if f.confidence < 0.70),
                "accused_extracted": len(parsed_data.accused_persons),
                "witnesses_extracted": len(parsed_data.witnesses)
            }
            
            # Step 5: Validation
            result = self.validator.validate_result(result)
            
            # Step 6: Generate visual diff PDF
            if generate_visual_diff:
                try:
                    annotated_bytes, annotated_filename = await self.visual_diff.generate_annotated_pdf(
                        file_bytes, filename, parsed_data
                    )
                    result.annotated_pdf_bytes = annotated_bytes
                    result.annotated_pdf_base64 = base64.b64encode(annotated_bytes).decode('utf-8')
                    result.annotated_filename = annotated_filename
                    logger.info(f"Visual diff generated: {annotated_filename}")
                except Exception as e:
                    logger.warning(f"Visual diff generation failed: {e}")
                    result.warnings.append(f"Visual diff generation failed: {str(e)}")
            
            result.success = True
            
        except Exception as e:
            logger.error(f"Document processing failed: {e}", exc_info=True)
            result.errors.append(str(e))
        
        result.processing_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        
        return result
    
    async def _fallback_ocr(self, file_bytes: bytes, filename: str) -> str:
        """Fallback OCR using Google Vision via existing OCR service."""
        try:
            from services.pipeline.ocr_service import OCRService
            
            ocr = OCRService(prefer_azure=False)
            
            ext = Path(filename).suffix.lower() or '.pdf'
            
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                tmp.write(file_bytes)
                tmp_path = Path(tmp.name)
            
            try:
                result = ocr.extract_text(tmp_path)
                return result.text if result.success else ""
            finally:
                tmp_path.unlink()
                
        except Exception as e:
            logger.error(f"Fallback OCR failed: {e}")
            return ""
    
    def _is_image(self, filename: str) -> bool:
        """Check if file is an image that can be preprocessed."""
        ext = Path(filename).suffix.lower()
        return ext in {'.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp'}
    
    async def batch_process(self, 
                           files: List[Tuple[bytes, str]],
                           document_type: str = "auto",
                           generate_visual_diff: bool = False) -> List[DocumentIntelligenceResult]:
        """Process multiple documents."""
        results = []
        
        for file_bytes, filename in files:
            result = await self.process_document(
                file_bytes, filename, document_type,
                generate_visual_diff=generate_visual_diff
            )
            results.append(result)
            logger.info(f"Processed {filename}: success={result.success}, "
                       f"accused={len(result.accused_persons)}, "
                       f"witnesses={len(result.witnesses)}")
        
        return results
    
    def parse_text_only(self, text: str, document_type: str = "auto") -> LegalDocumentData:
        """Parse already-extracted OCR text."""
        return self.legal_parser.parse(text, document_type)


# ============================================
# SINGLETON ACCESS
# ============================================

_service_instance = None

def get_document_intelligence_service() -> DocumentIntelligenceService:
    """Get singleton service instance."""
    global _service_instance
    if _service_instance is None:
        _service_instance = DocumentIntelligenceService()
    return _service_instance


# ============================================
# EXPORTS
# ============================================

__all__ = [
    'DocumentIntelligenceService',
    'DocumentIntelligenceResult',
    'AzureDocumentIntelligence',
    'TableReconstructor',
    'ConfidenceValidator',
    'get_document_intelligence_service',
    # Re-export from enhanced_legal_parser
    'EnhancedLegalParser',
    'LegalDocumentData',
    'PersonRecord',
    'ExtractedField',
    'BoundingBox',
    'OpenCVPreprocessor',
    'VisualDiffGenerator',
    'ConfidenceColors',
    'get_legal_parser',
]
