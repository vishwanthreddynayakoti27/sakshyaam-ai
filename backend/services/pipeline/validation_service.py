"""
Validation Service - Required Field Validation
================================================
Validates unified schema has all required fields before document generation.

Required Fields:
  - FIR number
  - Police station
  - At least 1 accused person with name
  - Complainant name (or witness marked as complainant)

Warnings (not blocking):
  - Missing sections
  - Missing incident details
  - Missing witness details
"""
import logging
from dataclasses import dataclass, field
from typing import List, Dict, Any
from .aggregator_service import UnifiedSchema

logger = logging.getLogger(__name__)


@dataclass
class ValidationIssue:
    """Validation issue details."""
    field: str
    severity: str  # "error" | "warning"
    message: str
    suggestion: str = ""


@dataclass
class ValidationResult:
    """Result of validation."""
    is_valid: bool  # True if no errors (warnings OK)
    issues: List[ValidationIssue] = field(default_factory=list)
    completeness_score: float = 0.0  # 0-100%
    missing_required: List[str] = field(default_factory=list)
    missing_optional: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "completeness_score": self.completeness_score,
            "issues": [
                {
                    "field": i.field,
                    "severity": i.severity,
                    "message": i.message,
                    "suggestion": i.suggestion
                }
                for i in self.issues
            ],
            "missing_required": self.missing_required,
            "missing_optional": self.missing_optional
        }


