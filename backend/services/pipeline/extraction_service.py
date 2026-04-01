"""
Extraction Service - Regex-Based Data Extraction
==================================================
Extracts structured data from classified documents using ONLY regex/rules.
NO AI/LLM for extraction - deterministic patterns only.

Extracts:
  - Personal details (name, father's name, age, caste, occupation, address, phone)
  - Case details (FIR number, date, time, place, sections)
  - Accused persons
  - Witnesses
  - Medical findings
  - Property details
  - Section 35(3) notice dates
"""
import re
import logging
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from .file_classifier import DocumentType, ClassificationResult

logger = logging.getLogger(__name__)


@dataclass
class PersonDetails:
    """Extracted person details."""
    name: str = ""
    father_name: str = ""
    age: Optional[int] = None
    gender: str = ""
    caste: str = ""
    occupation: str = ""
    address: str = ""
    phone: str = ""
    aadhaar: str = ""
    serial: str = ""
    role: str = ""  # Complainant, Accused, Witness, etc.


@dataclass
class OffenseDetails:
    """Extracted offense details."""
    type: str = ""
    date: str = ""
    time: str = ""
    place: str = ""
    description: str = ""


@dataclass
class ExtractionResult:
    """Result of data extraction from a document."""
    document_type: DocumentType
    source_file: str
    complainant: Optional[PersonDetails] = None
    accused_persons: List[PersonDetails] = field(default_factory=list)
    witnesses: List[PersonDetails] = field(default_factory=list)
    offense_details: Optional[OffenseDetails] = None
    fir_number: str = ""
    fir_date: str = ""
    police_station: str = ""
    district: str = ""
    sections: List[str] = field(default_factory=list)
    brief_facts_raw: str = ""  # Raw text for AI processing later
    property_lost: str = ""
    property_recovered: str = ""
    medical_findings: str = ""
    section_35_3_dates: List[str] = field(default_factory=list)
    arrest_details: Dict[str, str] = field(default_factory=dict)
    raw_data: Dict[str, Any] = field(default_factory=dict)


