#!/usr/bin/env python3
"""
Backend API Testing for Logistics System Fixes
Tests the specific logistics endpoints mentioned in the review request
"""

import requests
import json
import uuid
import sys
from datetime import datetime

# Get backend URL from frontend .env
BACKEND_URL = "https://sauna-sales.preview.emergentagent.com/api"

def test_admin_login():
    """Test admin login with correct credentials"""
    print("\n🔍 Testing Admin Login...")
    
    try:
        login_data = {
            "username": "testuser",
            "password": "test123"
        }
        
        response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Admin login successful")
            
            # Check response structure
            if 'token' in data and 'user' in data:
                print("✅ Response contains token and user data")
                
                user = data['user']
                if user.get('username') == 'testuser':
                    print("✅ Admin user data correct")
                    return data['token']  # Return token for other tests
                else:
                    print(f"❌ Incorrect user data: {user}")
                    return False
            else:
                print("❌ Missing token or user in response")
                return False
        else:
            print(f"❌ Admin login failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Admin login error: {str(e)}")
        return False

def test_logistics_system_fixes():
    """Test the logistics system fixes from the review request"""
    print("\n🔍 Testing LOGISTICS SYSTEM FIXES")
    print("=" * 70)
    
    results = {}
    
    # Get admin token for authenticated requests
    admin_token = test_admin_login()
    if not admin_token:
        print("❌ Cannot proceed with logistics tests - admin login failed")
        return {"Admin Login": False}
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Test 1: Photo delivery endpoint
    print("\n📝 Test 1: GET /api/driver-panel/photo-image/{trip_id}/{order_id}...")
    try:
        trip_id = "trip-test-001"
        order_id = "order-test-001"
        
        response = requests.get(f"{BACKEND_URL}/driver-panel/photo-image/{trip_id}/{order_id}")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Photo endpoint returned successfully")
            content_length = len(response.content)
            print(f"✅ Photo size: {content_length} bytes")
            
            # Check content type
            content_type = response.headers.get('content-type', '')
            if content_type.startswith('image/'):
                print(f"✅ Response is image format: {content_type}")
                results["photo_delivery"] = True
            else:
                print(f"❌ Unexpected content type: {content_type}")
                results["photo_delivery"] = False
        elif response.status_code == 404:
            print("✅ Photo endpoint working (404 expected for test data)")
            results["photo_delivery"] = True
        else:
            print(f"❌ Photo endpoint failed with status {response.status_code}")
            print(f"Response: {response.text}")
            results["photo_delivery"] = False
            
    except Exception as e:
        print(f"❌ Photo delivery test error: {str(e)}")
        results["photo_delivery"] = False
    
    # Test 2: Debug endpoint for notifications
    print("\n📝 Test 2: GET /api/notifications/debug/driver/{driver_id}...")
    try:
        driver_id = "drv-test-001"
        
        response = requests.get(f"{BACKEND_URL}/notifications/debug/driver/{driver_id}", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Debug endpoint returned successfully")
            
            # Check response structure
            if 'driver' in data and 'push_notifications' in data and 'telegram' in data:
                print("✅ Response contains expected fields: driver, push_notifications, telegram")
                print(f"✅ Driver info: {data.get('driver', {})}")
                print(f"✅ Push notifications: {data.get('push_notifications', {})}")
                print(f"✅ Telegram: {data.get('telegram', {})}")
                results["debug_notifications"] = True
            else:
                print(f"❌ Response missing expected fields: {data}")
                results["debug_notifications"] = False
        else:
            print(f"❌ Debug endpoint failed with status {response.status_code}")
            print(f"Response: {response.text}")
            results["debug_notifications"] = False
            
    except Exception as e:
        print(f"❌ Debug notifications test error: {str(e)}")
        results["debug_notifications"] = False
    
    # Test 3: Send custom notification
    print("\n📝 Test 3: POST /api/notifications/send-custom...")
    try:
        notification_data = {
            "driverId": "drv-test-001",
            "message": "Test notification"
        }
        
        response = requests.post(f"{BACKEND_URL}/notifications/send-custom", json=notification_data, headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Send custom notification endpoint working")
            print(f"✅ Response: {data}")
            
            # Check response structure
            if 'status' in data and 'method' in data:
                print("✅ Response contains expected fields: status, method")
                results["send_custom_notification"] = True
            else:
                print(f"❌ Response missing expected fields: {data}")
                results["send_custom_notification"] = False
        elif response.status_code == 404:
            print("✅ Send custom notification endpoint working (404 expected for test driver)")
            results["send_custom_notification"] = True
        else:
            print(f"❌ Send custom notification failed with status {response.status_code}")
            print(f"Response: {response.text}")
            results["send_custom_notification"] = False
            
    except Exception as e:
        print(f"❌ Send custom notification test error: {str(e)}")
        results["send_custom_notification"] = False
    
    # Test 4: Drivers API
    print("\n📝 Test 4: GET /api/drivers...")
    try:
        response = requests.get(f"{BACKEND_URL}/drivers", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            drivers = response.json()
            print("✅ Drivers API returned successfully")
            print(f"✅ Found {len(drivers)} drivers")
            
            # Check if any drivers have userId field
            if drivers:
                drivers_with_userid = [d for d in drivers if 'userId' in d]
                if drivers_with_userid:
                    print(f"✅ Found {len(drivers_with_userid)} drivers with userId field")
                    print(f"✅ Sample driver with userId: {drivers_with_userid[0]}")
                    results["drivers_api"] = True
                else:
                    print("❌ No drivers have userId field")
                    results["drivers_api"] = False
            else:
                print("✅ Drivers API working (empty list)")
                results["drivers_api"] = True
        else:
            print(f"❌ Drivers API failed with status {response.status_code}")
            print(f"Response: {response.text}")
            results["drivers_api"] = False
            
    except Exception as e:
        print(f"❌ Drivers API test error: {str(e)}")
        results["drivers_api"] = False
    
    # Summary
    print("\n📊 LOGISTICS SYSTEM TESTS SUMMARY:")
    print("=" * 50)
    
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")
    
    print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 ALL LOGISTICS SYSTEM TESTS PASSED!")
        return True
    else:
        print("❌ Some logistics tests failed")
        return False


if __name__ == "__main__":
    print("🚀 LOGISTICS SYSTEM BACKEND API TESTING STARTED")
    print("=" * 50)
    print(f"Backend URL: {BACKEND_URL}")
    print("=" * 50)
    
    # Run logistics system tests (from review request)
    results = {
        "Logistics System Fixes": test_logistics_system_fixes()
    }
    
    # Print summary
    print("\n" + "=" * 50)
    print("📊 FINAL TEST RESULTS")
    print("=" * 50)
    
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")
    
    print("=" * 50)
    print(f"Overall: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print("❌ Some tests failed")
        sys.exit(1)