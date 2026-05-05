"""
Narration Generator — "Wing 1" tool for officers to compose case narratives
by selecting from a curated, searchable vocabulary of standard policing
phrases (BNS / BNSS / station-style language).

The keyword set is organised into themed categories (offence types, scene
description, witness handling, accused handling, recovery, medical, etc.).
Officers pick keywords; the service stitches them into a properly-flowing
3rd-person paragraph that matches station style.

NO LLM is invoked here — this is a deterministic stitcher. The user
explicitly asked for "search/select from ~1000 keywords" + the rendered
narration must be predictable.
"""
from __future__ import annotations

from typing import Dict, List, Tuple


# ────────────────────────────────────────────────────────────────
# Curated keyword bank — organised by category
# ────────────────────────────────────────────────────────────────
# Each entry: (keyword, expanded_phrase). The keyword is a short label
# the officer searches/selects; the phrase is what gets stitched into
# the narration. Phrases are deliberately written in 3rd-person past
# tense, station style.
# ────────────────────────────────────────────────────────────────

KEYWORD_BANK: Dict[str, List[Tuple[str, str]]] = {
    "Offence Registration": [
        ("FIR registered", "An FIR was registered on the basis of the complaint received from the complainant."),
        ("Cognizable offence", "On verification, the offence was found to be cognizable in nature."),
        ("Sec 173 BNSS", "The case was registered u/s 173 BNSS and taken up for investigation."),
        ("Case taken up", "I have taken up the case for investigation."),
        ("Crime registered", "A crime was registered at this Police Station and taken up for investigation."),
        ("Section 35(3) BNSS", "Notice u/s 35(3) BNSS was served on the accused."),
        ("Section 180 BNSS", "Statement was recorded u/s 180 BNSS."),
        ("Section 161 CrPC", "Statement was recorded u/s 161 CrPC."),
        ("FIR copy enclosed", "A copy of the FIR is enclosed herewith."),
        ("Crime number assigned", "The crime was assigned the relevant Crime Number."),
    ],
    "Scene of Offence": [
        ("Scene visit", "I proceeded to the scene of offence and observed the surroundings."),
        ("Scene secured", "The scene of offence was secured for investigation."),
        ("Panchanama conducted", "Scene of Offence Panchanama was conducted in the presence of mediators."),
        ("Rough sketch prepared", "A rough sketch of the scene of offence was prepared."),
        ("Photographs taken", "Photographs of the scene were taken and preserved."),
        ("Mediators secured", "Two mediators were secured to witness the proceedings."),
        ("Surroundings observed", "The surrounding area was observed and noted."),
        ("Position of injured", "The position where the injured was found was identified and noted."),
        ("Blood stains found", "Blood stains were noticed at the scene and seized for FSL examination."),
        ("Material objects found", "Material objects were found at the scene of offence."),
        ("MO seized", "The material objects were seized under panchanama."),
        ("Scene measurements taken", "Measurements of the scene of offence were taken."),
    ],
    "Witness Examination": [
        ("LW-1 examined", "LW-1 was examined and his/her statement was recorded u/s 180 BNSS."),
        ("LW-2 examined", "LW-2 was examined and his/her statement was recorded u/s 180 BNSS."),
        ("Eye-witness examined", "An eye-witness to the occurrence was examined."),
        ("Hearsay witness", "A hearsay witness was examined and his/her statement recorded."),
        ("Panch witness examined", "The panch witnesses were examined under proper procedure."),
        ("Statement consistent", "The statement of the witness is consistent with the complaint."),
        ("Statement corroborates", "The witness's statement corroborates the complainant's version."),
        ("Witness identified accused", "The witness identified the accused person at the scene."),
        ("Witness present", "The witness was present at the scene at the time of occurrence."),
        ("Witness signed statement", "The witness signed the statement after it was read over to him/her."),
    ],
    "Medical Examination": [
        ("Sent for MLC", "The injured was immediately sent to the hospital for medical examination."),
        ("Wound certificate received", "The wound certificate was obtained from the Medical Officer."),
        ("Civil Asst Surgeon", "The injured was examined by the Civil Assistant Surgeon."),
        ("Govt Hospital", "The injured was treated at the Government Hospital."),
        ("MLC report enclosed", "The MLC report is enclosed herewith."),
        ("Simple injuries", "The injuries were found to be simple in nature."),
        ("Grievous injuries", "The injuries were found to be grievous in nature."),
        ("Inquest conducted", "Inquest panchanama was conducted on the dead body."),
        ("Postmortem requested", "The dead body was sent for postmortem examination."),
        ("Postmortem report received", "The postmortem report was received and examined."),
    ],
    "Accused Handling": [
        ("Accused identified", "The accused person was identified during investigation."),
        ("Accused appeared", "The accused appeared before me at the Police Station."),
        ("Accused arrested", "The accused was arrested as per procedure."),
        ("Notice u/s 35(3) BNSS", "Notice u/s 35(3) BNSS was served on the accused."),
        ("Bound over u/s 41A", "The accused was bound over u/s 41A CrPC."),
        ("Accused interrogated", "The accused was interrogated and his/her statement noted."),
        ("Confession recorded", "The accused admitted his/her involvement in the offence."),
        ("Accused absconding", "The accused is absconding and efforts are being made to apprehend."),
        ("Accused surrendered", "The accused surrendered before this Police Station."),
        ("ID proof collected", "Aadhaar/ID proof of the accused was collected."),
        ("Accused released", "The accused was released after due procedure."),
        ("Forwarded to Court", "The accused was forwarded to the Hon'ble Court for remand."),
    ],
    "Property / Recovery": [
        ("Property seized", "The case property was seized under panchanama."),
        ("Weapon recovered", "The weapon used in the offence was recovered."),
        ("Articles recovered", "Stolen articles were recovered at the instance of the accused."),
        ("Property identified", "The recovered property was identified by the complainant."),
        ("Vehicle seized", "The vehicle used in the offence was seized."),
        ("Mobile phone seized", "The mobile phone of the accused was seized for examination."),
        ("Cash recovered", "Cash amount was recovered from the accused."),
        ("Property kept in malkhana", "The seized property was kept in the Police Station malkhana."),
        ("Property entry made", "Property entry was made in the malkhana register."),
        ("FSL examination", "The seized articles were sent to FSL for examination."),
    ],
    "Investigation Steps": [
        ("Investigation in progress", "The investigation is in progress."),
        ("Further investigation", "Further investigation is being conducted."),
        ("CDR analysis", "Call Detail Record analysis was conducted to track the accused."),
        ("CCTV footage collected", "CCTV footage from the scene was collected and examined."),
        ("Tower dump analysed", "Tower dump data was analysed to identify the accused."),
        ("Bank records obtained", "Bank account statements of the accused were obtained."),
        ("FSL report awaited", "The FSL report is awaited."),
        ("Witnesses traced", "Additional witnesses were traced and their statements recorded."),
        ("Suspects shortlisted", "On the basis of investigation, suspects were shortlisted."),
        ("Modus operandi noted", "The modus operandi adopted by the accused was noted."),
        ("Charge sheet to be filed", "The charge sheet will be filed on completion of investigation."),
        ("Charge sheet filed", "The charge sheet has been filed before the Hon'ble Court."),
    ],
    "Brief Facts Phrases": [
        ("Date of occurrence", "The date of occurrence is as mentioned in the complaint."),
        ("Time of occurrence", "The time of occurrence is approximately as stated by the complainant."),
        ("Place of occurrence", "The place of occurrence is identified and verified."),
        ("Cause of dispute", "The cause of dispute is found to be the same as stated."),
        ("Pre-existing enmity", "There existed a pre-existing enmity between the parties."),
        ("Sudden quarrel", "The occurrence took place in a sudden quarrel between the parties."),
        ("Premeditated act", "The act of the accused appears to be premeditated."),
        ("Common intention", "The accused acted in furtherance of common intention."),
        ("Unlawful assembly", "The accused formed an unlawful assembly."),
        ("Caused hurt", "The accused caused hurt to the complainant."),
        ("Caused grievous hurt", "The accused caused grievous hurt to the complainant."),
        ("Threatened complainant", "The accused threatened the complainant with dire consequences."),
        ("Used abusive language", "The accused used abusive and obscene language towards the complainant."),
        ("Caused damage to property", "The accused caused damage to the complainant's property."),
        ("Outraged modesty", "The accused outraged the modesty of the complainant."),
    ],
    "Section-Specific Phrases (BNS)": [
        ("Sec 115(2) BNS", "The act of the accused attracts Section 115(2) BNS — voluntarily causing hurt."),
        ("Sec 117 BNS", "The act attracts Section 117 BNS — grievous hurt."),
        ("Sec 118(2) BNS", "The act attracts Section 118(2) BNS — voluntarily causing hurt by dangerous weapon."),
        ("Sec 137 BNS", "The act attracts Section 137 BNS — kidnapping or abducting."),
        ("Sec 191 BNS", "The act attracts Section 191 BNS — rioting."),
        ("Sec 196 BNS", "The act attracts Section 196 BNS — promoting enmity."),
        ("Sec 270 BNS", "The act attracts Section 270 BNS — public nuisance."),
        ("Sec 303 BNS", "The act attracts Section 303 BNS — theft."),
        ("Sec 308 BNS", "The act attracts Section 308 BNS — extortion."),
        ("Sec 318 BNS", "The act attracts Section 318 BNS — cheating."),
        ("Sec 319 BNS", "The act attracts Section 319 BNS — cheating by personation."),
        ("Sec 351 BNS", "The act attracts Section 351 BNS — criminal intimidation."),
        ("Sec 352 BNS", "The act attracts Section 352 BNS — intentional insult to provoke breach of peace."),
        ("Sec 3(5) BNS", "The accused acted in furtherance of common intention u/s 3(5) BNS."),
    ],
    "Closing Phrases": [
        ("Hence FIR", "Hence, an FIR was registered."),
        ("Hence charge sheet", "Hence, charge sheet."),
        ("Hence remand", "Hence, the remand report."),
        ("CD closed for the day", "Closed the CD for the day; further progress follows."),
        ("Submitted for orders", "Submitted for the orders of the Hon'ble Court."),
        ("Copy submitted", "Copy submitted to the SDPO through CI of Police for favour of information."),
    ],
}


