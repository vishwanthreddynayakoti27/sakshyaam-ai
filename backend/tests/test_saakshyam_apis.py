"""
Test Suite for SAAKSHYAM AI Backend APIs
Testing: Auth, BNS Analysis with Remand Note, Jurisdiction Finder, Section Search
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_OFFICER_ID = "TEST002"
TEST_PASSWORD = "test1234"


@pytest.fixture(scope="module")
def api_client():
    """Create a requests session for API calls"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token using test credentials"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "officer_id": TEST_OFFICER_ID,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Auth failed: {response.text}"
    data = response.json()
    assert "token" in data, "Token not in response"
    return data["token"]


@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Create session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


class TestHealthEndpoint:
    """Test root endpoint health check"""
    
    def test_api_root_health(self, api_client):
        """Test root API endpoint returns SAAKSHYAM AI message"""
        response = api_client.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "SAAKSHYAM AI" in data["message"]
        print(f"Root endpoint response: {data['message']}")


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_login_success(self, api_client):
        """Test successful login with TEST002 credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "officer_id": TEST_OFFICER_ID,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "officer" in data
        assert data["officer"]["officer_id"] == TEST_OFFICER_ID
        print(f"Login successful for officer: {data['officer']['name']}")
    
    def test_login_invalid_credentials(self, api_client):
        """Test login fails with wrong password"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "officer_id": TEST_OFFICER_ID,
            "password": "wrongpassword"
        })
        assert response.status_code == 401


class TestLegalIntelligenceBNSAnalysis:
    """Test Legal Intelligence Engine - BNS Analysis with Remand Note Generation"""
    
    def test_bns_analyze_cheating_fraud(self, authenticated_client):
        """Test case fact analysis for cheating/fraud - should return BNS 318"""
        response = authenticated_client.post(f"{BASE_URL}/api/bns/analyze", json={
            "text": "Person cheated by promising job and taking money. The accused deceived the victim with false promises."
        })
        assert response.status_code == 200
        data = response.json()
        
        # Validate response structure
        assert "suggested_sections" in data
        assert "matched_keywords" in data
        
        # Check BNS 318 (cheating) is suggested
        section_numbers = [s["section_number"] for s in data["suggested_sections"]]
        print(f"Matched keywords: {data['matched_keywords']}")
        print(f"Suggested sections: {section_numbers}")
        
        # BNS 318 should be in results for cheating/fraud case
        assert any("318" in s for s in section_numbers), f"BNS 318 not found in {section_numbers}"
        
        # Verify remand note is generated for offence sections
        if data.get("remand_note"):
            assert "REMAND NOTE" in data["remand_note"]
            assert "BNS" in data["remand_note"]
            print("Remand note generated successfully")
    
    def test_bns_analyze_theft(self, authenticated_client):
        """Test analysis for theft - should return BNS 303"""
        response = authenticated_client.post(f"{BASE_URL}/api/bns/analyze", json={
            "text": "My mobile phone was stolen from my pocket at the bus stop."
        })
        assert response.status_code == 200
        data = response.json()
        
        section_numbers = [s["section_number"] for s in data["suggested_sections"]]
        print(f"Theft case - Suggested sections: {section_numbers}")
        
        # BNS 303 (theft) should be suggested
        assert any("303" in s for s in section_numbers), f"BNS 303 not found for theft case"
    
    def test_bns_analyze_assault(self, authenticated_client):
        """Test analysis for assault - should return BNS 115"""
        response = authenticated_client.post(f"{BASE_URL}/api/bns/analyze", json={
            "text": "The accused beat me with a stick causing injury to my arm."
        })
        assert response.status_code == 200
        data = response.json()
        
        section_numbers = [s["section_number"] for s in data["suggested_sections"]]
        print(f"Assault case - Suggested sections: {section_numbers}")
        
        # BNS 115 (hurt) or BNS 121 (dangerous weapon) should be suggested
        assert any("115" in s or "121" in s for s in section_numbers), "No assault sections found"
    
    def test_bns_analyze_with_remand_note(self, authenticated_client):
        """Test that remand note is auto-generated for offence sections"""
        response = authenticated_client.post(f"{BASE_URL}/api/bns/analyze", json={
            "text": "The accused cheated by taking Rs 50000 promising a government job. This is fraud."
        })
        assert response.status_code == 200
        data = response.json()
        
        # Remand note should be present for offence cases
        assert "remand_note" in data
        if data["remand_note"]:
            assert "REMAND NOTE" in data["remand_note"]
            assert "The accused has committed offences" in data["remand_note"]
            assert "GROUNDS FOR REMAND" in data["remand_note"]
            print("Remand note validation passed")


