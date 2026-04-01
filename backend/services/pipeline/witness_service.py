"""
Witness Service - Witness Role Classification
===============================================
Classifies witnesses into roles based on position and content:
  - Complainant (first witness, matches complainant details)
  - Eyewitness (present at scene, saw incident)
  - Panch Witness (independent witness for procedures)
  - Expert Witness (doctors, forensic experts)
  - Official Witness (IO, police officials)

Logic:
  - First witness in FIR = Complainant
  - Next 2 witnesses with scene mention = Eyewitness
  - Others = Panch Witness (unless expert/official indicators found)
"""
import re
import logging
from dataclasses import dataclass
from typing import List, Optional
from .extraction_service import PersonDetails, ExtractionResult

logger = logging.getLogger(__name__)


class WitnessRole:
    """Witness role constants."""
    COMPLAINANT = "Complainant"
    EYEWITNESS = "Eyewitness"
    PANCH_WITNESS = "Panch Witness"
    EXPERT_WITNESS = "Expert Witness"
    OFFICIAL_WITNESS = "Official Witness"
    INDEPENDENT_WITNESS = "Independent Witness"
    RECOVERY_WITNESS = "Recovery Witness"
    UNKNOWN = "Witness"


@dataclass
class ClassifiedWitness:
    """Witness with classified role."""
    serial: str
    name: str
    father_name: str
    age: Optional[int]
    caste: str
    occupation: str
    address: str
    phone: str
    role: str
    role_confidence: float
    role_indicators: List[str]