def get_categories() -> List[str]:
    return list(KEYWORD_BANK.keys())


def get_keywords(category: str = None, query: str = None) -> List[Dict[str, str]]:
    """
    Return list of {category, keyword, phrase} dicts.
    If `category` is given, restrict to that category.
    If `query` is given (case-insensitive), match keyword OR phrase.
    """
    results = []
    cats = [category] if category else list(KEYWORD_BANK.keys())
    q = (query or "").lower().strip()
    for cat in cats:
        for kw, phrase in KEYWORD_BANK.get(cat, []):
            if q and q not in kw.lower() and q not in phrase.lower():
                continue
            results.append({"category": cat, "keyword": kw, "phrase": phrase})
    return results


def total_keywords() -> int:
    return sum(len(v) for v in KEYWORD_BANK.values())


# ────────────────────────────────────────────────────────────────
# Narration composer
# ────────────────────────────────────────────────────────────────
def compose_narration(
    selected_phrases: List[str],
    *,
    fir_number: str = "",
    police_station: str = "",
    io_name: str = "",
    complainant_name: str = "",
    accused_names: List[str] = None,
    occurrence_dtp: str = "",
    sections: str = "",
    custom_intro: str = "",
) -> str:
    """
    Stitch the officer-selected phrases into a flowing narrative paragraph.
    Adds a station-style intro and outro using the case meta provided.
    """
    accused_names = accused_names or []
    intro_bits = []
    if custom_intro:
        intro_bits.append(custom_intro.strip())
    if police_station:
        intro_bits.append(f"At the {police_station} Police Station,")
    if fir_number:
        intro_bits.append(f"in connection with FIR No. {fir_number},")
    if occurrence_dtp:
        intro_bits.append(f"the occurrence took place on/at {occurrence_dtp}.")
    if complainant_name:
        intro_bits.append(f"On receipt of the complaint from {complainant_name},")
    if io_name:
        intro_bits.append(f"the undersigned ({io_name}) took up the case for investigation.")
    intro = " ".join(intro_bits).strip()

    body = " ".join(p.strip() for p in selected_phrases if p and p.strip())

    outro_bits = []
    if accused_names:
        if len(accused_names) == 1:
            outro_bits.append(f"The accused {accused_names[0]} has been identified in connection with the offence.")
        else:
            joined = ", ".join(accused_names[:-1]) + f" and {accused_names[-1]}"
            outro_bits.append(f"The accused persons {joined} have been identified in connection with the offence.")
    if sections:
        outro_bits.append(f"The act of the accused attracts the provisions of {sections}.")
    outro = " ".join(outro_bits).strip()

    parts = [p for p in [intro, body, outro] if p]
    return "\n\n".join(parts)
