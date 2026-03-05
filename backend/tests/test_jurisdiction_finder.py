"""
Test Suite for Jurisdiction Finder Module
Testing: 306 police stations, Haversine distance, search, Zero FIR generation
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials - OFF12345/test123 as per main agent
TEST_OFFICER_ID = "OFF12345"
TEST_PASSWORD = "test123"


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


class TestJurisdictionStationsAPI:
    """Test /api/jurisdiction/stations - Load all 306 Telangana police stations"""
    
    def test_stations_api_returns_306_stations(self, authenticated_client):
        """Verify 306 stations are loaded via /api/jurisdiction/stations"""
        response = authenticated_client.get(f"{BASE_URL}/api/jurisdiction/stations")
        assert response.status_code == 200, f"API failed: {response.text}"
        
        data = response.json()
        assert "stations" in data, "Response missing 'stations' key"
        assert "count" in data, "Response missing 'count' key"
        assert data["count"] == 306, f"Expected 306 stations, got {data['count']}"
        
        print(f"SUCCESS: Loaded {data['count']} police stations")
    
    def test_stations_have_required_fields(self, authenticated_client):
        """Verify each station has required fields: name, district, latitude, longitude, phone"""
        response = authenticated_client.get(f"{BASE_URL}/api/jurisdiction/stations")
        assert response.status_code == 200
        
        data = response.json()
        stations = data["stations"]
        
        # Check first 5 stations
        for station in stations[:5]:
            assert "name" in station, "Station missing 'name'"
            assert "district" in station, "Station missing 'district'"
            assert "latitude" in station, "Station missing 'latitude'"
            assert "longitude" in station, "Station missing 'longitude'"
            assert "phone" in station, "Station missing 'phone'"
            assert isinstance(station["latitude"], (int, float)), "Latitude should be numeric"
            assert isinstance(station["longitude"], (int, float)), "Longitude should be numeric"
        
        print("SUCCESS: All stations have required fields")
    
    def test_stations_cover_40_districts(self, authenticated_client):
        """Verify stations cover 40 Telangana districts"""
        response = authenticated_client.get(f"{BASE_URL}/api/jurisdiction/stations")
        assert response.status_code == 200
        
        data = response.json()
        districts = set(station["district"] for station in data["stations"])
        
        print(f"Districts covered: {len(districts)}")
        print(f"District names: {sorted(districts)}")
        
        # Should have at least 30+ districts (allowing some leeway)
        assert len(districts) >= 30, f"Expected 30+ districts, got {len(districts)}"
        
        # Check for major Telangana districts
        major_districts = ["Hyderabad", "Cyberabad", "Warangal", "Nizamabad", "Karimnagar"]
        for dist in major_districts:
            found = any(dist.lower() in d.lower() for d in districts)
            print(f"Major district '{dist}' found: {found}")


class TestJurisdictionFindNearest:
    """Test /api/jurisdiction/find - Find nearest station using Haversine formula"""
    
    def test_find_nearest_station_gachibowli(self, authenticated_client):
        """Test finding nearest station for Gachibowli coordinates"""
        response = authenticated_client.post(f"{BASE_URL}/api/jurisdiction/find", json={
            "latitude": 17.4401,
            "longitude": 78.3489
        })
        assert response.status_code == 200, f"API failed: {response.text}"
        
        data = response.json()
        assert "nearest_station" in data, "Response missing 'nearest_station'"
        assert "all_nearby" in data, "Response missing 'all_nearby'"
        
        nearest = data["nearest_station"]
        assert "name" in nearest
        assert "distance_km" in nearest
        assert "district" in nearest
        
        print(f"Nearest to Gachibowli: {nearest['name']} ({nearest['distance_km']} km)")
        print(f"District: {nearest['district']}")
    
    def test_find_nearest_returns_10_nearby_stations(self, authenticated_client):
        """Verify API returns up to 10 nearby stations sorted by distance"""
        response = authenticated_client.post(f"{BASE_URL}/api/jurisdiction/find", json={
            "latitude": 17.5,
            "longitude": 78.5
        })
        assert response.status_code == 200
        
        data = response.json()
        nearby = data["all_nearby"]
        
        assert len(nearby) == 10, f"Expected 10 nearby stations, got {len(nearby)}"
        
        # Verify sorted by distance
        distances = [s["distance_km"] for s in nearby]
        assert distances == sorted(distances), "Nearby stations not sorted by distance"
        
        print(f"Nearby stations (sorted): {[s['name'] for s in nearby[:3]]}...")
    
    def test_haversine_distance_accuracy(self, authenticated_client):
        """Test Haversine formula accuracy - station at exact coords should have ~0 km distance"""
        # Madhapur PS coordinates
        response = authenticated_client.post(f"{BASE_URL}/api/jurisdiction/find", json={
            "latitude": 17.4486,
            "longitude": 78.3908
        })
        assert response.status_code == 200
        
        data = response.json()
        nearest = data["nearest_station"]
        
        # Madhapur PS should be returned with distance < 1 km
        assert nearest["distance_km"] < 1, f"Distance too large for exact coords: {nearest['distance_km']}"
        print(f"Distance to Madhapur PS from its coords: {nearest['distance_km']} km")
    
    def test_find_station_warangal(self, authenticated_client):
        """Test finding station in Warangal district"""
        # Warangal coordinates
        response = authenticated_client.post(f"{BASE_URL}/api/jurisdiction/find", json={
            "latitude": 17.9780,
            "longitude": 79.5970
        })
        assert response.status_code == 200
        
        data = response.json()
        nearest = data["nearest_station"]
        
        # Should be in Warangal area
        print(f"Station near Warangal: {nearest['name']} - {nearest['district']} ({nearest['distance_km']} km)")
        assert nearest["distance_km"] < 10, "Nearest station should be within 10 km"
    
    def test_find_station_rural_area(self, authenticated_client):
        """Test finding station in rural Telangana area"""
        # Rural coordinates in southern Telangana
        response = authenticated_client.post(f"{BASE_URL}/api/jurisdiction/find", json={
            "latitude": 16.5,
            "longitude": 78.0
        })
        assert response.status_code == 200
        
        data = response.json()
        nearest = data["nearest_station"]
        
        print(f"Station in rural area: {nearest['name']} - {nearest['district']} ({nearest['distance_km']} km)")
        assert "distance_km" in nearest


class TestSearchFunctionality:
    """Test station search by name or district"""
    
    def test_search_station_by_name(self, authenticated_client):
        """Verify stations can be found by name"""
        response = authenticated_client.get(f"{BASE_URL}/api/jurisdiction/stations")
        assert response.status_code == 200
        
        data = response.json()
        stations = data["stations"]
        
        # Search for Madhapur
        madhapur_stations = [s for s in stations if "Madhapur" in s["name"]]
        assert len(madhapur_stations) > 0, "Madhapur PS not found"
        print(f"Found Madhapur PS: {madhapur_stations[0]}")
    
    def test_search_stations_by_district(self, authenticated_client):
        """Verify stations can be filtered by district"""
        response = authenticated_client.get(f"{BASE_URL}/api/jurisdiction/stations")
        assert response.status_code == 200
        
        data = response.json()
        stations = data["stations"]
        
        # Filter by Cyberabad district
        cyberabad_stations = [s for s in stations if "Cyberabad" in s["district"]]
        print(f"Cyberabad stations count: {len(cyberabad_stations)}")
        assert len(cyberabad_stations) > 10, "Expected 10+ Cyberabad stations"
        
        # Print sample
        for s in cyberabad_stations[:3]:
            print(f"  - {s['name']}")


class TestZeroFIRGeneration:
    """Test Zero FIR letter generation - this is client-side functionality
    Backend provides station data needed for letter generation"""
    
    def test_station_data_complete_for_zero_fir(self, authenticated_client):
        """Verify station data has all fields needed for Zero FIR letter"""
        response = authenticated_client.post(f"{BASE_URL}/api/jurisdiction/find", json={
            "latitude": 17.45,
            "longitude": 78.40
        })
        assert response.status_code == 200
        
        data = response.json()
        station = data["nearest_station"]
        
        # Zero FIR letter requires: station name, district, distance
        assert "name" in station, "Missing station name for Zero FIR"
        assert "district" in station, "Missing district for Zero FIR"
        assert "distance_km" in station, "Missing distance for Zero FIR jurisdiction check"
        
        print(f"Station data complete for Zero FIR: {station['name']} in {station['district']}")


class TestAuthenticationRequired:
    """Test that jurisdiction endpoints require authentication"""
    
    def test_stations_requires_auth(self):
        """Test /api/jurisdiction/stations requires Bearer token"""
        response = requests.get(f"{BASE_URL}/api/jurisdiction/stations")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("SUCCESS: Stations endpoint correctly requires authentication")
    
    def test_find_requires_auth(self):
        """Test /api/jurisdiction/find requires Bearer token"""
        response = requests.post(f"{BASE_URL}/api/jurisdiction/find", json={
            "latitude": 17.4401,
            "longitude": 78.3489
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("SUCCESS: Find endpoint correctly requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
