"""
Global Case Context - The central data model for the Unified Intelligence Pipeline.
This context is shared across all tools and modules.
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid


class ExtractedEntity(BaseModel):
    """Entity extracted from petition/complaint"""
    entity_type: str  # name, phone, vehicle, address, section, date, amount
    value: str
    confidence: float = 1.0
    source: str = ""  # which document/input it came from


class AccusedPerson(BaseModel):
    """Accused person details (A1, A2, etc.)"""
    serial: str  # A1, A2, etc.
    name: str
    father_name: Optional[str] = ""
    age: Optional[int] = None
    caste: Optional[str] = ""
    occupation: Optional[str] = ""
    address: Optional[str] = ""
    phone: Optional[str] = ""
    status: str = "At Large"  # At Large, Arrested, On Bail, Absconding


class WitnessPerson(BaseModel):
    """Witness details (LW-1, LW-2, etc.)"""
    serial: str  # LW-1, LW-2, etc.
    name: str
    father_name: Optional[str] = ""
    age: Optional[int] = None
    caste: Optional[str] = ""
    occupation: Optional[str] = ""
    address: Optional[str] = ""
    phone: Optional[str] = ""
    role: str = ""  # Complainant, Eyewitness, Panch, IO, etc.


class EvidenceItem(BaseModel):
    """Evidence/Material Object"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    file_name: str
    file_type: str
    file_url: Optional[str] = ""
    sha256_hash: str
    description: Optional[str] = ""
    seized_from: Optional[str] = ""
    seizure_date: Optional[str] = ""
    bsa_certificate_generated: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CaseDiaryEntry(BaseModel):
    """Case Diary Entry (Sec 172 BNSS)"""
    entry_number: int
    date: str
    time: Optional[str] = ""
    action_taken: str
    witnesses_examined: List[str] = []
    evidence_collected: List[str] = []
    officer_name: str
    officer_rank: str


class GlobalCaseContext(BaseModel):
    """
    The Global Case Context - Central data model for the Unified Intelligence Pipeline.
    All tools pull from and contribute to this context.
    """
    model_config = ConfigDict(extra="ignore")
    
    # Identifiers
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    fir_number: Optional[str] = ""
    crime_number: Optional[str] = ""
    charge_sheet_number: Optional[str] = ""
    
    # Case Info
    police_station: str = ""
    district: str = ""
    circle: str = ""
    
    # Dates
    date_of_offense: Optional[str] = ""
    time_of_offense: Optional[str] = ""
    date_of_fir: Optional[str] = ""
    date_of_charge_sheet: Optional[str] = ""
    
    # Location
    place_of_offense: str = ""
    jurisdiction_court: str = ""
    
    # Legal Sections
    sections_of_law: List[str] = []  # ["329(4) BNS", "115(2) BNS"]
    ipc_equivalent: List[str] = []
    
    # Offense Details
    offense_type: str = ""  # Theft, Cheating, Assault, etc.
    brief_facts: str = ""  # Original petition/complaint text
    translated_facts: str = ""  # English translation
    legal_facts: str = ""  # Formal legal language version
    
    # Complainant
    complainant_name: str = ""
    complainant_father_name: Optional[str] = ""
    complainant_age: Optional[int] = None
    complainant_caste: Optional[str] = ""
    complainant_occupation: Optional[str] = ""
    complainant_address: Optional[str] = ""
    complainant_phone: Optional[str] = ""
    
    # Parties
    accused_persons: List[AccusedPerson] = []
    witnesses: List[WitnessPerson] = []
    
    # Evidence
    evidence_items: List[EvidenceItem] = []
    property_lost: Optional[str] = ""
    property_recovered: Optional[str] = ""
    
    # Investigation
    investigating_officer: str = ""
    io_rank: str = ""
    io_phone: Optional[str] = ""
    case_diary_entries: List[CaseDiaryEntry] = []
    
    # Extracted Entities (from AI)
    extracted_entities: List[ExtractedEntity] = []
    
    # Status
    status: str = "Under Investigation"  # Under Investigation, Charge Sheet Filed, Closed, etc.
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str = ""  # officer_id


class CaseContextCreate(BaseModel):
    """Request model for creating a new case context"""
    fir_number: Optional[str] = ""
    police_station: str
    district: str
    offense_type: Optional[str] = ""


class CaseContextUpdate(BaseModel):
    """Request model for updating case context"""
    fir_number: Optional[str] = None
    crime_number: Optional[str] = None
    sections_of_law: Optional[List[str]] = None
    brief_facts: Optional[str] = None
    translated_facts: Optional[str] = None
    legal_facts: Optional[str] = None
    complainant_name: Optional[str] = None
    complainant_phone: Optional[str] = None
    complainant_address: Optional[str] = None
    accused_persons: Optional[List[AccusedPerson]] = None
    witnesses: Optional[List[WitnessPerson]] = None
    status: Optional[str] = None


class CCTNSExportData(BaseModel):
    """
    CCTNS Export Data - JSON structure for browser extension auto-fill.
    Maps to CCTNS portal form fields.
    """
    # FIR Form Fields
    fir_number: str
    police_station: str
    district: str
    date_of_fir: str
    
    # Offense Details
    sections: List[str]
    date_of_offense: str
    time_of_offense: str
    place_of_offense: str
    
    # Complainant
    complainant: Dict[str, Any]
    
    # Accused List
    accused: List[Dict[str, Any]]
    
    # Witness List
    witnesses: List[Dict[str, Any]]
    
    # Brief Facts
    brief_facts: str
    
    # Evidence
    property_details: Optional[str] = ""
    
    # IO Details
    investigating_officer: Dict[str, str]