class WitnessService:
    """
    Rule-based witness role classification.
    NO AI/LLM - pure pattern matching and positional logic.
    """
    
    # Keywords indicating eyewitness
    EYEWITNESS_INDICATORS = [
        r'saw\s+(?:the\s+)?(?:incident|occurrence|accused|crime)',
        r'present\s+(?:at\s+)?(?:the\s+)?(?:spot|scene|place)',
        r'witnessed\s+(?:the\s+)?(?:incident|occurrence)',
        r'eye\s*witness',
        r'direct\s+witness',
        r'saw\s+(?:him|her|them)\s+(?:beating|hitting|attacking)',
    ]
    
    # Keywords indicating panch witness
    PANCH_INDICATORS = [
        r'panch\s*witness',
        r'independent\s+witness',
        r'panchnama',
        r'seizure\s+witness',
        r'scene\s+(?:of\s+crime\s+)?witness',
        r'soc\s+witness',
        r'called\s+as\s+(?:a\s+)?witness',
    ]
    
    # Keywords indicating expert witness
    EXPERT_INDICATORS = [
        r'doctor',
        r'medical\s+officer',
        r'forensic',
        r'scientific\s+officer',
        r'handwriting\s+expert',
        r'ballistic',
        r'postmortem',
        r'autopsy',
        r'pathologist',
    ]
    
    # Keywords indicating official witness
    OFFICIAL_INDICATORS = [
        r'investigating\s+officer',
        r'i\.?o\.?',
        r'sub\s*inspector',
        r'head\s*constable',
        r'constable',
        r'inspector',
        r'police\s+(?:officer|personnel)',
        r'sho',
        r'station\s+house\s+officer',
    ]
    
    # Recovery witness indicators
    RECOVERY_INDICATORS = [
        r'recovery',
        r'seizure',
        r'pointing\s+out',
        r'disclosure',
        r'section\s*27',
    ]
    
    def __init__(self):
        """Initialize with compiled patterns."""
        self.eyewitness_patterns = [re.compile(p, re.IGNORECASE) for p in self.EYEWITNESS_INDICATORS]
        self.panch_patterns = [re.compile(p, re.IGNORECASE) for p in self.PANCH_INDICATORS]
        self.expert_patterns = [re.compile(p, re.IGNORECASE) for p in self.EXPERT_INDICATORS]
        self.official_patterns = [re.compile(p, re.IGNORECASE) for p in self.OFFICIAL_INDICATORS]
        self.recovery_patterns = [re.compile(p, re.IGNORECASE) for p in self.RECOVERY_INDICATORS]
    
    def classify_witnesses(self, 
                          witnesses: List[PersonDetails],
                          complainant: Optional[PersonDetails] = None,
                          document_texts: Optional[dict] = None) -> List[ClassifiedWitness]:
        """
        Classify all witnesses into roles.
        
        Args:
            witnesses: List of extracted witness PersonDetails
            complainant: Complainant details (for matching)
            document_texts: Dict of {serial: statement_text} for context
            
        Returns:
            List of ClassifiedWitness objects with roles
        """
        classified = []
        eyewitness_count = 0
        max_eyewitnesses = 2  # First 2 potential eyewitnesses get the role
        
        for i, witness in enumerate(witnesses):
            # Get statement text if available
            statement_text = ""
            if document_texts:
                statement_text = document_texts.get(witness.serial, "")
            
            # Combine occupation and statement for analysis
            analysis_text = f"{witness.occupation} {witness.role} {statement_text}"
            
            # Determine role
            role, confidence, indicators = self._determine_role(
                witness, 
                i, 
                complainant,
                analysis_text,
                eyewitness_count,
                max_eyewitnesses
            )
            
            if role == WitnessRole.EYEWITNESS:
                eyewitness_count += 1
            
            classified_witness = ClassifiedWitness(
                serial=witness.serial or f"LW-{i+1}",
                name=witness.name,
                father_name=witness.father_name,
                age=witness.age,
                caste=witness.caste,
                occupation=witness.occupation,
                address=witness.address,
                phone=witness.phone,
                role=role,
                role_confidence=confidence,
                role_indicators=indicators
            )
            
            classified.append(classified_witness)
            logger.info(f"Classified {witness.serial or f'LW-{i+1}'} {witness.name} as {role} (conf: {confidence:.2f})")
        
        return classified
    
    def _determine_role(self,
                       witness: PersonDetails,
                       position: int,
                       complainant: Optional[PersonDetails],
                       analysis_text: str,
                       eyewitness_count: int,
                       max_eyewitnesses: int) -> tuple:
        """
        Determine witness role based on multiple factors.
        
        Returns:
            (role, confidence, indicators)
        """
        indicators = []
        
        # Rule 1: First witness (LW-1) is usually complainant
        if position == 0 or witness.serial in ['LW-1', 'LW1', '1']:
            # Check if matches complainant
            if complainant and self._names_match(witness.name, complainant.name):
                return (WitnessRole.COMPLAINANT, 0.95, ["First witness", "Matches complainant"])
            else:
                indicators.append("First witness position")
                return (WitnessRole.COMPLAINANT, 0.85, indicators)
        
        # Rule 2: Check for expert indicators (occupation-based)
        expert_match = self._check_patterns(analysis_text, self.expert_patterns)
        if expert_match:
            indicators.extend(expert_match)
            return (WitnessRole.EXPERT_WITNESS, 0.90, indicators)
        
        # Rule 3: Check for official indicators
        official_match = self._check_patterns(analysis_text, self.official_patterns)
        if official_match:
            indicators.extend(official_match)
            return (WitnessRole.OFFICIAL_WITNESS, 0.85, indicators)
        
        # Rule 4: Check for eyewitness indicators
        eyewitness_match = self._check_patterns(analysis_text, self.eyewitness_patterns)
        if eyewitness_match and eyewitness_count < max_eyewitnesses:
            indicators.extend(eyewitness_match)
            return (WitnessRole.EYEWITNESS, 0.80, indicators)
        
        # Rule 5: Check for recovery witness
        recovery_match = self._check_patterns(analysis_text, self.recovery_patterns)
        if recovery_match:
            indicators.extend(recovery_match)
            return (WitnessRole.RECOVERY_WITNESS, 0.75, indicators)
        
        # Rule 6: Next 2 witnesses after complainant are likely eyewitnesses
        if position in [1, 2] and eyewitness_count < max_eyewitnesses:
            indicators.append(f"Position {position+1} (likely eyewitness)")
            return (WitnessRole.EYEWITNESS, 0.65, indicators)
        
        # Rule 7: Check for panch indicators
        panch_match = self._check_patterns(analysis_text, self.panch_patterns)
        if panch_match:
            indicators.extend(panch_match)
            return (WitnessRole.PANCH_WITNESS, 0.80, indicators)
        
        # Default: Panch witness for remaining witnesses
        indicators.append("Default classification (remaining witness)")
        return (WitnessRole.PANCH_WITNESS, 0.50, indicators)
    
    def _check_patterns(self, text: str, patterns: List[re.Pattern]) -> List[str]:
        """Check text against patterns and return matched indicators."""
        matches = []
        for pattern in patterns:
            if pattern.search(text):
                matches.append(pattern.pattern.replace(r'\s+', ' ').replace(r'\s*', ''))
        return matches[:3]  # Return top 3 matches
    
    def _names_match(self, name1: str, name2: str) -> bool:
        """Check if two names match (fuzzy matching)."""
        if not name1 or not name2:
            return False
        
        # Normalize names
        n1 = re.sub(r'[^a-z]', '', name1.lower())
        n2 = re.sub(r'[^a-z]', '', name2.lower())
        
        # Exact match
        if n1 == n2:
            return True
        
        # One contains the other
        if n1 in n2 or n2 in n1:
            return True
        
        # First name match
        parts1 = name1.lower().split()
        parts2 = name2.lower().split()
        if parts1 and parts2 and parts1[0] == parts2[0]:
            return True
        
        return False
    
    def get_witness_summary(self, classified_witnesses: List[ClassifiedWitness]) -> dict:
        """
        Generate summary of witness classification.
        
        Returns:
            Dict with role counts and lists
        """
        summary = {
            'total': len(classified_witnesses),
            'by_role': {},
            'complainant': None,
            'eyewitnesses': [],
            'panch_witnesses': [],
            'expert_witnesses': [],
            'official_witnesses': [],
            'other_witnesses': []
        }
        
        for witness in classified_witnesses:
            role = witness.role
            
            # Count by role
            summary['by_role'][role] = summary['by_role'].get(role, 0) + 1
            
            # Categorize
            witness_dict = {
                'serial': witness.serial,
                'name': witness.name,
                'role': witness.role,
                'confidence': witness.role_confidence
            }
            
            if role == WitnessRole.COMPLAINANT:
                summary['complainant'] = witness_dict
            elif role == WitnessRole.EYEWITNESS:
                summary['eyewitnesses'].append(witness_dict)
            elif role == WitnessRole.PANCH_WITNESS:
                summary['panch_witnesses'].append(witness_dict)
            elif role == WitnessRole.EXPERT_WITNESS:
                summary['expert_witnesses'].append(witness_dict)
            elif role == WitnessRole.OFFICIAL_WITNESS:
                summary['official_witnesses'].append(witness_dict)
            else:
                summary['other_witnesses'].append(witness_dict)
        
        return summary
