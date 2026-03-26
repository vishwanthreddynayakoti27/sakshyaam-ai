"""
Bilingual CDF (Crime Details Form) Overlay Module
Digital twin of CDF with Telugu/English toggle and coordinate overlay printing
"""
from datetime import datetime
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)

# CDF Field Definitions with bilingual labels
CDF_FIELDS = {
    "fir_number": {"telugu": "ఎఫ్.ఐ.ఆర్. నంబర్", "english": "F.I.R. Number"},
    "police_station": {"telugu": "పోలీస్ స్టేషన్", "english": "Police Station"},
    "district": {"telugu": "జిల్లా", "english": "District"},
    "date_of_occurrence": {"telugu": "సంఘటన తేదీ", "english": "Date of Occurrence"},
    "time_of_occurrence": {"telugu": "సంఘటన సమయం", "english": "Time of Occurrence"},
    "place_of_occurrence": {"telugu": "సంఘటన స్థలం", "english": "Place of Occurrence"},
    "sections_of_law": {"telugu": "చట్ట సెక్షన్లు", "english": "Sections of Law"},
    "complainant_name": {"telugu": "ఫిర్యాదీ పేరు", "english": "Complainant Name"},
    "complainant_father": {"telugu": "తండ్రి/భర్త పేరు", "english": "Father/Husband Name"},
    "complainant_age": {"telugu": "వయస్సు", "english": "Age"},
    "complainant_caste": {"telugu": "కులం", "english": "Caste"},
    "complainant_occupation": {"telugu": "వృత్తి", "english": "Occupation"},
    "complainant_address": {"telugu": "చిరునామా", "english": "Address"},
    "complainant_phone": {"telugu": "ఫోన్ నంబర్", "english": "Phone Number"},
    "accused_details": {"telugu": "నిందితుల వివరాలు", "english": "Accused Details"},
    "witness_details": {"telugu": "సాక్షుల వివరాలు", "english": "Witness Details"},
    "modus_operandi": {"telugu": "నేర పద్ధతి", "english": "Modus Operandi"},
    "property_lost": {"telugu": "పోయిన ఆస్తి", "english": "Property Lost"},
    "property_recovered": {"telugu": "రికవర్ చేసిన ఆస్తి", "english": "Property Recovered"},
    "brief_facts": {"telugu": "సంక్షిప్త వాస్తవాలు", "english": "Brief Facts"},
    "rough_sketch": {"telugu": "రఫ్ స్కెచ్", "english": "Rough Sketch"},
    "io_signature": {"telugu": "I.O. సంతకం", "english": "I.O. Signature"},
}


