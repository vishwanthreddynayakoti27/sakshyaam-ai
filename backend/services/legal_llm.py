"""
Legal LLM Service - GPT-5.2 powered translation and entity extraction.
Preserves police legalese (A1, Panchanama, etc.) and extracts key entities.
"""
import os
import json
import logging
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv()
logger = logging.getLogger(__name__)

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')


LEGAL_TRANSLATION_SYSTEM_PROMPT = """You are a Legal Translation Expert specializing in Indian Police documentation and FIR drafting.

Your task is to translate text from regional languages (Telugu, Hindi, etc.) to formal English while:
1. PRESERVING all police legalese terminology exactly as-is:
   - A1, A2, A3 (Accused identifiers)
   - LW-1, LW-2 (Witness identifiers)
   - Panchanama, Mahazar
   - FIR, CSR, CD (Case Diary)
   - Section numbers (BNS 329, IPC 420, BNSS 35, BSA 63)
   - Legal terms: cognizable, non-bailable, remand, bail

2. Converting first-person narrative to third-person formal legal style:
   - "I went to the station" → "The complainant proceeded to the police station"
   - "My phone was stolen" → "The complainant's mobile phone was stolen"

3. Using formal Police Station Writer terminology:
   - "some person" → "an unidentified individual"
   - "took" → "committed theft of" / "forcibly took possession of"
   - "ran away" → "absconded from the spot"
   - "house" → "residence/dwelling"

4. Maintaining the formal structure:
   - Begin with "The complainant has stated that..."
   - End with "Therefore, appropriate legal action is requested."

Output ONLY the translated text without any explanations."""


ENTITY_EXTRACTION_SYSTEM_PROMPT = """You are a Legal Entity Extraction Expert for Indian Police FIR systems.

Extract the following entities from the given text and return them as a JSON object:

{
  "complainant": {
    "name": "",
    "father_name": "",
    "age": null,
    "caste": "",
    "occupation": "",
    "address": "",
    "phone": ""
  },
  "accused_persons": [
    {
      "serial": "A1",
      "name": "",
      "father_name": "",
      "age": null,
      "caste": "",
      "occupation": "",
      "address": "",
      "phone": "",
      "relationship": ""
    }
  ],
  "offense_details": {
    "type": "",
    "date": "",
    "time": "",
    "place": ""
  },
  "sections_of_law": ["BNS 329(4)", "IPC 420"],
  "property_details": {
    "lost": "",
    "value": "",
    "recovered": ""
  },
  "phone_numbers": ["9876543210"],
  "vehicle_details": [
    {
      "type": "",
      "number": "",
      "make": "",
      "color": ""
    }
  ],
  "bank_details": {
    "name": "",
    "account_number": "",
    "ifsc": "",
    "transaction_id": ""
  },
  "dates_mentioned": [],
  "amounts_mentioned": []
}

Rules:
1. If a field is not found, leave it empty or null
2. Extract ALL phone numbers mentioned
3. Extract ALL vehicle registration numbers (format: TS 09 XX 1234)
4. Extract ALL monetary amounts with context
5. Identify BNS/IPC/BNSS/BSA sections mentioned
6. Identify accused persons even if only partially named

Return ONLY valid JSON, no explanations."""


async def translate_to_legal_english(text: str, source_language: str = "auto") -> Dict[str, Any]:
    """
    Translate petition/complaint text to formal legal English using GPT-5.2.
    Preserves police legalese and converts to third-person narrative.
    """
    if not EMERGENT_LLM_KEY:
        logger.error("EMERGENT_LLM_KEY not configured")
        return {
            "success": False,
            "error": "LLM API key not configured",
            "translated_text": "",
            "legal_text": ""
        }
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"translate-{hash(text[:100])}",
            system_message=LEGAL_TRANSLATION_SYSTEM_PROMPT
        ).with_model("openai", "gpt-5.2")
        
        prompt = f"""Translate the following text to formal legal English. 
Source language: {source_language if source_language != 'auto' else 'Detect automatically'}

Text to translate:
{text}

Provide the formal legal English translation:"""
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        return {
            "success": True,
            "translated_text": response,
            "legal_text": response,
            "source_language": source_language
        }
        
    except Exception as e:
        logger.error(f"Translation error: {e}")
        return {
            "success": False,
            "error": str(e),
            "translated_text": "",
            "legal_text": ""
        }


