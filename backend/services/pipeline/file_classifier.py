"""
File Classifier Service - Document Type Detection
===================================================
Classifies uploaded documents into categories:
  - FIR (First Information Report)
  - CASE_DIARY (Case Diary entries)
  - WITNESS_STATEMENT (161 CrPC / 164 CrPC statements)
  - MEDICAL (Medical Examination Reports, Postmortem)
  - AADHAAR (Identity documents)
  - PANCHNAMA (Scene of crime, seizure memos)
  - CHARGESHEET (Existing charge sheets)
  - REMAND (Remand applications)
  - CDR (Call Detail Records)
  - CCTV (CCTV evidence)
  - UNKNOWN

Uses keyword matching and pattern recognition - NO AI.
"""
import re
import logging
from enum import Enum
from dataclasses import dataclass
from typing import Optional, List, Tuple

logger = logging.getLogger(__name__)


class DocumentType(Enum):
    """Document classification types."""
    FIR = "FIR"
    CASE_DIARY = "CASE_DIARY"
    WITNESS_STATEMENT = "WITNESS_STATEMENT"
    MEDICAL = "MEDICAL"
    AADHAAR = "AADHAAR"
    PANCHNAMA = "PANCHNAMA"
    CHARGESHEET = "CHARGESHEET"
    REMAND = "REMAND"
    CDR = "CDR"
    CCTV = "CCTV"
    SECTION_35_3 = "SECTION_35_3"
    ARREST_MEMO = "ARREST_MEMO"
    SEIZURE_MEMO = "SEIZURE_MEMO"
    FSL_REPORT = "FSL_REPORT"
    UNKNOWN = "UNKNOWN"


@dataclass
class ClassificationResult:
    """Result of document classification."""
    document_type: DocumentType
    confidence: float  # 0.0 to 1.0
    source_file: str
    matched_keywords: List[str]
    extracted_identifiers: dict  # e.g., {"fir_number": "57/2026"}


