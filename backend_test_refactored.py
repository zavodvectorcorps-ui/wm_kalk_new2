#!/usr/bin/env python3
"""
Backend API Testing for Refactored WM Calculator
Tests all backend endpoints after modular refactoring
"""

import requests
import json
import uuid
from datetime import datetime

# Get backend URL from frontend .env
BACKEND_URL = "https://room-designer-25.preview.emergentagent.com/api"

def test_health_check():
    """Test GET /api/health endpoint"""
    print("🔍 Testing GET /api/health...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/health")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ GET /api/health successful")
            print(f"✅ Status: {data.get('status')}")
            print(f"✅ Service: {data.get('service')}")
            return True
        else:
            print(f"❌ GET /api/health failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ GET /api/health error: {str(e)}")
        return False

def test_auth_login():
    """Test POST /api/auth/login with admin credentials"""
    print("\n🔍 Testing POST /api/auth/login...")
    
    try:
        login_data = {
            "username": "admin",
            "password": "159357"
        }
        
        response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ POST /api/auth/login successful")
            
            if 'token' in data and 'user' in data:
                print("✅ Response contains token and user data")
                user = data['user']
                if user.get('role') == 'admin' and user.get('username') == 'admin':
                    print("✅ Admin user data correct")
                    return data['token']  # Return token for other tests
                else:
                    print(f"❌ Incorrect user data: {user}")
                    return False
            else:
                print("❌ Missing token or user in response")
                return False
        else:
            print(f"❌ POST /api/auth/login failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ POST /api/auth/login error: {str(e)}")
        return False

def test_auth_me(token):
    """Test GET /api/auth/me with valid token"""
    print("\n🔍 Testing GET /api/auth/me...")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BACKEND_URL}/auth/me", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            user = response.json()
            print("✅ GET /api/auth/me successful")
            print(f"✅ User: {user.get('username')} ({user.get('role')})")
            return True
        else:
            print(f"❌ GET /api/auth/me failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ GET /api/auth/me error: {str(e)}")
        return False

def test_auth_verify(token):
    """Test POST /api/auth/verify with valid token"""
    print("\n🔍 Testing POST /api/auth/verify...")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.post(f"{BACKEND_URL}/auth/verify", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('valid') == True:
                print("✅ POST /api/auth/verify successful")
                return True
            else:
                print("❌ Token marked as invalid")
                return False
        else:
            print(f"❌ POST /api/auth/verify failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ POST /api/auth/verify error: {str(e)}")
        return False

def test_balia_prices():
    """Test GET /api/prices endpoint"""
    print("\n🔍 Testing GET /api/prices...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/prices")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ GET /api/prices successful")
            
            # Check required fields
            required_fields = ['categories', 'displayTypes', 'optionLabels', 'optionCategories']
            for field in required_fields:
                if field in data:
                    print(f"✅ Field '{field}' present")
                else:
                    print(f"❌ Missing required field: {field}")
                    return False
            
            categories = data.get('categories', {})
            print(f"📊 Found {len(categories)} categories")
            return True
        else:
            print(f"❌ GET /api/prices failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ GET /api/prices error: {str(e)}")
        return False

def test_balia_orders():
    """Test GET /api/orders endpoint"""
    print("\n🔍 Testing GET /api/orders...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/orders")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            orders = response.json()
            print(f"✅ GET /api/orders successful")
            print(f"✅ Found {len(orders)} orders")
            return True
        else:
            print(f"❌ GET /api/orders failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ GET /api/orders error: {str(e)}")
        return False

def test_sauna_prices():
    """Test GET /api/sauna/prices endpoint"""
    print("\n🔍 Testing GET /api/sauna/prices...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/sauna/prices")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ GET /api/sauna/prices successful")
            
            # Check models and categories
            models = data.get('models', [])
            categories = data.get('categories', [])
            print(f"📊 Found {len(models)} sauna models")
            print(f"📊 Found {len(categories)} sauna categories")
            
            if models and categories:
                print("✅ Sauna data structure correct")
                return True
            else:
                print("❌ Missing models or categories")
                return False
        else:
            print(f"❌ GET /api/sauna/prices failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ GET /api/sauna/prices error: {str(e)}")
        return False

def test_sauna_orders():
    """Test GET /api/sauna/orders endpoint"""
    print("\n🔍 Testing GET /api/sauna/orders...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/sauna/orders")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            orders = response.json()
            print(f"✅ GET /api/sauna/orders successful")
            print(f"✅ Found {len(orders)} sauna orders")
            return True
        else:
            print(f"❌ GET /api/sauna/orders failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ GET /api/sauna/orders error: {str(e)}")
        return False

def test_sauna_generate_pdf():
    """Test POST /api/sauna/generate-pdf endpoint with sample data"""
    print("\n🔍 Testing POST /api/sauna/generate-pdf...")
    
    try:
        # Sample data as specified in review request
        pdf_request = {
            "fullName": "Test User",
            "phoneNumber": "+48123456789",
            "orderDate": "2025-01-01",
            "selectedModel": "test_model",
            "modelName": "Test Model",
            "basePrice": 10000,
            "selections": {},
            "categories": [],
            "total": 10000
        }
        
        response = requests.post(f"{BACKEND_URL}/sauna/generate-pdf", json=pdf_request)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ POST /api/sauna/generate-pdf successful")
            
            # Check content type
            content_type = response.headers.get('content-type', '')
            if 'application/pdf' in content_type:
                print("✅ Response is PDF format")
                
                # Check content length
                content_length = len(response.content)
                if content_length > 1000:  # PDF should be at least 1KB
                    print(f"✅ PDF size: {content_length} bytes")
                    return True
                else:
                    print(f"❌ PDF too small: {content_length} bytes")
                    return False
            else:
                print(f"❌ Unexpected content type: {content_type}")
                return False
        else:
            print(f"❌ POST /api/sauna/generate-pdf failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ POST /api/sauna/generate-pdf error: {str(e)}")
        return False

def test_users_admin(token):
    """Test GET /api/users with admin token"""
    print("\n🔍 Testing GET /api/users (Admin)...")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BACKEND_URL}/users", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            users = response.json()
            print(f"✅ GET /api/users successful - found {len(users)} users")
            
            # Check if admin is in the list
            usernames = [user.get('username') for user in users]
            if 'admin' in usernames:
                print("✅ Admin user found in list")
            else:
                print("❌ Admin user not found in list")
                
            return True
        else:
            print(f"❌ GET /api/users failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ GET /api/users error: {str(e)}")
        return False

