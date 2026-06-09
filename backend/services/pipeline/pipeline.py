"""
Document Processing Pipeline - Main Orchestrator
==================================================
Full pipeline:
  Upload → OCR → Classification → Extraction → Aggregation → Validation → AI Facts → DOCX Generation → CCTNS JSON

AI Usage (STRICTLY LIMITED TO):
  - Brief Facts generation
  - Remand Narrative generation
  - Telugu translation (in OCR)

All other extraction is regex/rule-based.
"""
import os
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field

from .ocr_service import OCRService, OCRResult
from .file_classifier import FileClassifier, ClassificationResult, DocumentType
from .extraction_service import ExtractionService, ExtractionResult
from .witness_service import WitnessService
from .aggregator_service import AggregatorService, UnifiedSchema
from .validation_service import ValidationService, ValidationResult
from .template_service import TemplateService

logger = logging.getLogger(__name__)


@dataclass
class PipelineResult:
    """Complete pipeline result."""
    success: bool
    unified_schema: Optional[UnifiedSchema] = None
    validation: Optional[ValidationResult] = None
    documents: Dict[str, bytes] = field(default_factory=dict)  # chargesheet, casediary, remand
    cctns_json: Dict[str, str] = field(default_factory=dict)
    processing_log: List[Dict[str, Any]] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    
    # Stats
    files_processed: int = 0
    files_classified: Dict[str, int] = field(default_factory=dict)
    extraction_stats: Dict[str, int] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "unified_data": self.unified_schema.to_dict() if self.unified_schema else None,
            "validation": self.validation.to_dict() if self.validation else None,
            "cctns_json": self.cctns_json,
            "processing_log": self.processing_log,
            "errors": self.errors,
            "warnings": self.warnings,
            "stats": {
                "files_processed": self.files_processed,
                "files_classified": self.files_classified,
                "extraction": self.extraction_stats
            }
        }


