"""
Aggregator Service - Unified JSON Schema Builder
==================================================
Merges extracted data from multiple documents into a single unified schema.

Unified Schema:
{
  "fir": {
    "number": "57/2026",
    "date": "01.03.2026",
    "police_station": "Makthal",
    "district": "Narayanpet"
  },
  "complainant": { ... },
  "accused": [ ... ],
  "witnesses": [ ... ],
  "incident": {
    "date": "",
    "time": "",
    "place": "",
    "description": ""
  },
  "medical": { ... },
  "facts": {
    "raw": "",
    "ai_generated": ""  # Only field for AI
  },
  "sections": [],
  "property": {
    "lost": "",
    "recovered": ""
  },
  "notices": {
    "section_35_3_dates": []
  }
}
"""
import logging
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional
from .file_classifier import DocumentType
from .extraction_service import ExtractionResult, PersonDetails, OffenseDetails
from .witness_service import WitnessService, ClassifiedWitness

logger = logging.getLogger(__name__)


@dataclass
class FIRDetails:
    """FIR identification details."""
    number: str = ""
    date: str = ""
    police_station: str = ""
    district: str = ""
    sections: List[str] = field(default_factory=list)


@dataclass
class PersonRecord:
    """Person record in unified schema."""
    serial: str = ""
    name: str = ""
    father_name: str = ""
    age: Optional[int] = None
    gender: str = ""
    caste: str = ""
    occupation: str = ""
    address: str = ""
    phone: str = ""
    aadhaar: str = ""
    role: str = ""


@dataclass
class IncidentDetails:
    """Incident/offense details."""
    date: str = ""
    time: str = ""
    place: str = ""
    type: str = ""
    description: str = ""


@dataclass
class MedicalDetails:
    """Medical examination details."""
    findings: str = ""
    doctor_name: str = ""
    hospital: str = ""
    date: str = ""


@dataclass
class PropertyDetails:
    """Property lost/recovered details."""
    lost: str = ""
    recovered: str = ""
    seized_items: List[str] = field(default_factory=list)


@dataclass
class NoticeDetails:
    """Legal notices served."""
    section_35_3_dates: List[str] = field(default_factory=list)
    appearance_dates: List[str] = field(default_factory=list)


@dataclass
class FactsDetails:
    """Case facts (raw + AI-generated)."""
    raw: str = ""  # Extracted from documents
    ai_generated: str = ""  # AI-generated brief facts (ONLY AI field)
    remand_narrative: str = ""  # AI-generated remand narrative (ONLY AI field)


@dataclass
class UnifiedSchema:
    """Complete unified case schema."""
    fir: FIRDetails = field(default_factory=FIRDetails)
    complainant: PersonRecord = field(default_factory=PersonRecord)
    accused: List[PersonRecord] = field(default_factory=list)
    witnesses: List[PersonRecord] = field(default_factory=list)
    incident: IncidentDetails = field(default_factory=IncidentDetails)
    medical: MedicalDetails = field(default_factory=MedicalDetails)
    property: PropertyDetails = field(default_factory=PropertyDetails)
    notices: NoticeDetails = field(default_factory=NoticeDetails)
    facts: FactsDetails = field(default_factory=FactsDetails)
    arrest_details: Dict[str, str] = field(default_factory=dict)
    io_details: Dict[str, str] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)
    
    def to_flat_cctns(self) -> Dict[str, str]:
        """Convert to flat CCTNS export format."""
        return {
            "fir_number": self.fir.number,
            "fir_date": self.fir.date,
            "police_station": self.fir.police_station,
            "district": self.fir.district,
            "sections": ", ".join(self.fir.sections),
            "complainant_name": self.complainant.name,
            "complainant_father": self.complainant.father_name,
            "complainant_age": str(self.complainant.age) if self.complainant.age else "",
            "complainant_address": self.complainant.address,
            "complainant_phone": self.complainant.phone,
            "accused_1_name": self.accused[0].name if self.accused else "",
            "accused_1_father": self.accused[0].father_name if self.accused else "",
            "accused_1_age": str(self.accused[0].age) if self.accused and self.accused[0].age else "",
            "accused_1_address": self.accused[0].address if self.accused else "",
            "accused_count": str(len(self.accused)),
            "witness_count": str(len(self.witnesses)),
            "incident_date": self.incident.date,
            "incident_time": self.incident.time,
            "incident_place": self.incident.place,
            "property_lost": self.property.lost,
            "property_recovered": self.property.recovered,
            "brief_facts": self.facts.ai_generated or self.facts.raw[:500],
        }