def run_refactored_backend_tests():
    """Run all backend tests for refactored architecture"""
    print("🚀 Starting Backend API Tests for Refactored WM Calculator")
    print("=" * 80)
    
    test_results = {}
    
    # Test 1: Health Check
    test_results["Health Check"] = test_health_check()
    
    # Test 2: Authentication Flow
    print("\n" + "=" * 50)
    print("🔐 AUTHENTICATION TESTS")
    print("=" * 50)
    
    admin_token = test_auth_login()
    if admin_token:
        test_results["Auth Login"] = True
        test_results["Auth Me"] = test_auth_me(admin_token)
        test_results["Auth Verify"] = test_auth_verify(admin_token)
    else:
        test_results["Auth Login"] = False
        test_results["Auth Me"] = False
        test_results["Auth Verify"] = False
    
    # Test 3: Balia Calculator APIs
    print("\n" + "=" * 50)
    print("🛁 BALIA CALCULATOR TESTS")
    print("=" * 50)
    
    test_results["Balia Prices"] = test_balia_prices()
    test_results["Balia Orders"] = test_balia_orders()
    
    # Test 4: Sauna Calculator APIs
    print("\n" + "=" * 50)
    print("🌿 SAUNA CALCULATOR TESTS")
    print("=" * 50)
    
    test_results["Sauna Prices"] = test_sauna_prices()
    test_results["Sauna Orders"] = test_sauna_orders()
    test_results["Sauna Generate PDF"] = test_sauna_generate_pdf()
    
    # Test 5: Users Management (Admin)
    print("\n" + "=" * 50)
    print("👥 USERS MANAGEMENT TESTS")
    print("=" * 50)
    
    if admin_token:
        test_results["Users Admin"] = test_users_admin(admin_token)
    else:
        test_results["Users Admin"] = False
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 80)
    
    passed = 0
    failed = 0
    
    for test_name, result in test_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {test_name}: {status}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print(f"\nTotal: {passed + failed} tests")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    
    if failed == 0:
        print("\n🎉 All backend tests passed!")
        print("✅ Backend refactoring successful - all APIs working correctly")
    else:
        print(f"\n⚠️  {failed} test(s) failed - see details above")
        print("❌ Some APIs may need attention after refactoring")
    
    return test_results

if __name__ == "__main__":
    run_refactored_backend_tests()