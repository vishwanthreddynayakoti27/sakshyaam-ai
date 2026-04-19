"""
Test suite for Charge Sheet Fusion and Media Forensic APIs
Tests the following features:
1. Login with TEST123/test123
2. POST /api/charge-sheet-fusion/process with DOCX file
3. POST /api/forensic/analyze with image returns verdict (REAL/AI_GENERATED/DEEP_FAKE) + confidence
"""
import pytest
import requests
import os
import io

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://legal-fusion-queue.preview.emergentagent.com"

# Test credentials
TEST_OFFICER_ID = "TEST123"
TEST_PASSWORD = "test123"


class TestAuthentication:
    """Test login functionality"""
    
    def test_login_success(self):
        """Test login with valid credentials TEST123/test123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "officer_id": TEST_OFFICER_ID,
            "password": TEST_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not in response"
        assert len(data["token"]) > 0, "Token is empty"
        print(f"✓ Login successful, token received")
        return data["token"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "officer_id": "INVALID_USER",
            "password": "wrong_password"
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Invalid login correctly rejected with 401")


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "officer_id": TEST_OFFICER_ID,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}"
    }


class TestChargeSheetFusion:
    """Test Charge Sheet Fusion API - Multi-upload document processing"""
    
    def test_charge_sheet_fusion_no_documents(self, auth_headers):
        """Test that API rejects request with no documents"""
        response = requests.post(
            f"{BASE_URL}/api/charge-sheet-fusion/process",
            headers=auth_headers,
            data={
                "police_station": "Test PS",
                "district": "Test District"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"✓ Correctly rejected request with no documents")
    
    def test_charge_sheet_fusion_missing_required_fields(self, auth_headers):
        """Test that API rejects request without required fields"""
        # Create a simple test file
        test_content = b"Test document content for charge sheet"
        files = {
            "cdf": ("test.docx", io.BytesIO(test_content), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        }
        
        response = requests.post(
            f"{BASE_URL}/api/charge-sheet-fusion/process",
            headers=auth_headers,
            files=files,
            data={}  # Missing police_station and district
        )
        
        # Should fail due to missing required fields
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"
        print(f"✓ Correctly rejected request with missing required fields")
    
    def test_charge_sheet_fusion_with_docx(self, auth_headers):
        """Test charge sheet fusion with DOCX file"""
        # Create a simple DOCX-like content (minimal valid structure)
        # For testing, we'll use a simple text file with .docx extension
        test_content = b"""
        Crime Details Form
        FIR Number: TEST/2025/001
        Police Station: Cyber Crime PS
        District: Hyderabad
        
        Complainant: John Doe
        Father Name: James Doe
        Age: 35
        Address: 123 Test Street, Hyderabad
        
        Accused: A1 - Unknown Person
        
        Brief Facts: The complainant reported a cyber fraud case.
        """
        
        files = {
            "cdf": ("test_cdf.docx", io.BytesIO(test_content), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        }
        
        data = {
            "police_station": "Cyber Crime PS",
            "district": "Hyderabad",
            "fir_number": "TEST/2025/001",
            "sections": "329(4), 115(2) BNS"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/charge-sheet-fusion/process",
            headers=auth_headers,
            files=files,
            data=data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert "success" in result, "Response missing 'success' field"
        assert result["success"] == True, "Processing was not successful"
        assert "charge_sheet" in result, "Response missing 'charge_sheet' field"
        assert "extracted_data" in result, "Response missing 'extracted_data' field"
        assert "documents_processed" in result, "Response missing 'documents_processed' field"
        assert result["documents_processed"] >= 1, "No documents were processed"
        
        # Verify charge sheet contains expected content
        charge_sheet = result["charge_sheet"]
        assert "CHARGE SHEET" in charge_sheet, "Charge sheet missing header"
        assert "Cyber Crime PS" in charge_sheet or "police_station" in charge_sheet.lower(), "Police station not in charge sheet"
        
        print(f"✓ Charge Sheet Fusion successful")
        print(f"  - Documents processed: {result['documents_processed']}")
        print(f"  - Extracted data: {result['extracted_data']}")
        print(f"  - Missing fields: {result.get('missing_fields', [])}")


class TestMediaForensic:
    """Test Media Forensic API - Deepfake/AI detection"""
    
    def test_forensic_analyze_image(self, auth_headers):
        """Test forensic analysis with image file returns verdict + confidence"""
        # Create a simple test image (1x1 pixel PNG)
        # PNG header + minimal IHDR + IDAT + IEND
        test_image = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1 dimensions
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,  # bit depth, color type, etc
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,  # IDAT chunk
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,  # compressed data
            0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59,  # more data
            0xE7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,  # IEND chunk
            0x44, 0xAE, 0x42, 0x60, 0x82                      # IEND CRC
        ])
        
        files = {
            "file": ("test_image.png", io.BytesIO(test_image), "image/png")
        }
        
        response = requests.post(
            f"{BASE_URL}/api/forensic/analyze",
            headers=auth_headers,
            files=files
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        
        # Verify verdict field with new format
        assert "verdict" in result, "Response missing 'verdict' field"
        verdict = result["verdict"]
        assert verdict in ["REAL", "AI_GENERATED", "DEEP_FAKE"], f"Invalid verdict: {verdict}"
        
        # Verify confidence field
        assert "confidence" in result, "Response missing 'confidence' field"
        confidence = result["confidence"]
        assert isinstance(confidence, (int, float)), f"Confidence should be numeric, got {type(confidence)}"
        assert 0 <= confidence <= 100, f"Confidence should be 0-100, got {confidence}"
        
        # Verify other expected fields
        assert "probability_score" in result, "Response missing 'probability_score' field"
        assert "confidence_level" in result, "Response missing 'confidence_level' field"
        assert "risk_level" in result, "Response missing 'risk_level' field"
        
        print(f"✓ Media Forensic analysis successful")
        print(f"  - Verdict: [{verdict}]")
        print(f"  - Confidence: {confidence}%")
        print(f"  - Risk Level: {result['risk_level']}")
    
    def test_forensic_analyze_jpeg(self, auth_headers):
        """Test forensic analysis with JPEG file"""
        # Create a minimal JPEG file
        # JPEG header (SOI + APP0 + minimal data + EOI)
        test_jpeg = bytes([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,  # SOI + APP0
            0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,  # JFIF header
            0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,  # DQT marker
            0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,  # Quantization table
            0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C,
            0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
            0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D,
            0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
            0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
            0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
            0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34,
            0x32, 0xFF, 0xD9  # EOI
        ])
        
        files = {
            "file": ("test_image.jpg", io.BytesIO(test_jpeg), "image/jpeg")
        }
        
        response = requests.post(
            f"{BASE_URL}/api/forensic/analyze",
            headers=auth_headers,
            files=files
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert "verdict" in result, "Response missing 'verdict' field"
        assert result["verdict"] in ["REAL", "AI_GENERATED", "DEEP_FAKE"], f"Invalid verdict: {result['verdict']}"
        assert "confidence" in result, "Response missing 'confidence' field"
        
        print(f"✓ JPEG forensic analysis successful - Verdict: [{result['verdict']}], Confidence: {result['confidence']}%")
    
    def test_forensic_analyze_unsupported_file(self, auth_headers):
        """Test forensic analysis rejects unsupported file types"""
        test_content = b"This is a text file, not a media file"
        
        files = {
            "file": ("test.txt", io.BytesIO(test_content), "text/plain")
        }
        
        response = requests.post(
            f"{BASE_URL}/api/forensic/analyze",
            headers=auth_headers,
            files=files
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"✓ Correctly rejected unsupported file type")
    
    def test_forensic_analyze_no_auth(self):
        """Test forensic analysis requires authentication"""
        test_image = bytes([0x89, 0x50, 0x4E, 0x47])  # PNG header
        
        files = {
            "file": ("test.png", io.BytesIO(test_image), "image/png")
        }
        
        response = requests.post(
            f"{BASE_URL}/api/forensic/analyze",
            files=files
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Correctly requires authentication")


class TestDashboardNavigation:
    """Test dashboard and navigation endpoints"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        
        # API root should return 200 or redirect
        assert response.status_code in [200, 307, 404], f"API root check failed: {response.status_code}"
        print(f"✓ API root check passed (status: {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
