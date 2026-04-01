"""
OCR Service - Text Extraction from Multiple File Formats
=========================================================
Extracts text from: PDF, DOCX, DOC, JPG, PNG, JPEG, WEBP, GIF

Uses:
  - PyPDF2 for PDF text extraction
  - python-docx for DOCX parsing
  - antiword for legacy DOC files
  - pytesseract for image OCR
"""
import io
import os
import tempfile
import subprocess
import logging
from pathlib import Path
from typing import Optional, Tuple
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


class OCRService:
    """
    Multi-format text extraction service.
    Handles PDF, DOCX, DOC, and images with OCR.
    """
    
    SUPPORTED_EXTENSIONS = {'.pdf', '.docx', '.doc', '.jpg', '.jpeg', '.png', '.gif', '.webp'}
    
    def __init__(self, google_vision_credentials: Optional[str] = None, 
                 google_translate_credentials: Optional[str] = None):
        """
        Initialize OCR service.
        
        Args:
            google_vision_credentials: Path to Google Vision API credentials JSON
            google_translate_credentials: Path to Google Translate API credentials JSON
        """
        self.google_vision_credentials = google_vision_credentials or os.environ.get('GOOGLE_VISION_CREDENTIALS', '')
        self.google_translate_credentials = google_translate_credentials or os.environ.get('GOOGLE_TRANSLATE_CREDENTIALS', '')
        
        # Check if tesseract is available as fallback
        self.tesseract_available = self._check_tesseract()
    
    def _check_tesseract(self) -> bool:
        """Check if tesseract OCR is available."""
        try:
            result = subprocess.run(['tesseract', '--version'], capture_output=True, timeout=5)
            return result.returncode == 0
        except Exception:
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
                text = self._extract_pdf(contents)
            elif ext == '.docx':
                text = self._extract_docx(contents)
            elif ext == '.doc':
                text = self._extract_doc(contents)
            elif ext in {'.jpg', '.jpeg', '.png', '.gif', '.webp'}:
                text = self._extract_image(contents, filename)
            else:
                text = ""
            
            return OCRResult(
                text=text,
                source_file=filename,
                file_type=ext,
                success=True,
                char_count=len(text)
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
    
    def _extract_pdf(self, contents: bytes) -> str:
        """Extract text from PDF using PyPDF2."""
        from PyPDF2 import PdfReader
        
        reader = PdfReader(io.BytesIO(contents))
        text_parts = []
        
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
        
        return "\n\n".join(text_parts) if text_parts else ""
    
    def _extract_docx(self, contents: bytes) -> str:
        """Extract text from DOCX including tables."""
        from docx import Document
        
        doc = Document(io.BytesIO(contents))
        text_parts = []
        
        # Extract paragraphs
        for para in doc.paragraphs:
            if para.text.strip():
                text_parts.append(para.text)
        
        # Extract tables
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
                logger.warning(f"antiword failed: {result.stderr}")
                return f"[DOC extraction failed: {result.stderr}]"
        finally:
            os.unlink(tmp_path)
    
    def _extract_image(self, contents: bytes, filename: str) -> str:
        """Extract text from image using Google Vision or Tesseract."""
        
        # Try Google Vision first (higher quality)
        if self.google_vision_credentials and os.path.exists(self.google_vision_credentials):
            try:
                return self._google_vision_ocr(contents)
            except Exception as e:
                logger.warning(f"Google Vision failed, falling back to Tesseract: {e}")
        
        # Fallback to Tesseract
        if self.tesseract_available:
            return self._tesseract_ocr(contents)
        
        return f"[OCR not configured for image: {filename}]"
    
    def _google_vision_ocr(self, contents: bytes) -> str:
        """OCR using Google Cloud Vision API."""
        from google.cloud import vision
        from google.oauth2 import service_account
        
        credentials = service_account.Credentials.from_service_account_file(
            self.google_vision_credentials
        )
        client = vision.ImageAnnotatorClient(credentials=credentials)
        
        image = vision.Image(content=contents)
        response = client.text_detection(image=image)
        
        if response.text_annotations:
            text = response.text_annotations[0].description
            
            # Auto-translate if Telugu/Hindi detected
            if self.google_translate_credentials and os.path.exists(self.google_translate_credentials):
                text = self._translate_if_needed(text)
            
            return text
        
        return ""
    
    def _tesseract_ocr(self, contents: bytes) -> str:
        """OCR using Tesseract (fallback)."""
        import pytesseract
        from PIL import Image
        
        image = Image.open(io.BytesIO(contents))
        
        # Try multiple languages
        try:
            text = pytesseract.image_to_string(image, lang='eng+tel+hin')
        except Exception:
            text = pytesseract.image_to_string(image, lang='eng')
        
        return text
    
    def _translate_if_needed(self, text: str) -> str:
        """Translate non-English text to English."""
        try:
            from google.cloud import translate_v2 as translate
            from google.oauth2 import service_account
            
            credentials = service_account.Credentials.from_service_account_file(
                self.google_translate_credentials
            )
            client = translate.Client(credentials=credentials)
            
            # Detect language
            detection = client.detect_language(text[:500])
            
            if detection['language'] not in ['en', 'und']:
                result = client.translate(text, target_language='en')
                return result['translatedText']
        except Exception as e:
            logger.warning(f"Translation failed: {e}")
        
        return text
    
    def batch_extract(self, file_paths: list[Path]) -> list[OCRResult]:
        """
        Extract text from multiple files.
        
        Args:
            file_paths: List of file paths to process
            
        Returns:
            List of OCRResult objects
        """
        results = []
        for file_path in file_paths:
            result = self.extract_text(file_path)
            results.append(result)
            logger.info(f"Extracted {result.char_count} chars from {result.source_file}")
        
        return results
