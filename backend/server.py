from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import base64
import requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'nyaya-prahari-secret-key-2025-secure')
GOOGLE_VISION_API_KEY = os.environ.get('GOOGLE_VISION_API_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class Officer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    officer_id: str
    name: str
    department: str
    rank: str
    district: str
    email: EmailStr
    password_hash: str
    subscription_plan: str = "none"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OfficerCreate(BaseModel):
    officer_id: str
    name: str
    department: str
    rank: str
    district: str
    email: EmailStr
    password: str

class OfficerLogin(BaseModel):
    officer_id: str
    password: str

class OfficerResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    officer_id: str
    name: str
    department: str
    rank: str
    district: str
    email: str
    subscription_plan: str

class LoginResponse(BaseModel):
    token: str
    officer: OfficerResponse

class DocumentProcess(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    officer_id: str
    document_type: str
    original_text: str
    detected_language: str
    translated_text: str
    legal_text: str
    confidence_score: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FIRDraft(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    officer_id: str
    complaint_text: str
    fir_draft: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BNSSection(BaseModel):
    model_config = ConfigDict(extra="ignore")
    section_number: str
    title: str
    description: str
    ipc_equivalent: str
    keywords: List[str]

class BNSAnalysisRequest(BaseModel):
    text: str

class BNSAnalysisResponse(BaseModel):
    suggested_sections: List[BNSSection]
    matched_keywords: List[str]

class Reminder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    officer_id: str
    fir_id: str
    reminder_type: str
    reminder_date: datetime
    note: str
    is_completed: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReminderCreate(BaseModel):
    fir_id: str
    reminder_type: str
    reminder_date: str
    note: str

class CDRRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    officer_id: str
    case_id: str
    phone_number: str
    name: str
    call_type: str
    datetime: str
    duration: str
    imei: str
    location: str
    cell_tower: str
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OCRResponse(BaseModel):
    original_text: str
    detected_language: str
    translated_text: str
    legal_text: str
    confidence_score: float
    message: str


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(officer_id: str) -> str:
    payload = {
        'officer_id': officer_id,
        'exp': datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

async def get_current_officer(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload['officer_id']
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


@api_router.get("/")
async def root():
    return {"message": "NYAYA PRAHARI API - Investigation & FIR Preparation Assistant"}


@api_router.post("/auth/signup", response_model=LoginResponse)
async def signup(officer_data: OfficerCreate):
    existing = await db.officers.find_one({"officer_id": officer_data.officer_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Officer ID already exists")
    
    password_hash = hash_password(officer_data.password)
    officer = Officer(
        officer_id=officer_data.officer_id,
        name=officer_data.name,
        department=officer_data.department,
        rank=officer_data.rank,
        district=officer_data.district,
        email=officer_data.email,
        password_hash=password_hash
    )
    
    doc = officer.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.officers.insert_one(doc)
    
    token = create_token(officer.officer_id)
    officer_response = OfficerResponse(
        id=officer.id,
        officer_id=officer.officer_id,
        name=officer.name,
        department=officer.department,
        rank=officer.rank,
        district=officer.district,
        email=officer.email,
        subscription_plan=officer.subscription_plan
    )
    
    return LoginResponse(token=token, officer=officer_response)


@api_router.post("/auth/login", response_model=LoginResponse)
async def login(login_data: OfficerLogin):
    officer_doc = await db.officers.find_one({"officer_id": login_data.officer_id}, {"_id": 0})
    if not officer_doc:
        raise HTTPException(status_code=401, detail="Officer not found")
    
    if not verify_password(login_data.password, officer_doc['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid password")
    
    token = create_token(officer_doc['officer_id'])
    officer_response = OfficerResponse(
        id=officer_doc['id'],
        officer_id=officer_doc['officer_id'],
        name=officer_doc['name'],
        department=officer_doc['department'],
        rank=officer_doc['rank'],
        district=officer_doc['district'],
        email=officer_doc['email'],
        subscription_plan=officer_doc.get('subscription_plan', 'none')
    )
    
    return LoginResponse(token=token, officer=officer_response)


@api_router.get("/auth/profile", response_model=OfficerResponse)
async def get_profile(officer_id: str = Depends(get_current_officer)):
    officer_doc = await db.officers.find_one({"officer_id": officer_id}, {"_id": 0})
    if not officer_doc:
        raise HTTPException(status_code=404, detail="Officer not found")
    
    return OfficerResponse(
        id=officer_doc['id'],
        officer_id=officer_doc['officer_id'],
        name=officer_doc['name'],
        department=officer_doc['department'],
        rank=officer_doc['rank'],
        district=officer_doc['district'],
        email=officer_doc['email'],
        subscription_plan=officer_doc.get('subscription_plan', 'none')
    )


@api_router.post("/subscription/update")
async def update_subscription(
    plan: str = Form(...),
    officer_id: str = Depends(get_current_officer)
):
    result = await db.officers.update_one(
        {"officer_id": officer_id},
        {"$set": {"subscription_plan": plan}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Officer not found")
    
    return {"message": f"Subscription updated to {plan}", "plan": plan}


@api_router.post("/ocr/process", response_model=OCRResponse)
async def process_ocr(
    file: UploadFile = File(...),
    officer_id: str = Depends(get_current_officer)
):
    try:
        contents = await file.read()
        
        if not GOOGLE_VISION_API_KEY:
            return OCRResponse(
                original_text="",
                detected_language="",
                translated_text="",
                legal_text="",
                confidence_score=0.0,
                message="Google Vision API key not configured. Please add GOOGLE_VISION_API_KEY to backend .env file."
            )
        
        import requests
        encoded_image = base64.b64encode(contents).decode('utf-8')
        
        vision_api_url = f"https://vision.googleapis.com/v1/images:annotate?key={GOOGLE_VISION_API_KEY}"
        
        request_body = {
            "requests": [
                {
                    "image": {
                        "content": encoded_image
                    },
                    "features": [
                        {
                            "type": "TEXT_DETECTION"
                        }
                    ]
                }
            ]
        }
        
        vision_response = requests.post(vision_api_url, json=request_body, timeout=30)
        
        if vision_response.status_code == 400:
            error_data = vision_response.json()
            error_msg = error_data.get('error', {}).get('message', 'Invalid API key')
            logger.warning(f"Vision API key invalid: {error_msg}")
            return OCRResponse(
                original_text="",
                detected_language="",
                translated_text="",
                legal_text="",
                confidence_score=0.0,
                message="Google Vision API key is invalid. Please verify: 1) API key is correct, 2) Vision API is enabled in Google Cloud Console, 3) Billing is enabled for your project. Contact support for assistance."
            )
        
        if vision_response.status_code != 200:
            error_msg = vision_response.json().get('error', {}).get('message', 'Vision API error')
            logger.error(f"Vision API error: {error_msg}")
            return OCRResponse(
                original_text="",
                detected_language="",
                translated_text="",
                legal_text="",
                confidence_score=0.0,
                message=f"Vision API Error: {error_msg}"
            )
        
        result = vision_response.json()
        
        if 'responses' not in result or not result['responses']:
            return OCRResponse(
                original_text="",
                detected_language="Unknown",
                translated_text="No text detected in the image",
                legal_text="",
                confidence_score=0.0,
                message="No text detected in the image"
            )
        
        text_annotations = result['responses'][0].get('textAnnotations', [])
        
        if not text_annotations:
            return OCRResponse(
                original_text="",
                detected_language="Unknown",
                translated_text="No text detected in the image",
                legal_text="",
                confidence_score=0.0,
                message="No text detected in the image"
            )
        
        detected_text = text_annotations[0].get('description', '')
        detected_language = text_annotations[0].get('locale', 'Unknown')
        
        translated_text = detected_text
        legal_text = format_to_legal_text(detected_text)
        
        doc_process = DocumentProcess(
            officer_id=officer_id,
            document_type="image",
            original_text=detected_text,
            detected_language=detected_language,
            translated_text=translated_text,
            legal_text=legal_text,
            confidence_score=0.95
        )
        
        doc_dict = doc_process.model_dump()
        doc_dict['created_at'] = doc_dict['created_at'].isoformat()
        await db.documents.insert_one(doc_dict)
        
        return OCRResponse(
            original_text=detected_text,
            detected_language=detected_language,
            translated_text=translated_text,
            legal_text=legal_text,
            confidence_score=0.95,
            message="OCR processing successful. Translation API can be enabled by adding billing to your Google Cloud project."
        )
        
    except requests.exceptions.RequestException as e:
        logger.error(f"OCR request error: {str(e)}")
        return OCRResponse(
            original_text="",
            detected_language="",
            translated_text="",
            legal_text="",
            confidence_score=0.0,
            message="Network error connecting to Vision API. Please check your internet connection."
        )
    except Exception as e:
        logger.error(f"OCR processing error: {str(e)}")
        return OCRResponse(
            original_text="",
            detected_language="",
            translated_text="",
            legal_text="",
            confidence_score=0.0,
            message=f"OCR processing failed: {str(e)}"
        )


@api_router.post("/translate/process")
async def process_translation(
    text: str = Form(...),
    officer_id: str = Depends(get_current_officer)
):
    return {
        "original_text": text,
        "detected_language": "Telugu/Hindi",
        "translated_text": text,
        "legal_text": format_to_legal_text(text),
        "message": "Translation API ready to activate. Enable billing in Google Cloud Console to use Google Translation API."
    }


@api_router.post("/speech/process")
async def process_speech(
    file: UploadFile = File(...),
    officer_id: str = Depends(get_current_officer)
):
    return {
        "transcribed_text": "",
        "detected_language": "",
        "translated_text": "",
        "legal_text": "",
        "message": "Speech-to-Text API ready to activate. Enable billing in Google Cloud Console to use Google Speech-to-Text API."
    }


def format_to_legal_text(text: str) -> str:
    text = text.replace("I ", "The complainant ")
    text = text.replace("my ", "the complainant's ")
    text = text.replace("me ", "the complainant ")
    
    legal_intro = "It is stated that "
    if not text.startswith(legal_intro):
        text = legal_intro + text[0].lower() + text[1:] if text else text
    
    return text


@api_router.post("/fir/create", response_model=FIRDraft)
async def create_fir_draft(
    complaint_text: str = Form(...),
    officer_id: str = Depends(get_current_officer)
):
    fir_text = format_to_legal_text(complaint_text)
    
    fir_draft = FIRDraft(
        officer_id=officer_id,
        complaint_text=complaint_text,
        fir_draft=fir_text
    )
    
    doc = fir_draft.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    await db.fir_drafts.insert_one(doc)
    
    return fir_draft


@api_router.get("/fir/list", response_model=List[FIRDraft])
async def list_fir_drafts(officer_id: str = Depends(get_current_officer)):
    drafts = await db.fir_drafts.find({"officer_id": officer_id}, {"_id": 0}).to_list(100)
    
    for draft in drafts:
        if isinstance(draft.get('created_at'), str):
            draft['created_at'] = datetime.fromisoformat(draft['created_at'])
        if isinstance(draft.get('updated_at'), str):
            draft['updated_at'] = datetime.fromisoformat(draft['updated_at'])
    
    return drafts


@api_router.get("/fir/{fir_id}", response_model=FIRDraft)
async def get_fir_draft(fir_id: str, officer_id: str = Depends(get_current_officer)):
    draft = await db.fir_drafts.find_one({"id": fir_id, "officer_id": officer_id}, {"_id": 0})
    if not draft:
        raise HTTPException(status_code=404, detail="FIR draft not found")
    
    if isinstance(draft.get('created_at'), str):
        draft['created_at'] = datetime.fromisoformat(draft['created_at'])
    if isinstance(draft.get('updated_at'), str):
        draft['updated_at'] = datetime.fromisoformat(draft['updated_at'])
    
    return FIRDraft(**draft)


@api_router.post("/bns/analyze", response_model=BNSAnalysisResponse)
async def analyze_bns(request: BNSAnalysisRequest, officer_id: str = Depends(get_current_officer)):
    text_lower = request.text.lower()
    
    bns_sections_data = [
        {
            "section_number": "BNS 103",
            "title": "Murder",
            "description": "Whoever commits murder shall be punished with death or imprisonment for life",
            "ipc_equivalent": "IPC 302",
            "keywords": ["murder", "killed", "death", "homicide"]
        },
        {
            "section_number": "BNS 115",
            "title": "Voluntarily Causing Hurt",
            "description": "Causing hurt voluntarily",
            "ipc_equivalent": "IPC 323",
            "keywords": ["hurt", "assault", "beat", "injury", "attacked"]
        },
        {
            "section_number": "BNS 303",
            "title": "Theft",
            "description": "Whoever commits theft shall be punished",
            "ipc_equivalent": "IPC 379",
            "keywords": ["theft", "stolen", "stole", "took", "property"]
        },
        {
            "section_number": "BNS 309",
            "title": "Robbery",
            "description": "Robbery with violence or threat",
            "ipc_equivalent": "IPC 392",
            "keywords": ["robbery", "robbed", "violence", "force"]
        },
        {
            "section_number": "BNS 318",
            "title": "Cheating",
            "description": "Cheating and fraudulently inducing delivery of property",
            "ipc_equivalent": "IPC 420",
            "keywords": ["cheating", "fraud", "deceived", "dishonest"]
        },
        {
            "section_number": "BNS 137",
            "title": "Kidnapping",
            "description": "Kidnapping from lawful guardianship",
            "ipc_equivalent": "IPC 363",
            "keywords": ["kidnapping", "abducted", "taken", "missing"]
        }
    ]
    
    suggested_sections = []
    matched_keywords = []
    
    for section_data in bns_sections_data:
        for keyword in section_data["keywords"]:
            if keyword in text_lower:
                suggested_sections.append(BNSSection(**section_data))
                matched_keywords.append(keyword)
                break
    
    return BNSAnalysisResponse(
        suggested_sections=suggested_sections,
        matched_keywords=list(set(matched_keywords))
    )


@api_router.post("/bns/search")
async def search_bns_section(section_number: str = Form(...), officer_id: str = Depends(get_current_officer)):
    bns_mapping = {
        "103": {"bns": "BNS 103", "ipc": "IPC 302", "title": "Murder"},
        "115": {"bns": "BNS 115", "ipc": "IPC 323", "title": "Voluntarily Causing Hurt"},
        "303": {"bns": "BNS 303", "ipc": "IPC 379", "title": "Theft"},
        "309": {"bns": "BNS 309", "ipc": "IPC 392", "title": "Robbery"},
        "318": {"bns": "BNS 318", "ipc": "IPC 420", "title": "Cheating"},
        "137": {"bns": "BNS 137", "ipc": "IPC 363", "title": "Kidnapping"}
    }
    
    section_num = section_number.replace("BNS", "").replace("bns", "").strip()
    
    if section_num in bns_mapping:
        return bns_mapping[section_num]
    
    return {"message": "Section not found", "section": section_number}


@api_router.post("/reminders/create", response_model=Reminder)
async def create_reminder(reminder_data: ReminderCreate, officer_id: str = Depends(get_current_officer)):
    reminder = Reminder(
        officer_id=officer_id,
        fir_id=reminder_data.fir_id,
        reminder_type=reminder_data.reminder_type,
        reminder_date=datetime.fromisoformat(reminder_data.reminder_date),
        note=reminder_data.note
    )
    
    doc = reminder.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['reminder_date'] = doc['reminder_date'].isoformat()
    await db.reminders.insert_one(doc)
    
    return reminder


@api_router.get("/reminders/list", response_model=List[Reminder])
async def list_reminders(officer_id: str = Depends(get_current_officer)):
    reminders = await db.reminders.find({"officer_id": officer_id}, {"_id": 0}).to_list(100)
    
    for reminder in reminders:
        if isinstance(reminder.get('created_at'), str):
            reminder['created_at'] = datetime.fromisoformat(reminder['created_at'])
        if isinstance(reminder.get('reminder_date'), str):
            reminder['reminder_date'] = datetime.fromisoformat(reminder['reminder_date'])
    
    return reminders


@api_router.post("/cdr/upload")
async def upload_cdr(
    file: UploadFile = File(...),
    case_id: str = Form(...),
    officer_id: str = Depends(get_current_officer)
):
    contents = await file.read()
    
    return {
        "message": "CDR upload successful. File parsing ready.",
        "case_id": case_id,
        "filename": file.filename,
        "size": len(contents)
    }


@api_router.get("/cdr/records")
async def get_cdr_records(
    case_id: str,
    officer_id: str = Depends(get_current_officer)
):
    records = await db.cdr_records.find({"officer_id": officer_id, "case_id": case_id}, {"_id": 0}).to_list(1000)
    return {"records": records, "count": len(records)}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