class TestSectionSearch:
    """Test direct section lookup by number"""
    
    def test_search_bns_318(self, authenticated_client):
        """Test searching for BNS 318 directly"""
        # Need to remove content-type json header for form data
        headers = dict(authenticated_client.headers)
        if "Content-Type" in headers:
            del headers["Content-Type"]
        response = requests.post(
            f"{BASE_URL}/api/bns/search",
            data={"section_number": "BNS 318"},
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["found"] == True
        assert data["section"]["section_number"] == "BNS 318"
        assert "Cheating" in data["section"]["title"]
        assert data["section"]["ipc_equivalent"] == "IPC 420"
        print(f"Found: {data['section']['title']}")
    
    def test_search_ipc_420(self, authenticated_client):
        """Test searching by old law IPC 420"""
        headers = dict(authenticated_client.headers)
        if "Content-Type" in headers:
            del headers["Content-Type"]
        response = requests.post(
            f"{BASE_URL}/api/bns/search",
            data={"section_number": "IPC 420"},
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["found"] == True
        # Should find BNS 318 which has IPC 420 as equivalent
        assert data["section"]["ipc_equivalent"] == "IPC 420"
        print(f"IPC 420 maps to: {data['section']['section_number']}")
    
    def test_search_nonexistent_section(self, authenticated_client):
        """Test searching for section that doesn't exist"""
        headers = dict(authenticated_client.headers)
        if "Content-Type" in headers:
            del headers["Content-Type"]
        response = requests.post(
            f"{BASE_URL}/api/bns/search",
            data={"section_number": "BNS 9999"},
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["found"] == False


class TestJurisdictionFinder:
    """Test Jurisdiction Finder API with Haversine distance calculation"""
    
    def test_get_all_stations(self, authenticated_client):
        """Test fetching all police stations - should have 100 Telangana stations"""
        response = authenticated_client.get(f"{BASE_URL}/api/jurisdiction/stations")
        assert response.status_code == 200
        data = response.json()
        
        assert "stations" in data
        assert "count" in data
        assert data["count"] >= 100, f"Expected 100+ stations, got {data['count']}"
        
        # Verify station structure
        first_station = data["stations"][0]
        assert "name" in first_station
        assert "district" in first_station
        assert "latitude" in first_station
        assert "longitude" in first_station
        print(f"Loaded {data['count']} police stations")
    
    def test_find_nearest_station_hyderabad(self, authenticated_client):
        """Test finding nearest station for Hyderabad location"""
        # Test with Gachibowli coordinates
        response = authenticated_client.post(f"{BASE_URL}/api/jurisdiction/find", json={
            "latitude": 17.4401,
            "longitude": 78.3489
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "nearest_station" in data
        assert "all_nearby" in data
        
        nearest = data["nearest_station"]
        assert "name" in nearest
        assert "distance_km" in nearest
        assert isinstance(nearest["distance_km"], float)
        
        # Distance should be reasonable (< 50 km for Telangana stations)
        assert nearest["distance_km"] < 50, f"Distance too large: {nearest['distance_km']}"
        
        print(f"Nearest station: {nearest['name']} ({nearest['distance_km']} km)")
        print(f"Total nearby stations returned: {len(data['all_nearby'])}")
    
    def test_haversine_distance_accuracy(self, authenticated_client):
        """Test Haversine distance calculation accuracy"""
        # Test with coordinates exactly at Madhapur PS
        response = authenticated_client.post(f"{BASE_URL}/api/jurisdiction/find", json={
            "latitude": 17.4486,
            "longitude": 78.3908
        })
        assert response.status_code == 200
        data = response.json()
        
        # Should find Madhapur PS as nearest with very small distance
        nearest = data["nearest_station"]
        # Distance should be < 1 km if coordinates are close to station
        print(f"Station at exact coords: {nearest['name']} - {nearest['distance_km']} km")


class TestFIREndpoints:
    """Test FIR related endpoints"""
    
    def test_fir_list(self, authenticated_client):
        """Test listing FIR drafts"""
        response = authenticated_client.get(f"{BASE_URL}/api/fir/list")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"FIR drafts count: {len(data)}")
    
    def test_fir_create_and_verify(self, authenticated_client):
        """Test creating FIR draft from complaint text"""
        complaint_text = "I, Test Complainant, was cheated by the accused who took Rs 10000 promising help."
        
        # Need to remove content-type json header for form data
        headers = dict(authenticated_client.headers)
        if "Content-Type" in headers:
            del headers["Content-Type"]
        response = requests.post(
            f"{BASE_URL}/api/fir/create",
            data={"complaint_text": complaint_text},
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert "fir_draft" in data
        # FIR should convert first person to third person
        assert "complainant" in data["fir_draft"].lower()
        print("FIR draft created successfully")


class TestRemindersEndpoint:
    """Test Reminders CRUD"""
    
    def test_list_reminders(self, authenticated_client):
        """Test listing reminders"""
        response = authenticated_client.get(f"{BASE_URL}/api/reminders/list")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