class ValidationService:
    """
    Validates unified schema for document generation.
    NO AI/LLM - pure rule-based validation.
    """
    
    # Required fields (errors if missing)
    REQUIRED_FIELDS = {
        'fir.number': 'FIR Number is required',
        'fir.police_station': 'Police Station is required',
        'accused': 'At least one accused person is required',
        'complainant.name': 'Complainant name is required',
    }
    
    # Recommended fields (warnings if missing)
    RECOMMENDED_FIELDS = {
        'fir.date': 'FIR date helps with timeline',
        'fir.district': 'District improves document accuracy',
        'fir.sections': 'Sections of law are important for charge sheet',
        'incident.date': 'Incident date helps with narrative',
        'incident.place': 'Place of occurrence is important',
        'witnesses': 'Witnesses strengthen the case',
        'facts.raw': 'Brief facts are needed for document generation',
    }
    
    # Field weights for completeness score
    FIELD_WEIGHTS = {
        'fir.number': 15,
        'fir.date': 5,
        'fir.police_station': 10,
        'fir.district': 5,
        'fir.sections': 10,
        'complainant.name': 15,
        'complainant.father_name': 3,
        'complainant.address': 3,
        'accused': 15,
        'witnesses': 10,
        'incident.date': 3,
        'incident.time': 2,
        'incident.place': 4,
        'facts.raw': 5,
    }
    
    def validate(self, schema: UnifiedSchema) -> ValidationResult:
        """
        Validate unified schema.
        
        Args:
            schema: UnifiedSchema to validate
            
        Returns:
            ValidationResult with issues and completeness score
        """
        issues = []
        missing_required = []
        missing_optional = []
        
        # Check required fields
        for field_path, message in self.REQUIRED_FIELDS.items():
            if not self._check_field(schema, field_path):
                issues.append(ValidationIssue(
                    field=field_path,
                    severity="error",
                    message=message,
                    suggestion=self._get_suggestion(field_path)
                ))
                missing_required.append(field_path)
        
        # Check recommended fields
        for field_path, message in self.RECOMMENDED_FIELDS.items():
            if not self._check_field(schema, field_path):
                issues.append(ValidationIssue(
                    field=field_path,
                    severity="warning",
                    message=message,
                    suggestion=self._get_suggestion(field_path)
                ))
                missing_optional.append(field_path)
        
        # Additional validations
        issues.extend(self._validate_accused(schema))
        issues.extend(self._validate_witnesses(schema))
        issues.extend(self._validate_sections(schema))
        
        # Calculate completeness score
        completeness = self._calculate_completeness(schema)
        
        # Valid if no errors
        has_errors = any(i.severity == "error" for i in issues)
        
        result = ValidationResult(
            is_valid=not has_errors,
            issues=issues,
            completeness_score=completeness,
            missing_required=missing_required,
            missing_optional=missing_optional
        )
        
        logger.info(f"Validation: valid={result.is_valid}, "
                   f"completeness={completeness:.1f}%, "
                   f"errors={len(missing_required)}, "
                   f"warnings={len(missing_optional)}")
        
        return result
    
    def _check_field(self, schema: UnifiedSchema, field_path: str) -> bool:
        """Check if a field has a value."""
        parts = field_path.split('.')
        obj = schema
        
        for part in parts:
            if hasattr(obj, part):
                obj = getattr(obj, part)
            elif isinstance(obj, dict):
                obj = obj.get(part)
            else:
                return False
            
            if obj is None:
                return False
        
        # Check for empty values
        if isinstance(obj, str):
            return bool(obj.strip())
        elif isinstance(obj, list):
            return len(obj) > 0
        elif isinstance(obj, dict):
            return bool(obj)
        
        return bool(obj)
    
    def _validate_accused(self, schema: UnifiedSchema) -> List[ValidationIssue]:
        """Validate accused persons details."""
        issues = []
        
        for i, accused in enumerate(schema.accused):
            if not accused.name:
                issues.append(ValidationIssue(
                    field=f"accused[{i}].name",
                    severity="error",
                    message=f"Accused {accused.serial or i+1} missing name",
                    suggestion="Extract name from FIR or Case Diary"
                ))
            
            if not accused.father_name:
                issues.append(ValidationIssue(
                    field=f"accused[{i}].father_name",
                    severity="warning",
                    message=f"Accused {accused.serial or i+1} missing father's name",
                    suggestion="Check S/o or D/o in documents"
                ))
            
            if not accused.address:
                issues.append(ValidationIssue(
                    field=f"accused[{i}].address",
                    severity="warning",
                    message=f"Accused {accused.serial or i+1} missing address",
                    suggestion="Check R/o in documents"
                ))
        
        return issues
    
    def _validate_witnesses(self, schema: UnifiedSchema) -> List[ValidationIssue]:
        """Validate witness details."""
        issues = []
        
        if len(schema.witnesses) == 0:
            issues.append(ValidationIssue(
                field="witnesses",
                severity="warning",
                message="No witnesses found",
                suggestion="Upload witness statements (161 CrPC)"
            ))
            return issues
        
        # Check for complainant witness
        has_complainant = any(
            'complainant' in (w.role or '').lower() 
            for w in schema.witnesses
        )
        
        if not has_complainant:
            issues.append(ValidationIssue(
                field="witnesses",
                severity="warning",
                message="No witness marked as complainant",
                suggestion="First witness (LW-1) should be complainant"
            ))
        
        return issues
    
    def _validate_sections(self, schema: UnifiedSchema) -> List[ValidationIssue]:
        """Validate sections of law."""
        issues = []
        
        if not schema.fir.sections:
            issues.append(ValidationIssue(
                field="fir.sections",
                severity="warning",
                message="No sections of law specified",
                suggestion="Extract from FIR or provide manually"
            ))
        
        return issues
    
    def _calculate_completeness(self, schema: UnifiedSchema) -> float:
        """Calculate completeness score (0-100%)."""
        total_weight = sum(self.FIELD_WEIGHTS.values())
        achieved_weight = 0
        
        for field_path, weight in self.FIELD_WEIGHTS.items():
            if self._check_field(schema, field_path):
                achieved_weight += weight
        
        # Bonus for accused details completeness
        if schema.accused:
            accused_complete = 0
            for accused in schema.accused:
                if accused.name: accused_complete += 1
                if accused.father_name: accused_complete += 0.5
                if accused.address: accused_complete += 0.5
            
            max_accused_bonus = 5
            accused_bonus = min(accused_complete / len(schema.accused) * max_accused_bonus, max_accused_bonus)
            achieved_weight += accused_bonus
            total_weight += max_accused_bonus
        
        # Bonus for witness details completeness
        if schema.witnesses:
            witness_complete = 0
            for witness in schema.witnesses:
                if witness.name: witness_complete += 1
                if witness.role: witness_complete += 0.5
            
            max_witness_bonus = 5
            witness_bonus = min(witness_complete / len(schema.witnesses) * max_witness_bonus, max_witness_bonus)
            achieved_weight += witness_bonus
            total_weight += max_witness_bonus
        
        return (achieved_weight / total_weight) * 100 if total_weight > 0 else 0
    
    def _get_suggestion(self, field_path: str) -> str:
        """Get suggestion for missing field."""
        suggestions = {
            'fir.number': 'Extract from FIR document or provide manually',
            'fir.police_station': 'Check FIR header or Case Diary',
            'fir.district': 'Usually found in FIR header',
            'fir.sections': 'Extract U/s from FIR or Case Diary',
            'fir.date': 'Look for FIR registration date',
            'complainant.name': 'Extract from FIR complainant section',
            'accused': 'Upload FIR or Case Diary with accused details',
            'witnesses': 'Upload 161 CrPC witness statements',
            'incident.date': 'Extract from FIR occurrence details',
            'incident.place': 'Extract from FIR place of occurrence',
            'facts.raw': 'Upload documents containing case narrative',
        }
        return suggestions.get(field_path, 'Check uploaded documents')
    
    def get_field_status(self, schema: UnifiedSchema) -> Dict[str, bool]:
        """
        Get status of all tracked fields.
        
        Returns:
            Dict mapping field_path to boolean (present/missing)
        """
        status = {}
        
        all_fields = list(self.REQUIRED_FIELDS.keys()) + list(self.RECOMMENDED_FIELDS.keys())
        
        for field_path in all_fields:
            status[field_path] = self._check_field(schema, field_path)
        
        return status