class ExtractionService:
    """
    Rule-based extraction service using regex patterns.
    NO AI/LLM usage - pure pattern matching.
    """
    
    # Person name patterns (handles Indian naming conventions)
    NAME_PATTERNS = [
        r'(?:Sri\.?|Smt\.?|Shri\.?|Mr\.?|Mrs\.?|Ms\.?)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
        r'Name\s*[:.]?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
        r'(\d+)\.\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+[Ss]/[Oo]',  # Serial + Name
    ]
    
    # Father's name patterns
    FATHER_PATTERNS = [
        r'[Ss]/[Oo]\s+(?:Sri\.?|Shri\.?|Mr\.?)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
        r'[Ss]on\s+[Oo]f\s+(?:Sri\.?|Shri\.?|Mr\.?)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
        r'[Dd]/[Oo]\s+(?:Sri\.?|Shri\.?|Mr\.?)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
        r'[Ww]/[Oo]\s+(?:Sri\.?|Shri\.?|Mr\.?)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
    ]
    
    # Age patterns
    AGE_PATTERNS = [
        r'[Aa]ge\s*[:.]?\s*(\d{1,3})\s*(?:[Yy](?:ea)?rs?\.?)?',
        r'(\d{1,3})\s*[Yy](?:ea)?rs?\.?\s*(?:old)?',
        r',\s*(\d{1,3})\s*[Yy](?:rs)?\.?,',
    ]
    
    # Caste patterns
    CASTE_PATTERNS = [
        r'[Cc]aste\s*[:.]?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',
        r'(?:BC|OC|SC|ST|OBC)\s*[-–]?\s*([A-Za-z]+)',
    ]
    
    # Occupation patterns
    OCCUPATION_PATTERNS = [
        r'[Oo]cc(?:upation)?\.?\s*[:.]?\s*([A-Za-z]+(?:\s+[A-Za-z]+)*)',
        r'[Pp]rofession\s*[:.]?\s*([A-Za-z]+(?:\s+[A-Za-z]+)*)',
    ]
    
    # Address patterns
    ADDRESS_PATTERNS = [
        r'[Rr]/[Oo]\s+(.+?)(?=\s*(?:Ph\.?|Phone|Mobile|\d{10}|,\s*[A-Z]|$))',
        r'[Aa]ddress\s*[:.]?\s*(.+?)(?=\s*(?:Ph\.?|Phone|Mobile|\d{10}|$))',
        r'[Rr]esiding\s+at\s+(.+?)(?=\s*(?:Ph\.?|Phone|Mobile|\d{10}|$))',
    ]
    
    # Phone patterns
    PHONE_PATTERNS = [
        r'(?:Ph\.?|Phone|Mobile|Cell|Contact)\s*[:.]?\s*(\d{10})',
        r'(\d{10})',
        r'(\+91\s*\d{10})',
    ]
    
    # FIR patterns
    FIR_PATTERNS = [
        r'(?:FIR|Crime|Cr\.?)\s*(?:No\.?|Number)\s*[:.]?\s*(\d+\s*/\s*\d{4})',
        r'(\d{1,4})\s*/\s*(20\d{2})',
    ]
    
    # Date patterns
    DATE_PATTERNS = [
        r'(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})',
        r'(\d{1,2})\s*(?:st|nd|rd|th)?\s*(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*,?\s*(\d{4})',
    ]
    
    # Time patterns
    TIME_PATTERNS = [
        r'(\d{1,2}[:.]\d{2}\s*(?:AM|PM|am|pm|hrs|Hrs)?)',
        r'at\s+(\d{1,2}\s*(?:AM|PM|am|pm))',
        r'(\d{4}\s*hrs)',
    ]
    
    # Section patterns
    SECTION_PATTERNS = [
        r'(?:U/[Ss]|Section|Sec\.?)\s*[:.]?\s*([\d,\s\(\)/]+)',
        r'(\d+(?:\s*\(\d+\))?)\s*(?:of\s+)?(?:BNS|IPC|BNSS)',
        r'Sections?\s*([\d,\s\(\)/and]+)\s*(?:of\s+)?(?:BNS|IPC)',
    ]
    
    def __init__(self):
        """Initialize with compiled regex patterns."""
        self._compile_patterns()
    
    def _compile_patterns(self):
        """Compile all regex patterns for performance."""
        self.compiled = {
            'name': [re.compile(p, re.IGNORECASE) for p in self.NAME_PATTERNS],
            'father': [re.compile(p, re.IGNORECASE) for p in self.FATHER_PATTERNS],
            'age': [re.compile(p, re.IGNORECASE) for p in self.AGE_PATTERNS],
            'caste': [re.compile(p, re.IGNORECASE) for p in self.CASTE_PATTERNS],
            'occupation': [re.compile(p, re.IGNORECASE) for p in self.OCCUPATION_PATTERNS],
            'address': [re.compile(p, re.IGNORECASE | re.DOTALL) for p in self.ADDRESS_PATTERNS],
            'phone': [re.compile(p) for p in self.PHONE_PATTERNS],
            'fir': [re.compile(p, re.IGNORECASE) for p in self.FIR_PATTERNS],
            'date': [re.compile(p, re.IGNORECASE) for p in self.DATE_PATTERNS],
            'time': [re.compile(p, re.IGNORECASE) for p in self.TIME_PATTERNS],
            'section': [re.compile(p, re.IGNORECASE) for p in self.SECTION_PATTERNS],
        }
    
    def extract(self, text: str, classification: ClassificationResult) -> ExtractionResult:
        """
        Extract structured data from document text.
        
        Args:
            text: Raw text from document
            classification: Classification result for context
            
        Returns:
            ExtractionResult with extracted data
        """
        result = ExtractionResult(
            document_type=classification.document_type,
            source_file=classification.source_file
        )
        
        # Extract based on document type
        if classification.document_type == DocumentType.FIR:
            self._extract_fir(text, result)
        elif classification.document_type == DocumentType.CASE_DIARY:
            self._extract_case_diary(text, result)
        elif classification.document_type == DocumentType.WITNESS_STATEMENT:
            self._extract_witness(text, result)
        elif classification.document_type == DocumentType.MEDICAL:
            self._extract_medical(text, result)
        elif classification.document_type == DocumentType.SECTION_35_3:
            self._extract_section_35_3(text, result)
        elif classification.document_type == DocumentType.CHARGESHEET:
            self._extract_chargesheet(text, result)
        else:
            # Generic extraction for unknown types
            self._extract_generic(text, result)
        
        # Always try to extract FIR number and sections
        self._extract_case_identifiers(text, result)
        
        return result
    
    def _extract_fir(self, text: str, result: ExtractionResult):
        """Extract data from FIR document."""
        # Extract complainant
        complainant_section = self._find_section(text, 
            [r'Complainant', r'Informant', r'Name of the Complainant'],
            [r'Accused', r'Details of Accused', r'FIR Contents']
        )
        if complainant_section:
            result.complainant = self._extract_person(complainant_section)
            result.complainant.role = "Complainant"
        
        # Extract accused persons
        accused_section = self._find_section(text,
            [r'Accused', r'Details of Accused', r'Name of Accused'],
            [r'Witness', r'Brief Facts', r'Property']
        )
        if accused_section:
            result.accused_persons = self._extract_multiple_persons(accused_section, "Accused")
        
        # Extract offense details
        result.offense_details = self._extract_offense(text)
        
        # Extract brief facts (raw - for AI processing later)
        facts_section = self._find_section(text,
            [r'Brief Facts', r'Facts of the Case', r'Gist of Information'],
            [r'Prayer', r'Signature', r'Investigation']
        )
        if facts_section:
            result.brief_facts_raw = facts_section[:5000]  # Limit length
    
    def _extract_case_diary(self, text: str, result: ExtractionResult):
        """Extract data from Case Diary."""
        # Similar to FIR but with additional diary-specific fields
        self._extract_fir(text, result)
        
        # Extract witness list
        witness_section = self._find_section(text,
            [r'Witnesses', r'Examined', r'L\.?W\.?'],
            [r'Investigation', r'Closed', r'Progress']
        )
        if witness_section:
            result.witnesses = self._extract_multiple_persons(witness_section, "Witness")
    
    def _extract_witness(self, text: str, result: ExtractionResult):
        """Extract data from Witness Statement."""
        # Extract witness number
        lw_match = re.search(r'L\.?W\.?\s*-?\s*(\d+)', text, re.IGNORECASE)
        
        witness = self._extract_person(text)
        witness.role = "Witness"
        if lw_match:
            witness.serial = f"LW-{lw_match.group(1)}"
        
        result.witnesses = [witness]
        
        # Extract statement content for facts
        statement_section = self._find_section(text,
            [r'States that', r'Statement', r'Deposition'],
            [r'Signature', r'Verified', r'Cross']
        )
        if statement_section:
            result.brief_facts_raw = statement_section[:5000]
    
    def _extract_medical(self, text: str, result: ExtractionResult):
        """Extract data from Medical Report."""
        # Extract patient details
        patient = self._extract_person(text)
        
        # Extract medical findings
        findings_section = self._find_section(text,
            [r'Findings', r'Injuries', r'Opinion', r'Examination'],
            [r'Signature', r'Doctor', r'Dated']
        )
        if findings_section:
            result.medical_findings = findings_section[:2000]
        
        result.raw_data['patient'] = patient.__dict__
    
    def _extract_section_35_3(self, text: str, result: ExtractionResult):
        """Extract Section 35(3) notice details."""
        # Extract dates
        dates = []
        for pattern in self.compiled['date']:
            matches = pattern.findall(text)
            for match in matches:
                if isinstance(match, tuple):
                    dates.append(' '.join(match))
                else:
                    dates.append(match)
        
        result.section_35_3_dates = list(set(dates))[:5]
        
        # Extract person served notice
        person = self._extract_person(text)
        if person.name:
            result.accused_persons = [person]
    
    def _extract_chargesheet(self, text: str, result: ExtractionResult):
        """Extract data from existing Charge Sheet."""
        # Full extraction similar to FIR
        self._extract_fir(text, result)
        
        # Extract witnesses
        witness_section = self._find_section(text,
            [r'Witnesses to be examined', r'List of Witnesses'],
            [r'Brief facts', r'Prayer', r'Result']
        )
        if witness_section:
            result.witnesses = self._extract_multiple_persons(witness_section, "Witness")
    
    def _extract_generic(self, text: str, result: ExtractionResult):
        """Generic extraction for unknown document types."""
        # Try to extract any person details
        persons = self._extract_multiple_persons(text, "Unknown")
        if persons:
            result.raw_data['persons'] = [p.__dict__ for p in persons]
    
    def _extract_case_identifiers(self, text: str, result: ExtractionResult):
        """Extract FIR number, sections, and other identifiers."""
        # FIR number
        for pattern in self.compiled['fir']:
            match = pattern.search(text)
            if match:
                if len(match.groups()) == 2:
                    result.fir_number = f"{match.group(1)}/{match.group(2)}"
                else:
                    result.fir_number = match.group(1)
                break
        
        # Sections
        sections = set()
        for pattern in self.compiled['section']:
            matches = pattern.findall(text)
            for match in matches:
                # Clean up section numbers
                cleaned = re.sub(r'[,\s]+', ', ', str(match).strip())
                if cleaned:
                    sections.add(cleaned)
        result.sections = list(sections)[:10]  # Limit to 10 sections
        
        # Police station
        ps_match = re.search(r'(?:P\.?S\.?|Police\s+Station)\s*[:.]?\s*([A-Za-z]+)', text, re.IGNORECASE)
        if ps_match:
            result.police_station = ps_match.group(1)
        
        # District
        dist_match = re.search(r'(?:Dist\.?|District)\s*[:.-]?\s*([A-Za-z][A-Za-z]+)', text, re.IGNORECASE)
        if dist_match:
            result.district = dist_match.group(1)
    
    def _extract_person(self, text: str) -> PersonDetails:
        """Extract a single person's details from text."""
        person = PersonDetails()
        
        # Name
        for pattern in self.compiled['name']:
            match = pattern.search(text)
            if match:
                if len(match.groups()) == 2:  # Serial + Name format
                    person.serial = match.group(1)
                    person.name = match.group(2)
                else:
                    person.name = match.group(1)
                break
        
        # Father's name
        for pattern in self.compiled['father']:
            match = pattern.search(text)
            if match:
                person.father_name = match.group(1)
                break
        
        # Age
        for pattern in self.compiled['age']:
            match = pattern.search(text)
            if match:
                try:
                    person.age = int(match.group(1))
                except ValueError:
                    pass
                break
        
        # Caste
        for pattern in self.compiled['caste']:
            match = pattern.search(text)
            if match:
                person.caste = match.group(1)
                break
        
        # Occupation
        for pattern in self.compiled['occupation']:
            match = pattern.search(text)
            if match:
                person.occupation = match.group(1)
                break
        
        # Address
        for pattern in self.compiled['address']:
            match = pattern.search(text)
            if match:
                person.address = match.group(1).strip()[:200]  # Limit length
                break
        
        # Phone
        for pattern in self.compiled['phone']:
            match = pattern.search(text)
            if match:
                phone = re.sub(r'\D', '', match.group(1))
                if len(phone) == 10:
                    person.phone = phone
                    break
        
        return person
    
    def _extract_multiple_persons(self, text: str, role: str) -> List[PersonDetails]:
        """Extract multiple persons from text (numbered list format)."""
        persons = []
        
        # Split by serial numbers (1., 2., A1., A2., LW-1, etc.)
        person_blocks = re.split(r'(?=(?:^|\n)\s*(?:A?\d+|LW-?\d+)\.?\s+)', text)
        
        for block in person_blocks:
            if len(block.strip()) < 10:
                continue
            
            person = self._extract_person(block)
            if person.name:
                person.role = role
                
                # Extract serial if not already set
                if not person.serial:
                    serial_match = re.match(r'(A?\d+|LW-?\d+)', block.strip())
                    if serial_match:
                        person.serial = serial_match.group(1)
                
                persons.append(person)
        
        # Assign serials if missing
        for i, person in enumerate(persons):
            if not person.serial:
                if role == "Accused":
                    person.serial = f"A{i+1}"
                elif role == "Witness":
                    person.serial = f"LW-{i+1}"
                else:
                    person.serial = str(i+1)
        
        return persons
    
    def _extract_offense(self, text: str) -> OffenseDetails:
        """Extract offense details."""
        offense = OffenseDetails()
        
        # Date
        for pattern in self.compiled['date']:
            match = pattern.search(text)
            if match:
                if isinstance(match.groups(), tuple) and len(match.groups()) == 3:
                    offense.date = f"{match.group(1)} {match.group(2)} {match.group(3)}"
                else:
                    offense.date = match.group(1) if match.lastindex else match.group(0)
                break
        
        # Time
        for pattern in self.compiled['time']:
            match = pattern.search(text)
            if match:
                offense.time = match.group(1)
                break
        
        # Place
        place_match = re.search(
            r'(?:Place|Location|Spot|Scene)\s*(?:of\s+(?:Occurrence|Crime|Incident))?\s*[:.]?\s*(.+?)(?=\s*(?:Date|Time|$))',
            text, re.IGNORECASE | re.DOTALL
        )
        if place_match:
            offense.place = place_match.group(1).strip()[:200]
        
        return offense
    
    def _find_section(self, text: str, start_markers: List[str], end_markers: List[str]) -> str:
        """Find a section of text between markers."""
        # Build start pattern
        start_pattern = '|'.join(start_markers)
        start_match = re.search(start_pattern, text, re.IGNORECASE)
        
        if not start_match:
            return ""
        
        start_pos = start_match.end()
        
        # Find end position
        end_pos = len(text)
        end_pattern = '|'.join(end_markers)
        end_match = re.search(end_pattern, text[start_pos:], re.IGNORECASE)
        
        if end_match:
            end_pos = start_pos + end_match.start()
        
        return text[start_pos:end_pos].strip()
    
    def batch_extract(self, texts_and_classifications: List[tuple]) -> List[ExtractionResult]:
        """
        Extract from multiple documents.
        
        Args:
            texts_and_classifications: List of (text, ClassificationResult) tuples
            
        Returns:
            List of ExtractionResult objects
        """
        results = []
        for text, classification in texts_and_classifications:
            result = self.extract(text, classification)
            results.append(result)
            logger.info(f"Extracted from {classification.source_file}: "
                       f"{len(result.accused_persons)} accused, "
                       f"{len(result.witnesses)} witnesses")
        
        return results