async def extract_entities(text: str) -> Dict[str, Any]:
    """
    Extract key entities from petition/complaint text using GPT-5.2.
    Returns structured data for Global Case Context.
    """
    if not EMERGENT_LLM_KEY:
        logger.error("EMERGENT_LLM_KEY not configured")
        return {
            "success": False,
            "error": "LLM API key not configured",
            "entities": {}
        }
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"extract-{hash(text[:100])}",
            system_message=ENTITY_EXTRACTION_SYSTEM_PROMPT
        ).with_model("openai", "gpt-5.2")
        
        prompt = f"""Extract all entities from this police complaint/petition text:

{text}

Return the extracted entities as JSON:"""
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse JSON from response
        try:
            # Clean response - remove markdown code blocks if present
            clean_response = response.strip()
            if clean_response.startswith("```json"):
                clean_response = clean_response[7:]
            if clean_response.startswith("```"):
                clean_response = clean_response[3:]
            if clean_response.endswith("```"):
                clean_response = clean_response[:-3]
            
            entities = json.loads(clean_response.strip())
            
            return {
                "success": True,
                "entities": entities
            }
        except json.JSONDecodeError as je:
            logger.warning(f"JSON parse error: {je}, raw response: {response[:500]}")
            return {
                "success": True,
                "entities": {},
                "raw_response": response
            }
        
    except Exception as e:
        logger.error(f"Entity extraction error: {e}")
        return {
            "success": False,
            "error": str(e),
            "entities": {}
        }


async def suggest_bns_sections(facts: str) -> Dict[str, Any]:
    """
    Analyze case facts and suggest applicable BNS/BNSS/BSA sections.
    """
    if not EMERGENT_LLM_KEY:
        return {
            "success": False,
            "error": "LLM API key not configured",
            "sections": []
        }
    
    try:
        system_prompt = """You are a Legal Expert on Indian criminal law, specifically:
- Bharatiya Nyaya Sanhita (BNS) 2023 - replacing IPC
- Bharatiya Nagarik Suraksha Sanhita (BNSS) 2023 - replacing CrPC
- Bharatiya Sakshya Adhiniyam (BSA) 2023 - replacing Evidence Act

Analyze the given case facts and suggest the most applicable sections.

For each suggested section, provide:
1. Section number (e.g., "BNS 318")
2. Title (e.g., "Cheating")
3. Why it applies to this case
4. The old IPC/CrPC equivalent if any
5. Punishment provision

Return as JSON array:
[
  {
    "section": "BNS 318",
    "title": "Cheating",
    "reason": "The accused deceived the complainant...",
    "equivalent": "IPC 420",
    "punishment": "Imprisonment up to 3 years, or fine, or both"
  }
]"""
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"bns-{hash(facts[:100])}",
            system_message=system_prompt
        ).with_model("openai", "gpt-5.2")
        
        prompt = f"""Analyze these case facts and suggest applicable BNS/BNSS/BSA sections:

{facts}

Return the suggested sections as JSON:"""
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse JSON
        try:
            clean_response = response.strip()
            if clean_response.startswith("```json"):
                clean_response = clean_response[7:]
            if clean_response.startswith("```"):
                clean_response = clean_response[3:]
            if clean_response.endswith("```"):
                clean_response = clean_response[:-3]
            
            sections = json.loads(clean_response.strip())
            
            return {
                "success": True,
                "sections": sections
            }
        except json.JSONDecodeError:
            return {
                "success": True,
                "sections": [],
                "raw_response": response
            }
        
    except Exception as e:
        logger.error(f"BNS suggestion error: {e}")
        return {
            "success": False,
            "error": str(e),
            "sections": []
        }


async def process_petition(
    text: str, 
    source_language: str = "auto"
) -> Dict[str, Any]:
    """
    Full petition processing pipeline:
    1. Translate to legal English
    2. Extract entities
    3. Suggest BNS sections
    
    Returns all data needed to populate Global Case Context.
    """
    result = {
        "success": True,
        "original_text": text,
        "source_language": source_language,
        "translated_text": "",
        "legal_text": "",
        "entities": {},
        "suggested_sections": []
    }
    
    # Step 1: Translate
    translation_result = await translate_to_legal_english(text, source_language)
    if translation_result["success"]:
        result["translated_text"] = translation_result.get("translated_text", "")
        result["legal_text"] = translation_result.get("legal_text", "")
    else:
        result["translation_error"] = translation_result.get("error", "Unknown error")
    
    # Step 2: Extract entities (from original or translated text)
    text_for_extraction = result["translated_text"] or text
    extraction_result = await extract_entities(text_for_extraction)
    if extraction_result["success"]:
        result["entities"] = extraction_result.get("entities", {})
    else:
        result["extraction_error"] = extraction_result.get("error", "Unknown error")
    
    # Step 3: Suggest BNS sections
    text_for_analysis = result["legal_text"] or text
    bns_result = await suggest_bns_sections(text_for_analysis)
    if bns_result["success"]:
        result["suggested_sections"] = bns_result.get("sections", [])
    else:
        result["bns_error"] = bns_result.get("error", "Unknown error")
    
    return result
