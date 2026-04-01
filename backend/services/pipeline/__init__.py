"""
Modular Document Processing Pipeline
=====================================
Architecture:
  Upload → OCR → Classification → Extraction → Aggregation → Validation → DOCX Generation → CCTNS JSON

Services:
  - ocr_service: Text extraction from PDF/DOCX/DOC/Images
  - file_classifier: Detect document types (FIR, CD, Witness, Medical, etc.)
  - extraction_service: Regex/rule-based data extraction
  - witness_service: Witness role classification
  - aggregator_service: Merge extracted data into unified schema
  - validation_service: Ensure required fields are present
  - template_service: Template-based DOCX generation using docxtpl
  - pipeline: Main orchestrator for the full pipeline

AI Usage (STRICT LIMITS):
  - Brief Facts generation ONLY
  - Remand Narrative ONLY
  - Telugu translation ONLY
"""

from .ocr_service import OCRService
from .file_classifier import FileClassifier, DocumentType
from .extraction_service import ExtractionService
from .witness_service import WitnessService
from .aggregator_service import AggregatorService, UnifiedSchema
from .validation_service import ValidationService
from .template_service import TemplateService
from .pipeline import DocumentPipeline, PipelineResult

__all__ = [
    'OCRService',
    'FileClassifier',
    'DocumentType',
    'ExtractionService',
    'WitnessService',
    'AggregatorService',
    'UnifiedSchema',
    'ValidationService',
    'TemplateService',
    'DocumentPipeline',
    'PipelineResult'
]
