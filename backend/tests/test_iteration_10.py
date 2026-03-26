"""
Iteration 10 Backend Tests
Tests for:
1. BSA Section 63 Certificate Generation (POST /api/evidence/generate-certificate)
2. Quick Hash Computation (POST /api/evidence/compute-hash-only)
3. Smart Summons WhatsApp Scheduler (POST /api/summons/schedule, GET /api/summons/scheduled)
"""
import pytest
import requests
import os
import io
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_OFFICER_ID = "TEST123"
TEST_PASSWORD = "test123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for testing."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"officer_id": TEST_OFFICER_ID, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture
def auth_headers(auth_token):
    """Return headers with auth token."""
    return {"Authorization": f"Bearer {auth_token}"}


class TestBSASection63Certificate:
    """Tests for BSA Section 63 Hash Certificate Generation."""
    
    def test_generate_certificate_success(self, auth_headers):
        """Test successful certificate generation with file upload."""
        # Create a test file
        test_content = b"This is test evidence content for BSA Section 63 certificate."
        files = {
            'file': ('test_evidence.txt', io.BytesIO(test_content), 'text/plain')
        }
        data = {
            'fir_number': 'FIR/2025/001',
            'police_station': 'Test Police Station',
            'seized_from': 'Test Accused',
            'seizure_date': '15/01/2025'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/evidence/generate-certificate",
            headers=auth_headers,
            files=files,
            data=data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        # Verify certificate structure
        assert "certificate_id" in result, "Missing certificate_id"
        assert "certificate_text" in result, "Missing certificate_text"
        assert "certificate_html" in result, "Missing certificate_html"
        assert "sha256_hash" in result, "Missing sha256_hash"
        assert "md5_hash" in result, "Missing md5_hash"
        assert "file_name" in result, "Missing file_name"
        assert "file_size" in result, "Missing file_size"
        
        # Verify hash format (SHA-256 is 64 hex chars, MD5 is 32 hex chars)
        assert len(result["sha256_hash"]) == 64, f"Invalid SHA-256 hash length: {len(result['sha256_hash'])}"
        assert len(result["md5_hash"]) == 32, f"Invalid MD5 hash length: {len(result['md5_hash'])}"
        
        # Verify certificate contains BSA Section 63 reference (case-insensitive)
        cert_text_upper = result["certificate_text"].upper()
        assert "SECTION 63" in cert_text_upper, "Certificate should reference Section 63"
        assert "BSA" in cert_text_upper, "Certificate should reference BSA"
        
        print(f"Certificate generated: {result['certificate_id']}")
        print(f"SHA-256: {result['sha256_hash']}")
        print(f"MD5: {result['md5_hash']}")
    
    def test_generate_certificate_without_auth(self):
        """Test certificate generation requires authentication."""
        test_content = b"Test content"
        files = {'file': ('test.txt', io.BytesIO(test_content), 'text/plain')}
        
        response = requests.post(
            f"{BASE_URL}/api/evidence/generate-certificate",
            files=files
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_generate_certificate_no_file(self, auth_headers):
        """Test certificate generation fails without file."""
        response = requests.post(
            f"{BASE_URL}/api/evidence/generate-certificate",
            headers=auth_headers
        )
        
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"


class TestQuickHashComputation:
    """Tests for quick hash computation endpoint."""
    
    def test_compute_hash_success(self, auth_headers):
        """Test successful hash computation."""
        test_content = b"Test content for hash computation"
        files = {'file': ('test_hash.txt', io.BytesIO(test_content), 'text/plain')}
        
        response = requests.post(
            f"{BASE_URL}/api/evidence/compute-hash-only",
            headers=auth_headers,
            files=files
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert "sha256_hash" in result, "Missing sha256_hash"
        assert "md5_hash" in result, "Missing md5_hash"
        assert "file_name" in result, "Missing file_name"
        assert "file_size" in result, "Missing file_size"
        assert "computed_at" in result, "Missing computed_at"
        
        # Verify hash lengths
        assert len(result["sha256_hash"]) == 64, "Invalid SHA-256 hash length"
        assert len(result["md5_hash"]) == 32, "Invalid MD5 hash length"
        
        print(f"Quick hash computed for: {result['file_name']}")
        print(f"SHA-256: {result['sha256_hash']}")
    
    def test_compute_hash_without_auth(self):
        """Test hash computation requires authentication."""
        test_content = b"Test content"
        files = {'file': ('test.txt', io.BytesIO(test_content), 'text/plain')}
        
        response = requests.post(
            f"{BASE_URL}/api/evidence/compute-hash-only",
            files=files
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestSmartSummonsScheduler:
    """Tests for Smart Summons WhatsApp Scheduler."""
    
    def test_schedule_summons_success(self, auth_headers):
        """Test successful summons scheduling with future date."""
        # Use a date 7 days in the future
        future_date = datetime.now() + timedelta(days=7)
        hearing_date = future_date.strftime("%d/%m/%Y")
        
        summons_data = {
            "summons_id": f"TEST_SUMMONS_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "case_number": "CC/2025/TEST001",
            "court_name": "District Court, Test City",
            "hearing_date": hearing_date,
            "hearing_time": "10:30 AM",
            "party_name": "Test Party",
            "advocate": "Test Advocate",
            "purpose": "Witness Examination",
            "court_police_phone": "9876543210",
            "victim_phone": "9876543211",
            "advocate_phone": "9876543212"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/summons/schedule",
            headers=auth_headers,
            json=summons_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert result.get("success") == True, f"Scheduling failed: {result}"
        assert "summons_id" in result, "Missing summons_id"
        assert "notification_time" in result, "Missing notification_time"
        assert "preview_message" in result, "Missing preview_message"
        
        # Verify preview message contains case details
        preview = result.get("preview_message", "")
        assert "CC/2025/TEST001" in preview, "Preview should contain case number"
        assert "District Court" in preview, "Preview should contain court name"
        
        print(f"Summons scheduled: {result['summons_id']}")
        print(f"Notification time: {result['notification_time']}")
    
    def test_schedule_summons_past_date_fails(self, auth_headers):
        """Test scheduling with past date fails."""
        # Use a date 7 days in the past
        past_date = datetime.now() - timedelta(days=7)
        hearing_date = past_date.strftime("%d/%m/%Y")
        
        summons_data = {
            "summons_id": f"TEST_PAST_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "case_number": "CC/2025/PAST001",
            "court_name": "District Court",
            "hearing_date": hearing_date,
            "hearing_time": "10:30 AM",
            "party_name": "Test Party",
            "advocate": "Test Advocate",
            "purpose": "Test",
            "court_police_phone": "9876543210",
            "victim_phone": "9876543211",
            "advocate_phone": "9876543212"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/summons/schedule",
            headers=auth_headers,
            json=summons_data
        )
        
        # Should return 200 but with success=False
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        result = response.json()
        assert result.get("success") == False, "Past date scheduling should fail"
        print(f"Past date correctly rejected: {result.get('message', result.get('error', ''))}")
    
    def test_get_scheduled_summons(self, auth_headers):
        """Test retrieving scheduled summons list."""
        response = requests.get(
            f"{BASE_URL}/api/summons/scheduled",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert "summons" in result, "Missing summons list"
        assert "count" in result, "Missing count"
        assert isinstance(result["summons"], list), "summons should be a list"
        
        print(f"Found {result['count']} scheduled summons")
    
    def test_schedule_summons_without_auth(self):
        """Test summons scheduling requires authentication."""
        summons_data = {
            "summons_id": "TEST_NOAUTH",
            "case_number": "CC/2025/NOAUTH",
            "hearing_date": "01/02/2025",
            "court_police_phone": "9876543210",
            "victim_phone": "9876543211",
            "advocate_phone": "9876543212"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/summons/schedule",
            json=summons_data
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_schedule_summons_missing_required_fields(self, auth_headers):
        """Test summons scheduling fails with missing required fields."""
        # Missing phone numbers
        summons_data = {
            "summons_id": "TEST_MISSING",
            "case_number": "CC/2025/MISSING",
            "hearing_date": "01/02/2025"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/summons/schedule",
            headers=auth_headers,
            json=summons_data
        )
        
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"


class TestListCertificates:
    """Tests for listing generated certificates."""
    
    def test_list_certificates(self, auth_headers):
        """Test listing all generated certificates."""
        response = requests.get(
            f"{BASE_URL}/api/evidence/certificates",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert "certificates" in result, "Missing certificates list"
        assert "count" in result, "Missing count"
        
        print(f"Found {result['count']} certificates")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
