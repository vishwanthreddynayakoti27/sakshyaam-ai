"""
OCR Service - Local Tesseract-Based Text Extraction
=====================================================
Extracts text from: PDF, DOCX, DOC, JPG, PNG, JPEG, WEBP, GIF

Uses:
  - pytesseract for image OCR (Telugu + English support)
  - pdf2image for PDF to image conversion
  - python-docx for DOCX parsing
  - antiword for legacy DOC files

NO external API dependencies - fully local processing.
"""
import io
import os
import tempfile
import subprocess
import logging
from pathlib import Path
from typing import Optional, List
from dataclasses import dataclass

import pytesseract
from PIL import Image

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
    Multi-format text extraction service using local Tesseract OCR.
    Handles PDF, DOCX, DOC, and images with Telugu + English support.
    NO external API keys required.
    """
    
    SUPPORTED_EXTENSIONS = {'.pdf', '.docx', '.doc', '.jpg', '.jpeg', '.png', '.gif', '.webp'}
    
    # Tesseract language configuration
    # eng = English, tel = Telugu, hin = Hindi
    TESSERACT_LANG = 'eng+tel+hin'
    
    # Tesseract configuration for better accuracy
    TESSERACT_CONFIG = '--oem 3 --psm 6'
    # OEM 3 = Default (LSTM + Legacy)
    # PSM 6 = Assume uniform block of text
    
    def __init__(self):
        """Initialize OCR service with Tesseract."""
        self._verify_tesseract()
    
    def _verify_tesseract(self) -> bool:
        """Verify Tesseract is installed and available."""
        try:
            version = pytesseract.get_tesseract_version()
            logger.info(f"Tesseract OCR version: {version}")
            
            # Check available languages
            langs = pytesseract.get_languages()
            logger.info(f"Available languages: {langs}")
            
            return True
        except Exception as e:
            logger.error(f"Tesseract not available: {e}")
            return False
    
    def extract_text(self, file_path: Path, contents: Optional[bytes] = None) -> OCRResult:
        """
        Extract text from a file using local Tesseract OCR.
        
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
                text = self._extract_pdf(contents, filename)
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
                char_count=len(text),
                language_detected="eng+tel"
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
    
    def _extract_pdf(self, contents: bytes, filename: str) -> str:
        """
        Extract text from PDF using pdf2image + Tesseract OCR.
        Falls back to PyPDF2 for text-based PDFs.
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
            
            # If we got substantial text, return it
            combined = "\n\n".join(text_parts)
            if len(combined.strip()) > 100:
                logger.info(f"Extracted {len(combined)} chars from PDF using PyPDF2")
                return combined
        except Exception as e:
            logger.debug(f"PyPDF2 extraction failed, falling back to OCR: {e}")
        
        # Fall back to OCR using pdf2image + Tesseract
        try:
            from pdf2image import convert_from_bytes
            
            # Convert PDF pages to images
            images = convert_from_bytes(
                contents,
                dpi=300,  # Higher DPI for better OCR accuracy
                fmt='PNG'
            )
            
            logger.info(f"Converting {len(images)} PDF pages to images for OCR")
            
            for i, image in enumerate(images):
                # Apply OCR to each page
                page_text = pytesseract.image_to_string(
                    image,
                    lang=self.TESSERACT_LANG,
                    config=self.TESSERACT_CONFIG
                )
                
                if page_text.strip():
                    text_parts.append(f"--- Page {i+1} ---\n{page_text}")
            
            combined = "\n\n".join(text_parts)
            logger.info(f"OCR extracted {len(combined)} chars from PDF ({len(images)} pages)")
            return combined
            
        except Exception as e:
            logger.error(f"PDF OCR extraction failed: {e}")
            return f"[PDF extraction failed: {str(e)}]"
    
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
        """
        Extract text from image using Tesseract OCR.
        Supports Telugu + English + Hindi.
        """
        try:
            # Open image with PIL
            image = Image.open(io.BytesIO(contents))
            
            # Convert to RGB if necessary (for PNG with transparency)
            if image.mode in ('RGBA', 'P'):
                image = image.convert('RGB')
            
            # Preprocess for better OCR
            image = self._preprocess_image(image)
            
            # Run Tesseract OCR
            text = pytesseract.image_to_string(
                image,
                lang=self.TESSERACT_LANG,
                config=self.TESSERACT_CONFIG
            )
            
            logger.info(f"OCR extracted {len(text)} chars from image {filename}")
            return text.strip()
            
        except Exception as e:
            logger.error(f"Image OCR failed for {filename}: {e}")
            return f"[OCR failed for image: {str(e)}]"
    
    def _preprocess_image(self, image: Image.Image) -> Image.Image:
        """
        Preprocess image for better OCR accuracy.
        - Resize if too small
        - Convert to grayscale
        - Increase contrast
        """
        # Resize if too small (minimum 300px width)
        min_width = 300
        if image.width < min_width:
            ratio = min_width / image.width
            new_size = (int(image.width * ratio), int(image.height * ratio))
            image = image.resize(new_size, Image.Resampling.LANCZOS)
        
        # Convert to grayscale for better OCR
        if image.mode != 'L':
            image = image.convert('L')
        
        return image
    
    def batch_extract(self, file_paths: List[Path]) -> List[OCRResult]:
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
    
    def extract_from_image_bytes(self, image_bytes: bytes, lang: str = None) -> str:
        """
        Direct OCR from image bytes.
        
        Args:
            image_bytes: Raw image bytes
            lang: Language code (default: eng+tel+hin)
            
        Returns:
            Extracted text
        """
        lang = lang or self.TESSERACT_LANG
        
        try:
            image = Image.open(io.BytesIO(image_bytes))
            
            if image.mode in ('RGBA', 'P'):
                image = image.convert('RGB')
            
            image = self._preprocess_image(image)
            
            text = pytesseract.image_to_string(
                image,
                lang=lang,
                config=self.TESSERACT_CONFIG
            )
            
            return text.strip()
            
        except Exception as e:
            logger.error(f"Direct image OCR failed: {e}")
            return ""
    
    def get_supported_languages(self) -> List[str]:
        """Get list of installed Tesseract languages."""
        try:
            return pytesseract.get_languages()
        except Exception:
            return ['eng']