class FileClassifier:
    """
    Rule-based document classifier using keyword patterns.
    NO AI/LLM usage - pure regex and keyword matching.
    """
    
    # Keyword patterns for each document type
    PATTERNS = {
        DocumentType.FIR: {
            'keywords': [
                r'\bF\.?I\.?R\.?\b', r'First\s+Information\s+Report',
                r'Crime\s+No\.?', r'FIR\s*No\.?', r'FIR\s*Number',
                r'Cr\.?\s*No\.?', r'Section\s*154\s*Cr\.?P\.?C',
                r'ప్రథమ\s+సమాచార\s+నివేదిక'  # Telugu FIR
            ],
            'weight': 1.0
        },
        DocumentType.CASE_DIARY: {
            'keywords': [
                r'Case\s+Diary', r'C\.?D\.?\s*Part', r'CD\s*-?\s*I',
                r'Investigation\s+Diary', r'Daily\s+Diary',
                r'కేసు\s+డైరీ'  # Telugu
            ],
            'weight': 0.9
        },
        DocumentType.WITNESS_STATEMENT: {
            'keywords': [
                r'Statement\s+of\s+Witness', r'Witness\s+Statement',
                r'U/[Ss]\s*161', r'Section\s*161', r'161\s*Cr\.?P\.?C',
                r'U/[Ss]\s*164', r'Section\s*164', r'164\s*Cr\.?P\.?C',
                r'L\.?W\.?\s*-?\s*\d+', r'List\s+Witness',
                r'సాక్షి\s+వాంగ్మూలం'  # Telugu
            ],
            'weight': 0.9
        },
        DocumentType.MEDICAL: {
            'keywords': [
                r'Medical\s+Examination', r'M\.?L\.?C\.?', r'Medico\s*Legal',
                r'Postmortem', r'Post\s*-?\s*Mortem', r'Autopsy',
                r'Injury\s+Report', r'Medical\s+Report', r'Hospital',
                r'వైద్య\s+పరీక్ష'  # Telugu
            ],
            'weight': 0.9
        },
        DocumentType.AADHAAR: {
            'keywords': [
                r'Aadhaar', r'UIDAI', r'Unique\s+Identification',
                r'\d{4}\s*\d{4}\s*\d{4}',  # Aadhaar number pattern
                r'ఆధార్'  # Telugu
            ],
            'weight': 0.8
        },
        DocumentType.PANCHNAMA: {
            'keywords': [
                r'Panchnama', r'Panch\s*nama', r'Scene\s+of\s+Crime',
                r'Spot\s+Panchnama', r'Inquest\s+Report', r'Inquest\s+Panchnama',
                r'పంచనామా'  # Telugu
            ],
            'weight': 0.9
        },
        DocumentType.CHARGESHEET: {
            'keywords': [
                r'Charge\s*-?\s*Sheet', r'Final\s+Report',
                r'Section\s*173', r'173\s*Cr\.?P\.?C', r'193\s*BNSS',
                r'ఛార్జ్\s*షీట్'  # Telugu
            ],
            'weight': 0.95
        },
        DocumentType.REMAND: {
            'keywords': [
                r'Remand', r'Remand\s+Case\s+Diary', r'Remand\s+Report',
                r'Judicial\s+Custody', r'Police\s+Custody',
                r'రిమాండ్'  # Telugu
            ],
            'weight': 0.9
        },
        DocumentType.CDR: {
            'keywords': [
                r'Call\s+Detail', r'CDR', r'C\.?D\.?R\.?',
                r'IMEI', r'Tower\s+Location', r'Cell\s+ID',
                r'కాల్\s+వివరాలు'  # Telugu
            ],
            'weight': 0.85
        },
        DocumentType.SECTION_35_3: {
            'keywords': [
                r'Section\s*35\s*\(3\)', r'35\s*\(3\)\s*BNSS',
                r'Notice\s+U/[Ss]\s*35', r'Appearance\s+Notice',
                r'సెక్షన్\s*35'  # Telugu
            ],
            'weight': 0.9
        },
        DocumentType.ARREST_MEMO: {
            'keywords': [
                r'Arrest\s+Memo', r'Arrest\s+Panchnama',
                r'Memo\s+of\s+Arrest', r'Detention\s+Memo',
                r'అరెస్ట్\s+మెమో'  # Telugu
            ],
            'weight': 0.9
        },
        DocumentType.SEIZURE_MEMO: {
            'keywords': [
                r'Seizure\s+Memo', r'Seizure\s+List',
                r'Property\s+Seized', r'Mahazar',
                r'స్వాధీన\s+మెమో'  # Telugu
            ],
            'weight': 0.85
        },
        DocumentType.FSL_REPORT: {
            'keywords': [
                r'FSL', r'Forensic\s+Science', r'Lab\s+Report',
                r'DNA\s+Report', r'Fingerprint\s+Report',
                r'ఫోరెన్సిక్'  # Telugu
            ],
            'weight': 0.85
        }
    }
    
    # Identifier extraction patterns
    IDENTIFIER_PATTERNS = {
        'fir_number': [
            r'(?:FIR|Crime|Cr\.?)\s*(?:No\.?|Number)\s*[:.]?\s*(\d+\s*/\s*\d{4})',
            r'(?:FIR|Crime)\s*[:.]?\s*(\d+\s*/\s*\d{4})',
            r'(\d{1,4})\s*/\s*(20\d{2})'
        ],
        'police_station': [
            r'(?:P\.?S\.?|Police\s+Station)\s*[:.]?\s*([A-Za-z]+)',
            r'(?:PS|పోలీస్\s*స్టేషన్)\s*[:.]?\s*([A-Za-z]+)'
        ],
        'sections': [
            r'(?:U/[Ss]|Section|Sec\.?)\s*[:.]?\s*([\d,\s\(\)/]+(?:\s*(?:BNS|IPC|BNSS|CrPC))?)',
            r'(\d+(?:\s*\(\d+\))?(?:\s*,\s*\d+(?:\s*\(\d+\))?)*)\s*(?:of\s+)?(?:BNS|IPC)'
        ],
        'witness_number': [
            r'L\.?W\.?\s*-?\s*(\d+)',
            r'Witness\s*(?:No\.?)?\s*(\d+)'
        ],
        'aadhaar_number': [
            r'(\d{4}\s*\d{4}\s*\d{4})'
        ],
        'date': [
            r'(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})',
            r'(\d{1,2})\s*(?:st|nd|rd|th)?\s*([A-Za-z]+)\s*,?\s*(\d{4})'
        ]
    }
    
    def __init__(self):
        """Initialize classifier with compiled regex patterns."""
        self._compiled_patterns = {}
        
        for doc_type, config in self.PATTERNS.items():
            self._compiled_patterns[doc_type] = [
                re.compile(pattern, re.IGNORECASE | re.UNICODE)
                for pattern in config['keywords']
            ]
        
        self._identifier_patterns = {}
        for key, patterns in self.IDENTIFIER_PATTERNS.items():
            self._identifier_patterns[key] = [
                re.compile(pattern, re.IGNORECASE)
                for pattern in patterns
            ]
    
    def classify(self, text: str, filename: str = "") -> ClassificationResult:
        """
        Classify document based on text content.
        
        Args:
            text: Extracted text from document
            filename: Original filename (used for hints)
            
        Returns:
            ClassificationResult with type and confidence
        """
        if not text:
            return ClassificationResult(
                document_type=DocumentType.UNKNOWN,
                confidence=0.0,
                source_file=filename,
                matched_keywords=[],
                extracted_identifiers={}
            )
        
        scores = {}
        matched_keywords = {}
        
        # Score each document type
        for doc_type, patterns in self._compiled_patterns.items():
            matches = []
            for pattern in patterns:
                found = pattern.findall(text)
                if found:
                    matches.extend(found if isinstance(found[0], str) else [str(f) for f in found])
            
            if matches:
                weight = self.PATTERNS[doc_type]['weight']
                # Score based on number of unique matches
                score = min(len(set(matches)) * 0.2 * weight, 1.0)
                scores[doc_type] = score
                matched_keywords[doc_type] = list(set(matches))[:5]  # Top 5 matches
        
        # Check filename for hints
        filename_lower = filename.lower()
        for doc_type in DocumentType:
            if doc_type.value.lower().replace('_', '') in filename_lower:
                scores[doc_type] = scores.get(doc_type, 0) + 0.3
        
        # Get best match
        if scores:
            best_type = max(scores, key=scores.get)
            confidence = min(scores[best_type], 1.0)
        else:
            best_type = DocumentType.UNKNOWN
            confidence = 0.0
        
        # Extract identifiers
        identifiers = self._extract_identifiers(text)
        
        return ClassificationResult(
            document_type=best_type,
            confidence=confidence,
            source_file=filename,
            matched_keywords=matched_keywords.get(best_type, []),
            extracted_identifiers=identifiers
        )
    
    def _extract_identifiers(self, text: str) -> dict:
        """Extract common identifiers from text."""
        identifiers = {}
        
        for key, patterns in self._identifier_patterns.items():
            for pattern in patterns:
                match = pattern.search(text)
                if match:
                    if key == 'fir_number' and len(match.groups()) == 2:
                        identifiers[key] = f"{match.group(1)}/{match.group(2)}"
                    else:
                        identifiers[key] = match.group(1) if match.lastindex else match.group(0)
                    break
        
        return identifiers
    
    def classify_batch(self, texts: List[Tuple[str, str]]) -> List[ClassificationResult]:
        """
        Classify multiple documents.
        
        Args:
            texts: List of (text, filename) tuples
            
        Returns:
            List of ClassificationResult objects
        """
        results = []
        for text, filename in texts:
            result = self.classify(text, filename)
            results.append(result)
            logger.info(f"Classified {filename} as {result.document_type.value} (conf: {result.confidence:.2f})")
        
        return results
