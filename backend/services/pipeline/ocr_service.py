"""
OCR Service - Google Vision API + Tesseract Fallback
======================================================
Extracts text from: PDF, DOCX, DOC, JPG, PNG, JPEG, WEBP, GIF

Primary: Google Cloud Vision API (high accuracy for Telugu/English)
Fallback: Tesseract OCR (local, no API key needed)

Uses:
  - Google Cloud Vision API for image OCR
  - Google Cloud Translate for Telugu→English translation
  - pdf2image for PDF to image conversion
  - python-docx for DOCX parsing
  - antiword for legacy DOC files
  - pytesseract as fallback OCR
"""
import io
import os
import tempfile
import subprocess
import logging
from pathlib import Path
from typing import Optional, List
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class OCRResult:
    """Result of OCR/text extraction."""
    text: str
    source_file: str
    file_type: str
    success: bool
    error: Optional[str] = None
    char_count: int = 0
    language_detected: Optional[str] = None
    ocr_engine: str = "unknown"  # "google_vision" or "tesseract"


class OCRService:
    """
    Multi-format text extraction service.
    Uses Google Cloud Vision API with Tesseract fallback.
    Supports Telugu + English + Hindi.
    """
    
    SUPPORTED_EXTENSIONS = {'.pdf', '.docx', '.doc', '.jpg', '.jpeg', '.png', '.gif', '.webp'}
    
    # Credential paths
    VISION_CREDENTIALS_PATH = "/app/backend/credentials/google_vision_4.json"
    TRANSLATE_CREDENTIALS_PATH = "/app/backend/credentials/google_vision_3.json"
    
    # Tesseract language configuration (fallback)
    TESSERACT_LANG = 'eng+tel+hin'
    TESSERACT_CONFIG = '--oem 3 --psm 6'
    
    def __init__(self, 
                 vision_credentials: Optional[str] = None,
                 translate_credentials: Optional[str] = None):
        """
        Initialize OCR service.
        
        Args:
            vision_credentials: Path to Google Vision API credentials JSON
            translate_credentials: Path to Google Translate API credentials JSON
        """
        self.vision_credentials = vision_credentials or os.environ.get(
            'GOOGLE_VISION_CREDENTIALS', 
            self.VISION_CREDENTIALS_PATH
        )
        self.translate_credentials = translate_credentials or os.environ.get(
            'GOOGLE_TRANSLATE_CREDENTIALS',
            self.TRANSLATE_CREDENTIALS_PATH
        )
        
        # Initialize Google Vision client
        self.vision_client = None
        self.translate_client = None
        self._init_google_clients()
        
        # Check Tesseract availability
        self.tesseract_available = self._check_tesseract()
    
    def _init_google_clients(self):
        """Initialize Google Cloud clients."""
        # Vision API
        if os.path.exists(self.vision_credentials):
            try:
                from google.cloud import vision
                from google.oauth2 import service_account
                
                credentials = service_account.Credentials.from_service_account_file(
                    self.vision_credentials
                )
                self.vision_client = vision.ImageAnnotatorClient(credentials=credentials)
                logger.info(f"Google Vision API initialized from {self.vision_credentials}")
            except Exception as e:
                logger.warning(f"Failed to initialize Google Vision API: {e}")
        else:
            logger.warning(f"Vision credentials not found at {self.vision_credentials}")
        
        # Translate API
        if os.path.exists(self.translate_credentials):
            try:
                from google.cloud import translate_v2 as translate
                from google.oauth2 import service_account
                
                credentials = service_account.Credentials.from_service_account_file(
                    self.translate_credentials
                )
                self.translate_client = translate.Client(credentials=credentials)
                logger.info(f"Google Translate API initialized from {self.translate_credentials}")
            except Exception as e:
                logger.warning(f"Failed to initialize Google Translate API: {e}")
    
    def _check_tesseract(self) -> bool:
        """Check if Tesseract OCR is available as fallback."""
        try:
            import pytesseract
            version = pytesseract.get_tesseract_version()
            logger.info(f"Tesseract OCR available as fallback (v{version})")
            return True
        except Exception:
            logger.warning("Tesseract OCR not available")
            return False
    
    def extract_text(self, file_path: Path, contents: Optional[bytes] = None) -> OCRResult:
        """
        Extract text from a file.
        
        Args:
            file_path: Path to the file
            contents: Optional file contents (if already loaded)
            
        Returns:
            OCRResult with extracted text
        """
        ext = file_path.suffix.lower()
        filename = file_path.name
        
        if ext not in self.SUPPORTED_EXTENSIONS:
            return OCRResult(
                text="",
                source_file=filename,
                file_type=ext,
                success=False,
                error=f"Unsupported file format: {ext}"
            )
        
        # Load contents if not provided
        if contents is None:
            try:
                with open(file_path, 'rb') as f:
                    contents = f.read()
            except Exception as e:
                return OCRResult(
                    text="",
                    source_file=filename,
                    file_type=ext,
                    success=False,
                    error=f"Failed to read file: {str(e)}"
                )
        
        # Route to appropriate extractor
        try:
            if ext == '.pdf':
                text, engine = self._extract_pdf(contents, filename)
            elif ext == '.docx':
                text = self._extract_docx(contents)
                engine = "docx_parser"
            elif ext == '.doc':
                text = self._extract_doc(contents)
                engine = "antiword"
            elif ext in {'.jpg', '.jpeg', '.png', '.gif', '.webp'}:
                text, engine = self._extract_image(contents, filename)
            else:
                text = ""
                engine = "unknown"
            
            return OCRResult(
                text=text,
                source_file=filename,
                file_type=ext,
                success=True,
                char_count=len(text),
                ocr_engine=engine
            )
            
        except Exception as e:
            logger.error(f"OCR extraction failed for {filename}: {e}")
            return OCRResult(
                text="",
                source_file=filename,
                file_type=ext,
                success=False,
                error=str(e)
            )
    
    def _extract_pdf(self, contents: bytes, filename: str) -> tuple:
        """
        Extract text from PDF.
        First tries PyPDF2 for text-based PDFs, then falls back to OCR.
        """
        text_parts = []
        
        # First try PyPDF2 for text extraction (faster for text-based PDFs)
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(io.BytesIO(contents))
            
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text and len(page_text.strip()) > 50:
                    text_parts.append(page_text)
            
            combined = "\n\n".join(text_parts)
            if len(combined.strip()) > 100:
                logger.info(f"Extracted {len(combined)} chars from PDF using PyPDF2")
                return combined, "pypdf2"
        except Exception as e:
            logger.debug(f"PyPDF2 extraction failed, falling back to OCR: {e}")
        
        # Fall back to OCR
        try:
            from pdf2image import convert_from_bytes
            
            images = convert_from_bytes(contents, dpi=300, fmt='PNG')
            logger.info(f"Converting {len(images)} PDF pages to images for OCR")
            
            for i, image in enumerate(images):
                # Convert PIL Image to bytes
                img_bytes = io.BytesIO()
                image.save(img_bytes, format='PNG')
                img_bytes.seek(0)
                
                # OCR the page
                page_text, engine = self._extract_image(img_bytes.getvalue(), f"{filename}_page{i+1}")
                
                if page_text.strip():
                    text_parts.append(f"--- Page {i+1} ---\n{page_text}")
            
            combined = "\n\n".join(text_parts)
            return combined, engine
            
        except Exception as e:
            logger.error(f"PDF OCR extraction failed: {e}")
            return f"[PDF extraction failed: {str(e)}]", "error"
    
    def _extract_docx(self, contents: bytes) -> str:
        """Extract text from DOCX including tables."""
        from docx import Document
        
        doc = Document(io.BytesIO(contents))
        text_parts = []
        
        for para in doc.paragraphs:
            if para.text.strip():
                text_parts.append(para.text)
        
        for table in doc.tables:
            for row in table.rows:
                row_text = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                if row_text:
                    text_parts.append(" | ".join(row_text))
        
        return "\n".join(text_parts)
    
    def _extract_doc(self, contents: bytes) -> str:
        """Extract text from legacy DOC using antiword."""
        with tempfile.NamedTemporaryFile(suffix='.doc', delete=False) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name
        
        try:
            result = subprocess.run(
                ['antiword', tmp_path],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                return result.stdout
            else:
                return f"[DOC extraction failed: {result.stderr}]"
        finally:
            os.unlink(tmp_path)
    
    def _extract_image(self, contents: bytes, filename: str) -> tuple:
        """
        Extract text from image.
        Primary: Google Vision API
        Fallback: Tesseract OCR
        """
        # Try Google Vision API first
        if self.vision_client:
            try:
                text = self._google_vision_ocr(contents)
                if text and len(text.strip()) > 10:
                    logger.info(f"Google Vision OCR extracted {len(text)} chars from {filename}")
                    return text, "google_vision"
            except Exception as e:
                logger.warning(f"Google Vision OCR failed, falling back to Tesseract: {e}")
        
        # Fall back to Tesseract
        if self.tesseract_available:
            text = self._tesseract_ocr(contents)
            logger.info(f"Tesseract OCR extracted {len(text)} chars from {filename}")
            return text, "tesseract"
        
        return f"[OCR not available for image: {filename}]", "none"
    
    def _google_vision_ocr(self, contents: bytes) -> str:
        """OCR using Google Cloud Vision API."""
        from google.cloud import vision
        
        image = vision.Image(content=contents)
        response = self.vision_client.text_detection(image=image)
        
        if response.error.message:
            raise Exception(response.error.message)
        
        if response.text_annotations:
            text = response.text_annotations[0].description
            
            # Translate if Telugu detected and translate client available
            if self.translate_client:
                text = self._translate_if_needed(text)
            
            return text
        
        return ""
    
    def _translate_if_needed(self, text: str) -> str:
        """Translate non-English text to English."""
        if not self.translate_client:
            return text
        
        try:
            # Detect language
            detection = self.translate_client.detect_language(text[:500])
            detected_lang = detection.get('language', 'en')
            
            # Translate if not English
            if detected_lang not in ['en', 'und']:
                logger.info(f"Detected language: {detected_lang}, translating to English")
                result = self.translate_client.translate(text, target_language='en')
                return result['translatedText']
        except Exception as e:
            logger.warning(f"Translation failed: {e}")
        
        return text
    
    def _tesseract_ocr(self, contents: bytes) -> str:
        """OCR using Tesseract (fallback)."""
        import pytesseract
        from PIL import Image
        
        image = Image.open(io.BytesIO(contents))
        
        # Convert to RGB if necessary
        if image.mode in ('RGBA', 'P'):
            image = image.convert('RGB')
        
        # Preprocess
        image = self._preprocess_image(image)
        
        # Run OCR
        try:
            text = pytesseract.image_to_string(
                image, 
                lang=self.TESSERACT_LANG,
                config=self.TESSERACT_CONFIG
            )
        except Exception:
            # Fall back to English only
            text = pytesseract.image_to_string(image, lang='eng')
        
        return text.strip()
    
    def _preprocess_image(self, image) -> 'Image':
        """Preprocess image for better OCR accuracy."""
        from PIL import Image as PILImage
        
        # Resize if too small
        min_width = 300
        if image.width < min_width:
            ratio = min_width / image.width
            new_size = (int(image.width * ratio), int(image.height * ratio))
            image = image.resize(new_size, PILImage.Resampling.LANCZOS)
        
        # Convert to grayscale
        if image.mode != 'L':
            image = image.convert('L')
        
        return image
    
    def batch_extract(self, file_paths: List[Path]) -> List[OCRResult]:
        """Extract text from multiple files."""
        results = []
        for file_path in file_paths:
            result = self.extract_text(file_path)
            results.append(result)
            logger.info(f"Extracted {result.char_count} chars from {result.source_file} using {result.ocr_engine}")
        
        return results
    
    def get_supported_languages(self) -> List[str]:
        """Get list of supported languages."""
        return ['eng', 'tel', 'hin']
