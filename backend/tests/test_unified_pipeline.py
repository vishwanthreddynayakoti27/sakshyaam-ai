"""
Test Suite for Unified Intelligence Pipeline APIs
Tests: Case Context, Document Generator, Evidence Manager
"""
import pytest
import requests
import os
import io
import hashlib

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://nyaya-prahari.preview.emergentagent.com')

# Test credentials
TEST_OFFICER_ID = "TEST_UNIFIED_001"
TEST_PASSWORD = "TestPass123!"
TEST_EMAIL = "test_unified@police.gov.in"


class TestAuthSetup:
    """Setup authentication for tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get or create test user and return auth token"""
        # Try login first
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"officer_id": TEST_OFFICER_ID, "password": TEST_PASSWORD}
        )
        
        if login_response.status_code == 200:
            return login_response.json()["token"]
        
        # If login fails, create user
        signup_response = requests.post(
            f"{BASE_URL}/api/auth/signup",
            json={
                "officer_id": TEST_OFFICER_ID,
                "name": "Test Officer Unified",
                "department": "Cyber Cell",
                "rank": "Sub-Inspector",
                "district": "Hyderabad",
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            }
        )
        
        if signup_response.status_code == 200:
            return signup_response.json()["token"]
        
        # Try login again after signup
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"officer_id": TEST_OFFICER_ID, "password": TEST_PASSWORD}
        )
        
        if login_response.status_code == 200:
            return login_response.json()["token"]
        
        pytest.skip(f"Authentication failed: {login_response.text}")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Return headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}"}


