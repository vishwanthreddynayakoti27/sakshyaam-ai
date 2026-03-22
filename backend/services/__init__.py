"""
Services package for the Unified Intelligence Pipeline.
"""
from services.legal_llm import (
    translate_to_legal_english,
    extract_entities,
    suggest_bns_sections,
    process_petition
)
from services.document_generator import (
    generate_charge_sheet,
    generate_case_diary,
    generate_remand_report,
    generate_bsa_63_certificate
)

__all__ = [
    "translate_to_legal_english",
    "extract_entities",
    "suggest_bns_sections",
    "process_petition",
    "generate_charge_sheet",
    "generate_case_diary",
    "generate_remand_report",
    "generate_bsa_63_certificate"
]