def generate_cdf_digital_form_html(data: Dict, case_info: Dict, language: str = "english") -> str:
    """
    Generate Digital CDF Form as HTML with editable fields
    Supports bilingual toggle (Telugu/English)
    """
    is_telugu = language.lower() == "telugu"
    
    def get_label(field_key: str) -> str:
        return CDF_FIELDS.get(field_key, {}).get("telugu" if is_telugu else "english", field_key)
    
    # Extract data
    comp = data.get("complainant", {})
    offense = data.get("offense_details", {})
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;700&display=swap');
            
            body {{ 
                font-family: {'"Noto Sans Telugu", ' if is_telugu else ''}'Times New Roman', serif; 
                font-size: 12px; 
                margin: 20px;
                background: #fff;
            }}
            .cdf-header {{ 
                text-align: center; 
                font-size: 18px; 
                font-weight: bold; 
                margin-bottom: 20px;
                border-bottom: 2px solid #000;
                padding-bottom: 10px;
            }}
            .cdf-subtitle {{
                text-align: center;
                font-size: 14px;
                margin-bottom: 15px;
            }}
            table {{ width: 100%; border-collapse: collapse; margin: 10px 0; }}
            th, td {{ 
                border: 1px solid #000; 
                padding: 8px; 
                text-align: left; 
                vertical-align: top; 
            }}
            th {{ 
                background-color: #f0f0f0; 
                font-weight: bold; 
                width: 30%;
            }}
            .field-input {{
                width: 100%;
                min-height: 25px;
                border: none;
                border-bottom: 1px dotted #666;
                background: transparent;
                font-family: inherit;
                font-size: inherit;
                padding: 2px 5px;
            }}
            .field-input:focus {{
                outline: none;
                border-bottom: 2px solid #00C2FF;
                background: #fffef0;
            }}
            textarea.field-input {{
                min-height: 80px;
                border: 1px dotted #666;
                resize: vertical;
            }}
            .section-title {{
                background: #e0e0e0;
                font-weight: bold;
                text-align: center;
                padding: 10px;
            }}
            .accused-row, .witness-row {{
                margin: 5px 0;
                padding: 5px;
                border-bottom: 1px dashed #ccc;
            }}
            .language-toggle {{
                position: fixed;
                top: 10px;
                right: 10px;
                padding: 10px 20px;
                background: #00C2FF;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-weight: bold;
                z-index: 1000;
            }}
            .print-btn {{
                position: fixed;
                top: 10px;
                right: 150px;
                padding: 10px 20px;
                background: #00FFB3;
                color: black;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-weight: bold;
            }}
            @media print {{
                .language-toggle, .print-btn {{ display: none; }}
                body {{ margin: 0; padding: 10px; }}
            }}
        </style>
    </head>
    <body>
        <button class="language-toggle" onclick="toggleLanguage()">
            {get_label('fir_number').split()[0]} ⇄ {'English' if is_telugu else 'Telugu'}
        </button>
        <button class="print-btn" onclick="window.print()">Print CDF</button>
        
        <div class="cdf-header">
            {'క్రైమ్ డీటెయిల్స్ ఫారం (CDF)' if is_telugu else 'CRIME DETAILS FORM (CDF)'}
        </div>
        <div class="cdf-subtitle">
            {'తెలంగాణ పోలీస్ - ఫారం నం. ___' if is_telugu else 'Telangana Police - Form No. ___'}
        </div>
        
        <table>
            <tr>
                <th>{get_label('police_station')}</th>
                <td><input type="text" class="field-input" data-field="police_station" value="{case_info.get('police_station', '')}" /></td>
                <th>{get_label('district')}</th>
                <td><input type="text" class="field-input" data-field="district" value="{case_info.get('district', '')}" /></td>
            </tr>
            <tr>
                <th>{get_label('fir_number')}</th>
                <td><input type="text" class="field-input" data-field="fir_number" value="{case_info.get('fir_number', '')}" /></td>
                <th>{get_label('sections_of_law')}</th>
                <td><input type="text" class="field-input" data-field="sections" value="{case_info.get('sections', '')}" /></td>
            </tr>
        </table>

        <table>
            <tr class="section-title">
                <td colspan="4">{'సంఘటన వివరాలు' if is_telugu else 'OCCURRENCE DETAILS'}</td>
            </tr>
            <tr>
                <th>{get_label('date_of_occurrence')}</th>
                <td><input type="text" class="field-input" data-field="occurrence_date" value="{offense.get('date', '')}" /></td>
                <th>{get_label('time_of_occurrence')}</th>
                <td><input type="text" class="field-input" data-field="occurrence_time" value="{offense.get('time', '')}" /></td>
            </tr>
            <tr>
                <th>{get_label('place_of_occurrence')}</th>
                <td colspan="3"><input type="text" class="field-input" data-field="occurrence_place" value="{offense.get('place', '')}" /></td>
            </tr>
        </table>

        <table>
            <tr class="section-title">
                <td colspan="4">{'ఫిర్యాదీ వివరాలు' if is_telugu else 'COMPLAINANT DETAILS'}</td>
            </tr>
            <tr>
                <th>{get_label('complainant_name')}</th>
                <td><input type="text" class="field-input" data-field="comp_name" value="{comp.get('name', '')}" /></td>
                <th>{get_label('complainant_father')}</th>
                <td><input type="text" class="field-input" data-field="comp_father" value="{comp.get('father_name', '')}" /></td>
            </tr>
            <tr>
                <th>{get_label('complainant_age')}</th>
                <td><input type="text" class="field-input" data-field="comp_age" value="{comp.get('age', '')}" /></td>
                <th>{get_label('complainant_caste')}</th>
                <td><input type="text" class="field-input" data-field="comp_caste" value="{comp.get('caste', '')}" /></td>
            </tr>
            <tr>
                <th>{get_label('complainant_occupation')}</th>
                <td><input type="text" class="field-input" data-field="comp_occupation" value="{comp.get('occupation', '')}" /></td>
                <th>{get_label('complainant_phone')}</th>
                <td><input type="text" class="field-input" data-field="comp_phone" value="{comp.get('phone', '')}" /></td>
            </tr>
            <tr>
                <th>{get_label('complainant_address')}</th>
                <td colspan="3"><input type="text" class="field-input" data-field="comp_address" value="{comp.get('address', '')}" /></td>
            </tr>
        </table>

        <table>
            <tr class="section-title">
                <td colspan="2">{'నిందితుల వివరాలు' if is_telugu else 'ACCUSED DETAILS'} (Column 11 → Charge Sheet)</td>
            </tr>
            <tr>
                <td colspan="2">
                    {generate_accused_fields_html(data.get('accused_persons', []), is_telugu)}
                </td>
            </tr>
        </table>

        <table>
            <tr class="section-title">
                <td colspan="2">{'సాక్షుల వివరాలు' if is_telugu else 'WITNESS DETAILS'} (Column 13 → Charge Sheet)</td>
            </tr>
            <tr>
                <td colspan="2">
                    {generate_witness_fields_html(data.get('witnesses', []), is_telugu)}
                </td>
            </tr>
        </table>

        <table>
            <tr class="section-title">
                <td colspan="2">{'నేర పద్ధతి' if is_telugu else 'MODUS OPERANDI'} (Column 16 → Charge Sheet)</td>
            </tr>
            <tr>
                <td colspan="2">
                    <textarea class="field-input" data-field="modus_operandi" data-sync="cs_col_16">{data.get('modus_operandi', '')}</textarea>
                </td>
            </tr>
        </table>

        <table>
            <tr class="section-title">
                <td colspan="2">{'సంక్షిప్త వాస్తవాలు' if is_telugu else 'BRIEF FACTS OF THE CASE'}</td>
            </tr>
            <tr>
                <td colspan="2">
                    <textarea class="field-input" data-field="brief_facts" style="min-height: 150px;">{data.get('brief_facts', '')}</textarea>
                </td>
            </tr>
        </table>

        <table>
            <tr>
                <th style="width: 50%;">{get_label('property_lost')}</th>
                <th>{get_label('property_recovered')}</th>
            </tr>
            <tr>
                <td><textarea class="field-input" data-field="property_lost">{data.get('property_lost', '')}</textarea></td>
                <td><textarea class="field-input" data-field="property_recovered">{data.get('property_recovered', '')}</textarea></td>
            </tr>
        </table>

        <table>
            <tr class="section-title">
                <td colspan="2">{'రఫ్ స్కెచ్ / సంఘటన స్థలం' if is_telugu else 'ROUGH SKETCH / SCENE OF CRIME'}</td>
            </tr>
            <tr>
                <td colspan="2" style="height: 200px; text-align: center; vertical-align: middle;">
                    <div id="rough-sketch-area" style="border: 2px dashed #ccc; height: 180px; display: flex; align-items: center; justify-content: center;">
                        <span style="color: #999;">{'స్కెచ్ అప్‌లోడ్ చేయండి' if is_telugu else 'Upload or Draw Rough Sketch'}</span>
                    </div>
                </td>
            </tr>
        </table>

        <table style="margin-top: 30px;">
            <tr>
                <td style="width: 50%; text-align: left;">
                    <strong>{'తేదీ' if is_telugu else 'Date'}:</strong> {datetime.now().strftime('%d-%m-%Y')}
                </td>
                <td style="text-align: right;">
                    <strong>{get_label('io_signature')}</strong><br/><br/>
                    ({case_info.get('io_name', '_______________')})<br/>
                    {case_info.get('io_rank', 'Sub Inspector of Police')}<br/>
                    PS {case_info.get('police_station', '_______________')}
                </td>
            </tr>
        </table>

        <script>
            function toggleLanguage() {{
                const currentLang = '{language}';
                const newLang = currentLang === 'english' ? 'telugu' : 'english';
                // In actual implementation, this would reload with new language
                window.location.href = window.location.pathname + '?lang=' + newLang;
            }}
            
            // Auto-sync CDF fields to Charge Sheet columns
            document.querySelectorAll('[data-sync]').forEach(field => {{
                field.addEventListener('change', function() {{
                    const syncTarget = this.dataset.sync;
                    // Emit event for CCTNS sync
                    window.dispatchEvent(new CustomEvent('cdf-field-change', {{
                        detail: {{ field: syncTarget, value: this.value }}
                    }}));
                }});
            }});
        </script>
    </body>
    </html>
    """
    return html


def generate_accused_fields_html(accused_persons: List[Dict], is_telugu: bool = False) -> str:
    """Generate accused input fields with auto-numbering"""
    if not accused_persons:
        # Generate 5 empty slots
        accused_persons = [{}] * 5
    
    html_parts = []
    for i in range(max(len(accused_persons), 5)):
        acc = accused_persons[i] if i < len(accused_persons) else {}
        serial = f"A{i+1}"
        
        html_parts.append(f'''
        <div class="accused-row">
            <strong>{serial}.</strong>
            <input type="text" class="field-input" placeholder="{'పేరు' if is_telugu else 'Name'}" 
                   data-field="accused_{i}_name" value="{acc.get('name', '')}" style="width: 150px;" />
            S/o <input type="text" class="field-input" data-field="accused_{i}_father" 
                       value="{acc.get('father_name', '')}" style="width: 100px;" />
            Age: <input type="text" class="field-input" data-field="accused_{i}_age" 
                        value="{acc.get('age', '')}" style="width: 40px;" />
            Caste: <input type="text" class="field-input" data-field="accused_{i}_caste" 
                          value="{acc.get('caste', '')}" style="width: 60px;" />
            R/o: <input type="text" class="field-input" data-field="accused_{i}_address" 
                        value="{acc.get('address', '')}" style="width: 200px;" />
            Ph: <input type="text" class="field-input" data-field="accused_{i}_phone" 
                       value="{acc.get('phone', '')}" style="width: 100px;" />
        </div>
        ''')
    
    return "\n".join(html_parts)


def generate_witness_fields_html(witnesses: List[Dict], is_telugu: bool = False) -> str:
    """Generate witness input fields with auto-numbering"""
    if not witnesses:
        # Generate 5 empty slots
        witnesses = [{}] * 5
    
    html_parts = []
    for i in range(max(len(witnesses), 5)):
        wit = witnesses[i] if i < len(witnesses) else {}
        serial = f"LW-{i+1}"
        
        html_parts.append(f'''
        <div class="witness-row">
            <strong>{serial}.</strong>
            <input type="text" class="field-input" placeholder="{'పేరు' if is_telugu else 'Name'}" 
                   data-field="witness_{i}_name" value="{wit.get('name', '')}" style="width: 150px;" />
            S/o <input type="text" class="field-input" data-field="witness_{i}_father" 
                       value="{wit.get('father_name', '')}" style="width: 100px;" />
            Age: <input type="text" class="field-input" data-field="witness_{i}_age" 
                        value="{wit.get('age', '')}" style="width: 40px;" />
            R/o: <input type="text" class="field-input" data-field="witness_{i}_address" 
                        value="{wit.get('address', '')}" style="width: 200px;" />
            Role: <input type="text" class="field-input" data-field="witness_{i}_role" 
                         value="{wit.get('role', '')}" style="width: 120px;" 
                         placeholder="{'పాత్ర' if is_telugu else 'e.g., Eyewitness'}" />
        </div>
        ''')
    
    return "\n".join(html_parts)


def extract_cdf_data_for_chargesheet(cdf_data: Dict) -> Dict:
    """
    Extract CDF data and map to Charge Sheet columns
    Column 13: Witnesses, Column 16: Modus Operandi
    """
    return {
        "witnesses": cdf_data.get("witnesses", []),  # → CS Column 13
        "modus_operandi": cdf_data.get("modus_operandi", ""),  # → CS Column 16
        "brief_facts": cdf_data.get("brief_facts", ""),
        "accused_persons": cdf_data.get("accused_persons", []),
        "property_lost": cdf_data.get("property_lost", ""),
        "offense_details": cdf_data.get("offense_details", {})
    }