class AggregatorService:
    """
    Aggregates extracted data from multiple documents into unified schema.
    NO AI/LLM - pure data merging logic.
    """
    
    def __init__(self):
        """Initialize aggregator."""
        self.witness_service = WitnessService()
    
    def aggregate(self, extraction_results: List[ExtractionResult],
                 case_info: Optional[Dict[str, str]] = None) -> UnifiedSchema:
        """
        Aggregate multiple extraction results into unified schema.
        
        Args:
            extraction_results: List of ExtractionResult from different documents
            case_info: Optional case info override (police_station, district, etc.)
            
        Returns:
            UnifiedSchema with merged data
        """
        schema = UnifiedSchema()
        
        # Track best sources for each field
        fir_source = None
        cd_source = None
        
        # Collect all persons for deduplication
        all_accused = []
        all_witnesses = []
        raw_facts_parts = []
        
        for result in extraction_results:
            # Prioritize FIR for basic case info
            if result.document_type == DocumentType.FIR:
                fir_source = result
                self._merge_fir_data(schema, result)
            
            # Case Diary supplements FIR
            elif result.document_type == DocumentType.CASE_DIARY:
                cd_source = result
                self._merge_case_diary_data(schema, result)
            
            # Medical reports
            elif result.document_type == DocumentType.MEDICAL:
                self._merge_medical_data(schema, result)
            
            # Section 35(3) notices
            elif result.document_type == DocumentType.SECTION_35_3:
                schema.notices.section_35_3_dates.extend(result.section_35_3_dates)
            
            # Collect accused from all sources
            all_accused.extend(result.accused_persons)
            
            # Collect witnesses from all sources
            all_witnesses.extend(result.witnesses)
            
            # Collect raw facts
            if result.brief_facts_raw:
                raw_facts_parts.append(f"[{result.source_file}]\n{result.brief_facts_raw}")
            
            # Merge other identifiers
            if result.fir_number and not schema.fir.number:
                schema.fir.number = result.fir_number
            if result.police_station and not schema.fir.police_station:
                schema.fir.police_station = result.police_station
            if result.district and not schema.fir.district:
                schema.fir.district = result.district
            if result.sections:
                schema.fir.sections.extend(result.sections)
            
            # Property
            if result.property_lost:
                schema.property.lost = result.property_lost
            if result.property_recovered:
                schema.property.recovered = result.property_recovered
        
        # Apply case_info overrides
        if case_info:
            if case_info.get('fir_number'):
                schema.fir.number = case_info['fir_number']
            if case_info.get('police_station'):
                schema.fir.police_station = case_info['police_station']
            if case_info.get('district'):
                schema.fir.district = case_info['district']
            if case_info.get('sections'):
                schema.fir.sections.append(case_info['sections'])
            if case_info.get('io_name'):
                schema.io_details['name'] = case_info['io_name']
            if case_info.get('io_rank'):
                schema.io_details['rank'] = case_info['io_rank']
        
        # Deduplicate and merge accused
        schema.accused = self._deduplicate_persons(all_accused, "Accused")
        
        # Deduplicate and classify witnesses
        deduped_witnesses = self._deduplicate_persons(all_witnesses, "Witness")
        classified = self.witness_service.classify_witnesses(
            [self._record_to_details(w) for w in deduped_witnesses],
            self._record_to_details(schema.complainant) if schema.complainant.name else None
        )
        
        # Convert classified witnesses back to PersonRecord
        schema.witnesses = [self._classified_to_record(cw) for cw in classified]
        
        # Deduplicate sections
        schema.fir.sections = list(set(schema.fir.sections))
        
        # Deduplicate notice dates
        schema.notices.section_35_3_dates = list(set(schema.notices.section_35_3_dates))
        
        # Merge raw facts
        schema.facts.raw = "\n\n---\n\n".join(raw_facts_parts)
        
        logger.info(f"Aggregated {len(extraction_results)} documents: "
                   f"{len(schema.accused)} accused, "
                   f"{len(schema.witnesses)} witnesses")
        
        return schema
    
    def _merge_fir_data(self, schema: UnifiedSchema, result: ExtractionResult):
        """Merge FIR-specific data."""
        schema.fir.number = result.fir_number or schema.fir.number
        schema.fir.date = result.fir_date or schema.fir.date
        schema.fir.police_station = result.police_station or schema.fir.police_station
        schema.fir.district = result.district or schema.fir.district
        
        if result.complainant:
            schema.complainant = self._details_to_record(result.complainant)
        
        if result.offense_details:
            schema.incident = IncidentDetails(
                date=result.offense_details.date,
                time=result.offense_details.time,
                place=result.offense_details.place,
                type=result.offense_details.type,
                description=result.offense_details.description
            )
    
    def _merge_case_diary_data(self, schema: UnifiedSchema, result: ExtractionResult):
        """Merge Case Diary data (supplements FIR)."""
        # Only fill in gaps
        if not schema.fir.number and result.fir_number:
            schema.fir.number = result.fir_number
        
        if not schema.complainant.name and result.complainant:
            schema.complainant = self._details_to_record(result.complainant)
    
    def _merge_medical_data(self, schema: UnifiedSchema, result: ExtractionResult):
        """Merge medical report data."""
        schema.medical.findings = result.medical_findings
    
    def _details_to_record(self, details: PersonDetails) -> PersonRecord:
        """Convert PersonDetails to PersonRecord."""
        return PersonRecord(
            serial=details.serial,
            name=details.name,
            father_name=details.father_name,
            age=details.age,
            gender=details.gender,
            caste=details.caste,
            occupation=details.occupation,
            address=details.address,
            phone=details.phone,
            aadhaar=details.aadhaar,
            role=details.role
        )
    
    def _record_to_details(self, record: PersonRecord) -> PersonDetails:
        """Convert PersonRecord to PersonDetails."""
        return PersonDetails(
            serial=record.serial,
            name=record.name,
            father_name=record.father_name,
            age=record.age,
            gender=record.gender,
            caste=record.caste,
            occupation=record.occupation,
            address=record.address,
            phone=record.phone,
            aadhaar=record.aadhaar,
            role=record.role
        )
    
    def _classified_to_record(self, cw: ClassifiedWitness) -> PersonRecord:
        """Convert ClassifiedWitness to PersonRecord."""
        return PersonRecord(
            serial=cw.serial,
            name=cw.name,
            father_name=cw.father_name,
            age=cw.age,
            caste=cw.caste,
            occupation=cw.occupation,
            address=cw.address,
            phone=cw.phone,
            role=cw.role
        )
    
    def _deduplicate_persons(self, persons: List[PersonDetails], role: str) -> List[PersonRecord]:
        """
        Deduplicate persons by name similarity.
        
        Args:
            persons: List of PersonDetails to deduplicate
            role: Default role for persons
            
        Returns:
            List of deduplicated PersonRecord
        """
        seen_names = {}  # name_normalized -> PersonRecord
        result = []
        
        for person in persons:
            if not person.name:
                continue
            
            # Normalize name for comparison
            name_norm = person.name.lower().strip()
            
            if name_norm in seen_names:
                # Merge with existing record
                existing = seen_names[name_norm]
                self._merge_person_fields(existing, person)
            else:
                # Add new record
                record = self._details_to_record(person)
                if not record.role:
                    record.role = role
                seen_names[name_norm] = record
                result.append(record)
        
        # Assign serials if missing
        for i, record in enumerate(result):
            if not record.serial:
                if role == "Accused":
                    record.serial = f"A{i+1}"
                elif role == "Witness":
                    record.serial = f"LW-{i+1}"
                else:
                    record.serial = str(i+1)
        
        return result
    
    def _merge_person_fields(self, existing: PersonRecord, new: PersonDetails):
        """Merge fields from new into existing (fill gaps only)."""
        if not existing.father_name and new.father_name:
            existing.father_name = new.father_name
        if not existing.age and new.age:
            existing.age = new.age
        if not existing.caste and new.caste:
            existing.caste = new.caste
        if not existing.occupation and new.occupation:
            existing.occupation = new.occupation
        if not existing.address and new.address:
            existing.address = new.address
        if not existing.phone and new.phone:
            existing.phone = new.phone
        if not existing.aadhaar and new.aadhaar:
            existing.aadhaar = new.aadhaar
