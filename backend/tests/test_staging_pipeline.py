"""
Test Suite for Staging Pipeline APIs - Iteration 11
=====================================================
Tests the modular document processing pipeline:
- POST /api/staging/create-case - Create case folder (0 credits)
- POST /api/staging/upload-files/{case_id} - Upload files (0 credits)
- GET /api/staging/case/{case_id} - List staged files
- DELETE /api/staging/case/{case_id}/file/{filename} - Remove file
- POST /api/staging/generate-triple-fusion/{case_id} - Generate documents
- Verify CCTNS JSON and pipeline_stats in response
"""
import pytest
import requests
import os
import io
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://nyaya-prahari.preview.emergentagent.com"

# Test credentials
TEST_OFFICER_ID = "TEST123"
TEST_PASSWORD = "test123"


class TestStagingPipelineAPIs:
    """Test suite for staging and pipeline APIs."""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures."""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Get auth token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"officer_id": TEST_OFFICER_ID, "password": TEST_PASSWORD}
        )
        
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.auth_token = token
        else:
            pytest.skip("Authentication failed - skipping tests")
        
        yield
        
        self.session.close()
    
    # ==================== CREATE CASE TESTS ====================
    
    def test_create_case_success(self):
        """Test creating a staging case folder - should return case_id and 0 credits."""
        form_data = {
            "police_station": "Makthal",
            "district": "Narayanpet",
            "fir_number": f"TEST-{datetime.now().strftime('%H%M%S')}/2026",
            "sections": "118(2), 115(2) BNS"
        }
        
        # Remove Content-Type header for form data
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/staging/create-case",
            data=form_data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        assert "case_id" in data, "Expected case_id in response"
        assert data.get("credits_used") == 0, "Expected 0 credits for case creation"
        assert data["case_id"].startswith("CASE-"), "Case ID should start with CASE-"
        
        print(f"Created case: {data['case_id']}, credits_used: {data['credits_used']}")
        
        # Store for later tests
        self.__class__.created_case_id = data["case_id"]
    
    def test_create_case_requires_auth(self):
        """Test that create-case requires authentication."""
        form_data = {
            "police_station": "Test",
            "district": "Test"
        }
        
        # Remove auth header
        response = requests.post(
            f"{BASE_URL}/api/staging/create-case",
            data=form_data
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Create case correctly requires authentication")
    
    # ==================== UPLOAD FILES TESTS ====================
    
    def test_upload_files_success(self):
        """Test uploading files to staging - should accept PDF/DOCX/JPG and use 0 credits."""
        # First create a case
        form_data = {
            "police_station": "Makthal",
            "district": "Narayanpet",
            "fir_number": f"UPLOAD-{datetime.now().strftime('%H%M%S')}/2026",
            "sections": "118(2) BNS"
        }
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        create_response = requests.post(
            f"{BASE_URL}/api/staging/create-case",
            data=form_data,
            headers=headers
        )
        
        assert create_response.status_code == 200
        case_id = create_response.json()["case_id"]
        
        # Create test files
        test_pdf_content = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF"
        test_txt_content = b"FIR Number: 57/2026\nComplainant: Test Person\nAccused: Unknown"
        
        files = [
            ("files", ("test_fir.pdf", io.BytesIO(test_pdf_content), "application/pdf")),
            ("files", ("test_doc.docx", io.BytesIO(test_txt_content), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/staging/upload-files/{case_id}",
            files=files,
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        assert data.get("credits_used") == 0, "Expected 0 credits for upload"
        assert data.get("files_saved") >= 1, "Expected at least 1 file saved"
        assert "saved_files" in data, "Expected saved_files in response"
        
        print(f"Uploaded {data['files_saved']} files, total: {data['total_files_in_case']}, credits: {data['credits_used']}")
        
        # Store for later tests
        self.__class__.upload_case_id = case_id
        if data.get("saved_files"):
            self.__class__.uploaded_filename = data["saved_files"][0]["saved_name"]
    
    def test_upload_files_requires_auth(self):
        """Test that upload requires authentication."""
        files = [("files", ("test.pdf", io.BytesIO(b"test"), "application/pdf"))]
        
        response = requests.post(
            f"{BASE_URL}/api/staging/upload-files/FAKE-CASE",
            files=files
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Upload correctly requires authentication")
    
    # ==================== GET STAGED FILES TESTS ====================
    
    def test_get_staged_files_success(self):
        """Test listing staged files in a case."""
        # Use case from upload test
        case_id = getattr(self.__class__, 'upload_case_id', None)
        if not case_id:
            pytest.skip("No case_id from previous test")
        
        response = self.session.get(
            f"{BASE_URL}/api/staging/case/{case_id}",
            headers={"Authorization": f"Bearer {self.auth_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        assert "metadata" in data, "Expected metadata in response"
        assert "file_count" in data, "Expected file_count in response"
        assert data.get("credits_used") == 0, "Expected 0 credits"
        
        print(f"Case {case_id} has {data['file_count']} files")
    
    def test_get_staged_files_not_found(self):
        """Test getting files for non-existent case."""
        response = self.session.get(
            f"{BASE_URL}/api/staging/case/NONEXISTENT-CASE-123",
            headers={"Authorization": f"Bearer {self.auth_token}"}
        )
        
        # Should return 200 with empty files or 404
        # Based on implementation, it creates folder if not exists
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
        print(f"Non-existent case returns status {response.status_code}")
    
    # ==================== DELETE FILE TESTS ====================
    
    def test_delete_staged_file_success(self):
        """Test deleting a file from staging."""
        case_id = getattr(self.__class__, 'upload_case_id', None)
        filename = getattr(self.__class__, 'uploaded_filename', None)
        
        if not case_id or not filename:
            pytest.skip("No case_id or filename from previous test")
        
        response = self.session.delete(
            f"{BASE_URL}/api/staging/case/{case_id}/file/{filename}",
            headers={"Authorization": f"Bearer {self.auth_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        assert data.get("credits_used") == 0, "Expected 0 credits"
        
        print(f"Deleted file {filename} from case {case_id}")
    
    def test_delete_file_not_found(self):
        """Test deleting non-existent file."""
        case_id = getattr(self.__class__, 'upload_case_id', None)
        if not case_id:
            pytest.skip("No case_id from previous test")
        
        response = self.session.delete(
            f"{BASE_URL}/api/staging/case/{case_id}/file/nonexistent_file.pdf",
            headers={"Authorization": f"Bearer {self.auth_token}"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Delete non-existent file correctly returns 404")
    
    # ==================== GENERATE TRIPLE FUSION TESTS ====================
    
    def test_generate_triple_fusion_success(self):
        """Test generating triple fusion documents with pipeline."""
        # Create a new case with files
        form_data = {
            "police_station": "Makthal",
            "district": "Narayanpet",
            "fir_number": f"FUSION-{datetime.now().strftime('%H%M%S')}/2026",
            "sections": "118(2), 115(2), 352 BNS"
        }
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        create_response = requests.post(
            f"{BASE_URL}/api/staging/create-case",
            data=form_data,
            headers=headers
        )
        
        assert create_response.status_code == 200
        case_id = create_response.json()["case_id"]
        
        # Upload a test document with FIR-like content
        fir_content = """
        FIRST INFORMATION REPORT
        FIR No: 57/2026
        Police Station: Makthal
        District: Narayanpet
        
        Complainant: Sri. Ramesh Kumar S/o Venkatesh, Age: 35 years, Caste: OC, 
        Occ: Farmer, R/o Village Makthal, Ph. 9876543210
        
        Accused: 
        A1. Suresh Kumar S/o Unknown, Age: 30 years, R/o Village Makthal
        
        Brief Facts:
        On 01.03.2026 at about 10:00 AM, the accused attacked the complainant.
        
        Sections: 118(2), 115(2) BNS
        """.encode('utf-8')
        
        files = [
            ("files", ("test_fir.docx", io.BytesIO(fir_content), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
        ]
        
        upload_response = requests.post(
            f"{BASE_URL}/api/staging/upload-files/{case_id}",
            files=files,
            headers=headers
        )
        
        assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
        
        # Generate triple fusion
        response = requests.post(
            f"{BASE_URL}/api/staging/generate-triple-fusion/{case_id}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify success
        assert data.get("success") == True, "Expected success=True"
        
        # Verify CCTNS JSON is returned
        assert "cctns_json" in data, "Expected cctns_json in response"
        cctns = data["cctns_json"]
        assert isinstance(cctns, dict), "cctns_json should be a dict"
        
        # Verify pipeline_stats are returned
        assert "pipeline_stats" in data, "Expected pipeline_stats in response"
        stats = data["pipeline_stats"]
        assert "files_classified" in stats, "Expected files_classified in pipeline_stats"
        assert "extraction_stats" in stats, "Expected extraction_stats in pipeline_stats"
        
        # Verify documents are returned
        assert "documents" in data, "Expected documents in response"
        docs = data["documents"]
        assert "charge_sheet" in docs, "Expected charge_sheet in documents"
        assert "case_diary" in docs, "Expected case_diary in documents"
        assert "remand_cd" in docs, "Expected remand_cd in documents"
        
        # Verify credits used
        assert "credits_used" in data, "Expected credits_used in response"
        assert data["credits_used"] > 0, "Expected credits to be deducted on success"
        
        print(f"Triple Fusion SUCCESS:")
        print(f"  - Case ID: {case_id}")
        print(f"  - Credits used: {data['credits_used']}")
        print(f"  - Documents processed: {data.get('documents_processed', 'N/A')}")
        print(f"  - Pipeline stats: {stats}")
        print(f"  - CCTNS JSON keys: {list(cctns.keys())}")
    
    def test_generate_triple_fusion_no_files(self):
        """Test generating fusion with no files - should fail."""
        # Create empty case
        form_data = {
            "police_station": "Test",
            "district": "Test",
            "fir_number": "EMPTY/2026"
        }
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        create_response = requests.post(
            f"{BASE_URL}/api/staging/create-case",
            data=form_data,
            headers=headers
        )
        
        assert create_response.status_code == 200
        case_id = create_response.json()["case_id"]
        
        # Try to generate without files
        response = requests.post(
            f"{BASE_URL}/api/staging/generate-triple-fusion/{case_id}",
            headers=headers
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("Generate fusion with no files correctly returns 400")
    
    def test_generate_triple_fusion_requires_auth(self):
        """Test that generate-triple-fusion requires authentication."""
        response = requests.post(
            f"{BASE_URL}/api/staging/generate-triple-fusion/FAKE-CASE"
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Generate fusion correctly requires authentication")
    
    # ==================== MY CASES TESTS ====================
    
    def test_list_my_cases(self):
        """Test listing all staging cases for current officer."""
        response = self.session.get(
            f"{BASE_URL}/api/staging/my-cases",
            headers={"Authorization": f"Bearer {self.auth_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "cases" in data, "Expected cases in response"
        assert "count" in data, "Expected count in response"
        assert data.get("credits_used") == 0, "Expected 0 credits"
        
        print(f"Officer has {data['count']} staging cases")


class TestPipelineValidation:
    """Test pipeline validation and CCTNS JSON structure."""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures."""
        self.session = requests.Session()
        
        # Get auth token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"officer_id": TEST_OFFICER_ID, "password": TEST_PASSWORD}
        )
        
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.auth_token = token
        else:
            pytest.skip("Authentication failed")
        
        yield
        self.session.close()
    
    def test_cctns_json_structure(self):
        """Test that CCTNS JSON has required fields."""
        # Create case and upload file
        form_data = {
            "police_station": "Makthal",
            "district": "Narayanpet",
            "fir_number": f"CCTNS-{datetime.now().strftime('%H%M%S')}/2026",
            "sections": "118(2) BNS"
        }
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        create_response = requests.post(
            f"{BASE_URL}/api/staging/create-case",
            data=form_data,
            headers=headers
        )
        
        case_id = create_response.json()["case_id"]
        
        # Upload test file
        fir_content = b"FIR No: 57/2026\nComplainant: Test Person\nAccused: Unknown Person"
        files = [("files", ("test.docx", io.BytesIO(fir_content), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))]
        
        requests.post(
            f"{BASE_URL}/api/staging/upload-files/{case_id}",
            files=files,
            headers=headers
        )
        
        # Generate fusion
        response = requests.post(
            f"{BASE_URL}/api/staging/generate-triple-fusion/{case_id}",
            headers=headers
        )
        
        if response.status_code != 200:
            pytest.skip(f"Fusion generation failed: {response.text}")
        
        data = response.json()
        cctns = data.get("cctns_json", {})
        
        # Check required CCTNS fields
        expected_fields = [
            "fir_number", "police_station", "district", "sections",
            "complainant_name", "accused_count", "witness_count"
        ]
        
        for field in expected_fields:
            assert field in cctns, f"Expected {field} in CCTNS JSON"
        
        print(f"CCTNS JSON structure validated: {list(cctns.keys())}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