class TestCaseContextAPI(TestAuthSetup):
    """Test Case Context CRUD operations"""
    
    created_context_id = None
    
    def test_create_case_context(self, auth_headers):
        """Test creating a new case context"""
        response = requests.post(
            f"{BASE_URL}/api/case-context/create",
            json={
                "fir_number": "TEST/2025/001",
                "police_station": "Makthal PS",
                "district": "Narayanpet",
                "offense_type": "Cheating"
            },
            headers=auth_headers
        )
        
        print(f"Create Case Context Response: {response.status_code}")
        print(f"Response Body: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain 'id'"
        assert data["fir_number"] == "TEST/2025/001"
        assert data["police_station"] == "Makthal PS"
        assert data["district"] == "Narayanpet"
        assert data["status"] == "Under Investigation"
        
        # Store for later tests
        TestCaseContextAPI.created_context_id = data["id"]
        print(f"Created context ID: {TestCaseContextAPI.created_context_id}")
    
    def test_list_case_contexts(self, auth_headers):
        """Test listing case contexts"""
        response = requests.get(
            f"{BASE_URL}/api/case-context/list",
            headers=auth_headers
        )
        
        print(f"List Case Contexts Response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} case contexts")
        
        # Verify our created context is in the list
        if TestCaseContextAPI.created_context_id:
            context_ids = [ctx["id"] for ctx in data]
            assert TestCaseContextAPI.created_context_id in context_ids, "Created context should be in list"
    
    def test_get_case_context(self, auth_headers):
        """Test getting a specific case context"""
        if not TestCaseContextAPI.created_context_id:
            pytest.skip("No context ID available")
        
        response = requests.get(
            f"{BASE_URL}/api/case-context/{TestCaseContextAPI.created_context_id}",
            headers=auth_headers
        )
        
        print(f"Get Case Context Response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["id"] == TestCaseContextAPI.created_context_id
        assert data["fir_number"] == "TEST/2025/001"
    
    def test_update_case_context(self, auth_headers):
        """Test updating a case context"""
        if not TestCaseContextAPI.created_context_id:
            pytest.skip("No context ID available")
        
        response = requests.put(
            f"{BASE_URL}/api/case-context/{TestCaseContextAPI.created_context_id}",
            json={
                "complainant_name": "Test Complainant",
                "complainant_phone": "9876543210",
                "sections_of_law": ["BNS 318", "BNS 319"]
            },
            headers=auth_headers
        )
        
        print(f"Update Case Context Response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["complainant_name"] == "Test Complainant"
        assert data["complainant_phone"] == "9876543210"
        assert "BNS 318" in data["sections_of_law"]
    
    def test_add_accused_person(self, auth_headers):
        """Test adding an accused person to case context"""
        if not TestCaseContextAPI.created_context_id:
            pytest.skip("No context ID available")
        
        response = requests.post(
            f"{BASE_URL}/api/case-context/{TestCaseContextAPI.created_context_id}/add-accused",
            json={
                "serial": "A1",
                "name": "Test Accused",
                "father_name": "Father Name",
                "age": 30,
                "address": "Test Address",
                "phone": "9876543211",
                "status": "At Large"
            },
            headers=auth_headers
        )
        
        print(f"Add Accused Response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
    
    def test_add_witness(self, auth_headers):
        """Test adding a witness to case context"""
        if not TestCaseContextAPI.created_context_id:
            pytest.skip("No context ID available")
        
        response = requests.post(
            f"{BASE_URL}/api/case-context/{TestCaseContextAPI.created_context_id}/add-witness",
            json={
                "serial": "LW-1",
                "name": "Test Witness",
                "father_name": "Witness Father",
                "age": 35,
                "address": "Witness Address",
                "phone": "9876543212",
                "role": "Eyewitness"
            },
            headers=auth_headers
        )
        
        print(f"Add Witness Response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
    
    def test_export_cctns_json(self, auth_headers):
        """Test CCTNS JSON export"""
        if not TestCaseContextAPI.created_context_id:
            pytest.skip("No context ID available")
        
        response = requests.get(
            f"{BASE_URL}/api/case-context/{TestCaseContextAPI.created_context_id}/export-cctns",
            headers=auth_headers
        )
        
        print(f"Export CCTNS Response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "fir_number" in data
        assert "police_station" in data
        assert "district" in data
        assert "complainant" in data
        assert "accused" in data
        assert "witnesses" in data
        print(f"CCTNS Export contains: {list(data.keys())}")


class TestDocumentGeneratorAPI(TestAuthSetup):
    """Test Document Generator APIs"""
    
    def test_generate_charge_sheet(self, auth_headers):
        """Test charge sheet generation"""
        # First ensure we have a context
        if not TestCaseContextAPI.created_context_id:
            pytest.skip("No context ID available")
        
        response = requests.post(
            f"{BASE_URL}/api/documents/{TestCaseContextAPI.created_context_id}/charge-sheet",
            headers=auth_headers
        )
        
        print(f"Generate Charge Sheet Response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert "content" in data
        assert "document_type" in data
        assert "Charge Sheet" in data["document_type"]
        print(f"Generated document type: {data['document_type']}")
        print(f"Content length: {len(data['content'])} chars")
    
    def test_generate_case_diary(self, auth_headers):
        """Test case diary generation"""
        if not TestCaseContextAPI.created_context_id:
            pytest.skip("No context ID available")
        
        response = requests.post(
            f"{BASE_URL}/api/documents/{TestCaseContextAPI.created_context_id}/case-diary",
            data={
                "entry_number": 1,
                "investigation_progress": "Initial investigation started. Witnesses being examined."
            },
            headers=auth_headers
        )
        
        print(f"Generate Case Diary Response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert "content" in data
        assert "Case Diary" in data["document_type"]
    
    def test_generate_remand_report(self, auth_headers):
        """Test remand report generation"""
        if not TestCaseContextAPI.created_context_id:
            pytest.skip("No context ID available")
        
        response = requests.post(
            f"{BASE_URL}/api/documents/{TestCaseContextAPI.created_context_id}/remand-report",
            data={
                "accused_serial": "A1",
                "grounds_for_remand": "Custodial interrogation required for recovery of evidence."
            },
            headers=auth_headers
        )
        
        print(f"Generate Remand Report Response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert "content" in data
        assert "Remand" in data["document_type"]


class TestEvidenceManagerAPI(TestAuthSetup):
    """Test Evidence Manager APIs"""
    
    uploaded_evidence_id = None
    
    def test_compute_hash_only(self, auth_headers):
        """Test computing SHA-256 hash without storing"""
        # Create a test file
        test_content = b"This is test evidence content for hash computation"
        files = {"file": ("test_evidence.txt", io.BytesIO(test_content), "text/plain")}
        
        response = requests.post(
            f"{BASE_URL}/api/evidence/compute-hash",
            files=files,
            headers=auth_headers
        )
        
        print(f"Compute Hash Response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "sha256_hash" in data
        assert "file_name" in data
        assert data["file_name"] == "test_evidence.txt"
        
        # Verify hash is correct
        expected_hash = hashlib.sha256(test_content).hexdigest()
        assert data["sha256_hash"] == expected_hash, f"Hash mismatch: {data['sha256_hash']} != {expected_hash}"
        print(f"SHA-256 Hash: {data['sha256_hash']}")
    
    def test_upload_evidence(self, auth_headers):
        """Test uploading evidence with hash computation"""
        if not TestCaseContextAPI.created_context_id:
            pytest.skip("No context ID available")
        
        # Create a test file
        test_content = b"This is uploaded evidence content for testing"
        files = {"file": ("uploaded_evidence.txt", io.BytesIO(test_content), "text/plain")}
        
        response = requests.post(
            f"{BASE_URL}/api/evidence/upload",
            files=files,
            data={
                "context_id": TestCaseContextAPI.created_context_id,
                "description": "Test evidence file",
                "seized_from": "Test Location",
                "seizure_date": "15.01.2025"
            },
            headers=auth_headers
        )
        
        print(f"Upload Evidence Response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert "evidence_id" in data
        assert "sha256_hash" in data
        
        TestEvidenceManagerAPI.uploaded_evidence_id = data["evidence_id"]
        print(f"Uploaded evidence ID: {TestEvidenceManagerAPI.uploaded_evidence_id}")
        print(f"SHA-256 Hash: {data['sha256_hash']}")
    
    def test_list_evidence(self, auth_headers):
        """Test listing evidence for a case context"""
        if not TestCaseContextAPI.created_context_id:
            pytest.skip("No context ID available")
        
        response = requests.get(
            f"{BASE_URL}/api/evidence/{TestCaseContextAPI.created_context_id}/list",
            headers=auth_headers
        )
        
        print(f"List Evidence Response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "evidence_items" in data
        assert "evidence_count" in data
        print(f"Evidence count: {data['evidence_count']}")
    
    def test_verify_evidence_hash(self, auth_headers):
        """Test verifying evidence hash"""
        if not TestEvidenceManagerAPI.uploaded_evidence_id:
            pytest.skip("No evidence ID available")
        
        # Create the same test file content
        test_content = b"This is uploaded evidence content for testing"
        files = {"file": ("verify_evidence.txt", io.BytesIO(test_content), "text/plain")}
        
        response = requests.post(
            f"{BASE_URL}/api/evidence/{TestEvidenceManagerAPI.uploaded_evidence_id}/verify-hash",
            files=files,
            headers=auth_headers
        )
        
        print(f"Verify Hash Response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "is_valid" in data
        assert data["is_valid"] == True, "Hash verification should pass for same content"
        assert "VERIFIED" in data["verdict"]
        print(f"Verification result: {data['verdict']}")
    
    def test_verify_evidence_hash_tampered(self, auth_headers):
        """Test verifying evidence hash with tampered content"""
        if not TestEvidenceManagerAPI.uploaded_evidence_id:
            pytest.skip("No evidence ID available")
        
        # Create different content (tampered)
        tampered_content = b"This is TAMPERED evidence content"
        files = {"file": ("tampered_evidence.txt", io.BytesIO(tampered_content), "text/plain")}
        
        response = requests.post(
            f"{BASE_URL}/api/evidence/{TestEvidenceManagerAPI.uploaded_evidence_id}/verify-hash",
            files=files,
            headers=auth_headers
        )
        
        print(f"Verify Tampered Hash Response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "is_valid" in data
        assert data["is_valid"] == False, "Hash verification should fail for tampered content"
        assert "FAILED" in data["verdict"]
        print(f"Tampered verification result: {data['verdict']}")


class TestBSA63Certificate(TestAuthSetup):
    """Test BSA Section 63 Certificate generation"""
    
    def test_generate_bsa_63_certificate(self, auth_headers):
        """Test BSA 63 certificate generation"""
        if not TestCaseContextAPI.created_context_id:
            pytest.skip("No context ID available")
        if not TestEvidenceManagerAPI.uploaded_evidence_id:
            pytest.skip("No evidence ID available")
        
        response = requests.post(
            f"{BASE_URL}/api/documents/{TestCaseContextAPI.created_context_id}/bsa-63-certificate",
            data={"evidence_id": TestEvidenceManagerAPI.uploaded_evidence_id},
            headers=auth_headers
        )
        
        print(f"Generate BSA 63 Certificate Response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert "content" in data
        assert "BSA Section 63" in data["document_type"]
        assert "SHA-256" in data["content"] or "sha256" in data["content"].lower()
        print(f"Generated BSA 63 certificate for evidence: {data.get('hash', 'N/A')[:32]}...")


class TestErrorHandling(TestAuthSetup):
    """Test error handling for edge cases"""
    
    def test_get_nonexistent_context(self, auth_headers):
        """Test getting a non-existent case context"""
        response = requests.get(
            f"{BASE_URL}/api/case-context/nonexistent-id-12345",
            headers=auth_headers
        )
        
        print(f"Get Nonexistent Context Response: {response.status_code}")
        assert response.status_code == 404
    
    def test_unauthorized_access(self):
        """Test accessing API without auth token"""
        response = requests.get(f"{BASE_URL}/api/case-context/list")
        
        print(f"Unauthorized Access Response: {response.status_code}")
        assert response.status_code in [401, 403]
    
    def test_invalid_token(self):
        """Test accessing API with invalid token"""
        response = requests.get(
            f"{BASE_URL}/api/case-context/list",
            headers={"Authorization": "Bearer invalid-token-12345"}
        )
        
        print(f"Invalid Token Response: {response.status_code}")
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