class DocumentPipeline:
    """
    Main document processing pipeline orchestrator.
    
    Pipeline Flow:
    1. OCR Service: Extract text from all files
    2. File Classifier: Detect document types
    3. Extraction Service: Extract structured data (regex-only)
    4. Aggregator Service: Merge into unified schema
    5. Validation Service: Check required fields
    6. AI Service: Generate brief facts & remand narrative (ONLY AI step)
    7. Template Service: Generate DOCX documents
    8. CCTNS Export: Generate flat JSON
    """
    
    def __init__(self, 
                 emergent_llm_key: Optional[str] = None,
                 templates_dir: Optional[Path] = None):
        """
        Initialize pipeline with all services.
        
        Args:
            emergent_llm_key: API key for AI facts generation (optional)
            templates_dir: Path to DOCX templates directory
        """
        self.emergent_llm_key = emergent_llm_key or os.environ.get('EMERGENT_LLM_KEY', '')
        
        # Initialize all services
        self.ocr_service = OCRService()
        self.file_classifier = FileClassifier()
        self.extraction_service = ExtractionService()
        self.witness_service = WitnessService()
        self.aggregator_service = AggregatorService()
        self.validation_service = ValidationService()
        self.template_service = TemplateService(templates_dir)
        
        logger.info("Document Pipeline initialized")
    
    async def process(self, 
                     file_paths: List[Path],
                     case_info: Optional[Dict[str, str]] = None,
                     generate_ai_facts: bool = True) -> PipelineResult:
        """
        Process multiple files through the full pipeline.
        
        Args:
            file_paths: List of paths to uploaded files
            case_info: Optional case metadata (police_station, district, etc.)
            generate_ai_facts: Whether to use AI for brief facts (default True)
            
        Returns:
            PipelineResult with all outputs
        """
        result = PipelineResult(success=False)
        result.files_processed = len(file_paths)
        
        try:
            # Step 1: OCR - Extract text from all files
            logger.info(f"Step 1: OCR - Processing {len(file_paths)} files")
            ocr_results = self._step_ocr(file_paths, result)
            
            # Step 2: Classification - Detect document types
            logger.info("Step 2: Classification")
            classifications = self._step_classify(ocr_results, result)
            
            # Step 3: Extraction - Extract structured data (REGEX ONLY)
            logger.info("Step 3: Extraction (Regex-based)")
            extractions = self._step_extract(ocr_results, classifications, result)
            
            # Step 4: Aggregation - Merge into unified schema
            logger.info("Step 4: Aggregation")
            unified_schema = self._step_aggregate(extractions, case_info, result)
            
            # Step 5: Validation - Check required fields
            logger.info("Step 5: Validation")
            validation = self._step_validate(unified_schema, result)
            
            # Step 6: AI Facts Generation (ONLY AI STEP)
            if generate_ai_facts and self.emergent_llm_key:
                logger.info("Step 6: AI Facts Generation (Brief Facts + Remand Narrative)")
                await self._step_ai_facts(unified_schema, result)
            else:
                result.warnings.append("AI facts generation skipped (no API key or disabled)")
            
            # Step 7: Document Generation (Template-based)
            logger.info("Step 7: Document Generation")
            self._step_generate_documents(unified_schema, case_info, result)
            
            # Step 8: CCTNS Export
            logger.info("Step 8: CCTNS JSON Export")
            result.cctns_json = unified_schema.to_flat_cctns()
            
            result.unified_schema = unified_schema
            result.validation = validation
            result.success = validation.is_valid
            
            logger.info(f"Pipeline complete: success={result.success}, "
                       f"completeness={validation.completeness_score:.1f}%")
            
        except Exception as e:
            logger.error(f"Pipeline error: {e}")
            result.errors.append(str(e))
            result.success = False
        
        return result
    
    def _step_ocr(self, file_paths: List[Path], result: PipelineResult) -> List[Tuple[OCRResult, Path]]:
        """Step 1: OCR text extraction."""
        ocr_results = []
        
        for file_path in file_paths:
            ocr_result = self.ocr_service.extract_text(file_path)
            ocr_results.append((ocr_result, file_path))
            
            result.processing_log.append({
                "step": "ocr",
                "file": file_path.name,
                "success": ocr_result.success,
                "chars": ocr_result.char_count,
                "error": ocr_result.error
            })
            
            if not ocr_result.success:
                result.warnings.append(f"OCR failed for {file_path.name}: {ocr_result.error}")
        
        return ocr_results
    
    def _step_classify(self, ocr_results: List[Tuple[OCRResult, Path]], 
                       result: PipelineResult) -> List[ClassificationResult]:
        """Step 2: Document classification."""
        classifications = []
        
        for ocr_result, file_path in ocr_results:
            if ocr_result.success and ocr_result.text:
                classification = self.file_classifier.classify(
                    ocr_result.text, 
                    file_path.name
                )
            else:
                classification = ClassificationResult(
                    document_type=DocumentType.UNKNOWN,
                    confidence=0.0,
                    source_file=file_path.name,
                    matched_keywords=[],
                    extracted_identifiers={}
                )
            
            classifications.append(classification)
            
            # Track classification stats
            doc_type = classification.document_type.value
            result.files_classified[doc_type] = result.files_classified.get(doc_type, 0) + 1
            
            result.processing_log.append({
                "step": "classify",
                "file": file_path.name,
                "type": doc_type,
                "confidence": classification.confidence,
                "keywords": classification.matched_keywords[:3]
            })
        
        return classifications
    
    def _step_extract(self, ocr_results: List[Tuple[OCRResult, Path]],
                      classifications: List[ClassificationResult],
                      result: PipelineResult) -> List[ExtractionResult]:
        """Step 3: Regex-based data extraction."""
        extractions = []
        
        for (ocr_result, file_path), classification in zip(ocr_results, classifications):
            if ocr_result.success and ocr_result.text:
                extraction = self.extraction_service.extract(
                    ocr_result.text,
                    classification
                )
            else:
                extraction = ExtractionResult(
                    document_type=classification.document_type,
                    source_file=file_path.name
                )
            
            extractions.append(extraction)
            
            result.processing_log.append({
                "step": "extract",
                "file": file_path.name,
                "accused_count": len(extraction.accused_persons),
                "witness_count": len(extraction.witnesses),
                "has_complainant": extraction.complainant is not None,
                "fir_number": extraction.fir_number
            })
        
        # Update extraction stats
        total_accused = sum(len(e.accused_persons) for e in extractions)
        total_witnesses = sum(len(e.witnesses) for e in extractions)
        
        result.extraction_stats = {
            "total_accused": total_accused,
            "total_witnesses": total_witnesses,
            "fir_found": any(e.fir_number for e in extractions)
        }
        
        return extractions
    
    def _step_aggregate(self, extractions: List[ExtractionResult],
                        case_info: Optional[Dict[str, str]],
                        result: PipelineResult) -> UnifiedSchema:
        """Step 4: Aggregate into unified schema."""
        unified = self.aggregator_service.aggregate(extractions, case_info)
        
        result.processing_log.append({
            "step": "aggregate",
            "accused_final": len(unified.accused),
            "witnesses_final": len(unified.witnesses),
            "fir_number": unified.fir.number,
            "sections": len(unified.fir.sections)
        })
        
        return unified
    
    def _step_validate(self, schema: UnifiedSchema, 
                       result: PipelineResult) -> ValidationResult:
        """Step 5: Validate unified schema."""
        validation = self.validation_service.validate(schema)
        
        result.processing_log.append({
            "step": "validate",
            "is_valid": validation.is_valid,
            "completeness": validation.completeness_score,
            "errors": len(validation.missing_required),
            "warnings": len(validation.missing_optional)
        })
        
        # Add validation issues to result
        for issue in validation.issues:
            if issue.severity == "error":
                result.errors.append(f"Validation: {issue.message}")
            else:
                result.warnings.append(f"Validation: {issue.message}")
        
        return validation
    
    async def _step_ai_facts(self, schema: UnifiedSchema, result: PipelineResult):
        """
        Step 6: AI-generated brief facts and remand narrative.
        THIS IS THE ONLY STEP THAT USES AI/LLM.
        """
        if not self.emergent_llm_key:
            result.warnings.append("Skipping AI facts: No API key")
            return
        
        try:
            from services.llm_compat import LlmChat, UserMessage
            
            # Prepare context for AI
            raw_facts = schema.facts.raw[:10000]  # Limit context size
            accused_names = ", ".join([a.name for a in schema.accused if a.name])
            sections = ", ".join(schema.fir.sections)
            
            # Generate Brief Facts
            brief_facts_prompt = f"""Based on the following case documents, generate a professional legal "Brief Facts" summary in 3-4 paragraphs for a police Charge Sheet:

FIR Number: {schema.fir.number}
Sections: {sections}
Complainant: {schema.complainant.name if schema.complainant else 'Unknown'}
Accused: {accused_names}
Place: {schema.incident.place}
Date: {schema.incident.date}

Raw document contents:
{raw_facts}

Write formal, factual brief facts suitable for a Charge Sheet. Include:
1. Complaint registration details
2. Nature of offense
3. Role of accused
4. Evidence collected
Do NOT include opinions or assumptions. Stick to documented facts."""

            chat = LlmChat(
                api_key=self.emergent_llm_key,
                session_id=f"facts-{schema.fir.number or 'new'}",
                system_message="You are a legal document assistant for Indian Police Charge Sheets. Generate formal, factual content."
            ).with_model("openai", "gpt-5.2")
            
            response = await chat.send_message(UserMessage(text=brief_facts_prompt))
            schema.facts.ai_generated = response.strip()
            
            result.processing_log.append({
                "step": "ai_facts",
                "type": "brief_facts",
                "length": len(schema.facts.ai_generated)
            })
            
            # Generate Remand Narrative
            remand_prompt = f"""Generate "Reasons for Arrest" for a Remand Case Diary based on:

Sections: {sections}
Accused: {accused_names}

Brief facts: {schema.facts.ai_generated[:2000]}

Write 5 numbered points explaining:
1. The cognizable offense committed
2. Evidence linking accused to offense
3. Risk of absconding
4. Risk of tampering with evidence
5. Need for custody for investigation

Use formal legal language suitable for court submission."""

            remand_response = await chat.send_message(UserMessage(text=remand_prompt))
            schema.facts.remand_narrative = remand_response.strip()
            
            result.processing_log.append({
                "step": "ai_facts",
                "type": "remand_narrative",
                "length": len(schema.facts.remand_narrative)
            })
            
        except Exception as e:
            logger.error(f"AI facts generation failed: {e}")
            result.warnings.append(f"AI facts generation failed: {str(e)}")
    
    def _step_generate_documents(self, schema: UnifiedSchema,
                                 case_info: Optional[Dict[str, str]],
                                 result: PipelineResult):
        """Step 7: Generate DOCX documents from templates."""
        try:
            documents = self.template_service.generate_all(schema, case_info)
            result.documents = documents
            
            result.processing_log.append({
                "step": "generate",
                "chargesheet_size": len(documents.get('chargesheet', b'')),
                "casediary_size": len(documents.get('casediary', b'')),
                "remand_size": len(documents.get('remand', b''))
            })
            
        except Exception as e:
            logger.error(f"Document generation failed: {e}")
            result.errors.append(f"Document generation failed: {str(e)}")
    
    def process_sync(self, file_paths: List[Path],
                    case_info: Optional[Dict[str, str]] = None,
                    generate_ai_facts: bool = True) -> PipelineResult:
        """
        Synchronous wrapper for process().
        Use this in non-async contexts.
        """
        import asyncio
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(
                self.process(file_paths, case_info, generate_ai_facts)
            )
        finally:
            loop.close()
