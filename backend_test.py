#!/usr/bin/env python3

import requests
import sys
import json
import base64
from datetime import datetime
from pathlib import Path

class NYAYAPRAHARIAPITester:
    def __init__(self, base_url="https://legal-fusion-queue.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.current_officer_id = None
        
        # Test credentials from review request
        self.test_officer = {
            "officer_id": "TEST001",
            "name": "Inspector Test Kumar",
            "department": "Crime Branch", 
            "rank": "Inspector",
            "district": "Hyderabad",
            "email": "test.kumar@police.gov.in",
            "password": "TestPass123"
        }

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None, is_form_data=False):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        if is_form_data:
            headers.pop('Content-Type', None)  # Let requests set it for FormData

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files or is_form_data:
                    response = requests.post(url, data=data, files=files, headers={'Authorization': headers.get('Authorization', '')})
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                if response.headers.get('content-type', '').startswith('application/json'):
                    try:
                        return success, response.json()
                    except:
                        return success, {}
                else:
                    return success, {"message": "Non-JSON response"}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_api(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API", "GET", "", 200
        )
        return success

    def test_signup(self):
        """Test officer signup"""
        success, response = self.run_test(
            "Officer Signup",
            "POST", 
            "auth/signup",
            200,
            data=self.test_officer
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.current_officer_id = response['officer']['officer_id']
            print(f"✅ Signup successful, token received")
            return True
        return False

    def test_login(self):
        """Test officer login"""
        success, response = self.run_test(
            "Officer Login",
            "POST",
            "auth/login", 
            200,
            data={
                "officer_id": self.test_officer["officer_id"],
                "password": self.test_officer["password"]
            }
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.current_officer_id = response['officer']['officer_id']
            return True
        return False

    def test_get_profile(self):
        """Test get officer profile"""
        success, response = self.run_test(
            "Get Profile", "GET", "auth/profile", 200
        )
        return success and 'officer_id' in response

    def test_update_subscription(self):
        """Test subscription update"""
        success, response = self.run_test(
            "Update Subscription",
            "POST",
            "subscription/update",
            200,
            data={"plan": "premium"},
            is_form_data=True
        )
        return success

    def test_ocr_process(self):
        """Test OCR processing with sample image data"""
        # Create a small test image (1x1 pixel PNG)
        test_image_data = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
        
        files = {'file': ('test.png', test_image_data, 'image/png')}
        
        success, response = self.run_test(
            "OCR Process",
            "POST",
            "ocr/process",
            200,
            files=files
        )
        return success

    def test_fir_create(self):
        """Test FIR draft creation"""
        complaint = "I am Rajesh Kumar. Someone stole my bike from outside my house last night."
        
        success, response = self.run_test(
            "Create FIR Draft",
            "POST",
            "fir/create",
            200,
            data={"complaint_text": complaint},
            is_form_data=True
        )
        
        if success and 'id' in response:
            self.fir_id = response['id']
            return True
        return False

    def test_fir_list(self):
        """Test listing FIR drafts"""
        success, response = self.run_test(
            "List FIR Drafts", "GET", "fir/list", 200
        )
        return success and isinstance(response, list)

    def test_bns_analyze(self):
        """Test BNS analysis"""
        test_text = "The accused murdered the victim and stole his property"
        
        success, response = self.run_test(
            "BNS Analyze",
            "POST",
            "bns/analyze",
            200,
            data={"text": test_text}
        )
        return success and 'suggested_sections' in response

    def test_bns_search(self):
        """Test BNS section search"""
        success, response = self.run_test(
            "BNS Search",
            "POST", 
            "bns/search",
            200,
            data={"section_number": "103"},
            is_form_data=True
        )
        return success

    def test_reminders_create(self):
        """Test creating a reminder"""
        if not hasattr(self, 'fir_id'):
            print("⚠️ Skipping reminder test - no FIR ID available")
            return True
            
        reminder_data = {
            "fir_id": self.fir_id,
            "reminder_type": "court",
            "reminder_date": "2025-02-01T10:00:00",
            "note": "Court hearing scheduled"
        }
        
        success, response = self.run_test(
            "Create Reminder",
            "POST",
            "reminders/create", 
            200,
            data=reminder_data
        )
        return success

    def test_reminders_list(self):
        """Test listing reminders"""
        success, response = self.run_test(
            "List Reminders", "GET", "reminders/list", 200
        )
        return success and isinstance(response, list)

    def test_cdr_upload(self):
        """Test CDR file upload"""
        # Create sample CSV content
        csv_content = "PhoneNumber,Name,CallType,DateTime,Duration,IMEI,Location,CellTower\n9876543210,John Doe,Incoming,2025-01-01 10:00,120,123456789,Mumbai,Tower1"
        
        files = {'file': ('test_cdr.csv', csv_content.encode(), 'text/csv')}
        data = {'case_id': 'CASE001'}
        
        success, response = self.run_test(
            "CDR Upload",
            "POST",
            "cdr/upload",
            200,
            data=data,
            files=files
        )
        return success

def main():
    print("🚀 Starting NYAYA PRAHARI API Testing...\n")
    
    tester = NYAYAPRAHARIAPITester()
    
    # Core API Tests
    print("=" * 50)
    print("CORE API TESTS")
    print("=" * 50)
    
    if not tester.test_root_api():
        print("❌ Root API failed, stopping tests")
        return 1

    # Authentication Tests
    print("\n" + "=" * 50)
    print("AUTHENTICATION TESTS")  
    print("=" * 50)
    
    if not tester.test_signup():
        print("❌ Signup failed, trying login...")
        if not tester.test_login():
            print("❌ Both signup and login failed, stopping tests")
            return 1
    
    if not tester.test_get_profile():
        print("❌ Profile retrieval failed")
        return 1

    # Subscription Tests
    print("\n" + "=" * 50)
    print("SUBSCRIPTION TESTS")
    print("=" * 50)
    
    tester.test_update_subscription()

    # Language Intelligence Tests
    print("\n" + "=" * 50) 
    print("LANGUAGE INTELLIGENCE TESTS")
    print("=" * 50)
    
    tester.test_ocr_process()

    # FIR Assistant Tests
    print("\n" + "=" * 50)
    print("FIR ASSISTANT TESTS")
    print("=" * 50)
    
    tester.test_fir_create()
    tester.test_fir_list()

    # BNS Intelligence Tests  
    print("\n" + "=" * 50)
    print("BNS INTELLIGENCE TESTS")
    print("=" * 50)
    
    tester.test_bns_analyze()
    tester.test_bns_search()

    # Reminder Tests
    print("\n" + "=" * 50)
    print("REMINDER TESTS")
    print("=" * 50)
    
    tester.test_reminders_create()
    tester.test_reminders_list()

    # CDR Analyzer Tests
    print("\n" + "=" * 50)
    print("CDR ANALYZER TESTS") 
    print("=" * 50)
    
    tester.test_cdr_upload()

    # Final Results
    print("\n" + "=" * 50)
    print("TEST SUMMARY")
    print("=" * 50)
    
    print(f"📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
    success_rate = (tester.tests_passed / tester.tests_run) * 100
    print(f"📈 Success rate: {success_rate:.1f}%")
    
    if success_rate >= 80:
        print("🎉 Backend API tests: PASSED")
        return 0
    else:
        print("⚠️ Backend API tests: ISSUES FOUND")
        return 1

if __name__ == "__main__":
    sys.exit(main())