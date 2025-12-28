#!/usr/bin/env python3
"""
Backend API Testing for Hot Tub Calculator with Category Management System
Tests all backend endpoints for the new category management functionality
"""

import requests
import json
import uuid
from datetime import datetime

# Get backend URL from frontend .env
BACKEND_URL = "https://balia-kalkulator.preview.emergentagent.com/api"

def test_get_prices():
    """Test GET /api/prices endpoint"""
    print("🔍 Testing GET /api/prices...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/prices")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ GET /api/prices successful")
            
            # Check required fields for category management
            required_fields = ['categories', 'displayTypes', 'optionLabels', 'optionCategories']
            missing_fields = []
            
            for field in required_fields:
                if field not in data:
                    missing_fields.append(field)
                else:
                    print(f"✅ Field '{field}' present")
            
            if missing_fields:
                print(f"❌ Missing required fields: {missing_fields}")
                return False
            
            # Check categories structure
            categories = data.get('categories', {})
            print(f"📊 Found {len(categories)} categories:")
            
            expected_categories = ['shellModels', 'woodTypes', 'shellColors', 'lidTypes', 'woodColors', 'features']
            for cat_id in expected_categories:
                if cat_id in categories:
                    cat = categories[cat_id]
                    print(f"  ✅ {cat_id}: {cat.get('name', 'No name')} (order: {cat.get('order', 'No order')}, type: {cat.get('displayType', 'No type')})")
                else:
                    print(f"  ❌ Missing category: {cat_id}")
            
            # Check optionCategories mapping
            option_categories = data.get('optionCategories', {})
            print(f"🔗 Found {len(option_categories)} option-category mappings")
            
            return True
        else:
            print(f"❌ GET /api/prices failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ GET /api/prices error: {str(e)}")
        return False

def test_post_prices():
    """Test POST /api/prices endpoint with category management data"""
    print("\n🔍 Testing POST /api/prices...")
    
    try:
        # First get current prices
        get_response = requests.get(f"{BACKEND_URL}/prices")
        if get_response.status_code != 200:
            print("❌ Could not get current prices for testing")
            return False
        
        current_data = get_response.json()
        
        # Create test data with new custom category
        test_data = current_data.copy()
        
        # Add a new custom category
        test_category_id = "test_extras"
        test_data['categories'][test_category_id] = {
            "name": "Тестовые дополнения",
            "displayType": "checkbox",
            "required": False,
            "order": 7
        }
        
        # Add a new option to the custom category
        test_option_key = "test_premium_pump"
        test_data['optionLabels'][test_option_key] = "Премиум насос"
        test_data['optionCategories'][test_option_key] = test_category_id
        test_data['displayTypes'][test_option_key] = "checkbox"
        
        # Add price for the new option (create features dict if not exists)
        if 'features' not in test_data:
            test_data['features'] = {}
        test_data['features'][test_option_key] = 750.0
        
        # Send POST request
        response = requests.post(f"{BACKEND_URL}/prices", json=test_data)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ POST /api/prices successful")
            
            # Verify the data was saved by getting it again
            verify_response = requests.get(f"{BACKEND_URL}/prices")
            if verify_response.status_code == 200:
                saved_data = verify_response.json()
                
                # Check if our test category was saved
                if test_category_id in saved_data.get('categories', {}):
                    print(f"✅ Custom category '{test_category_id}' saved successfully")
                else:
                    print(f"❌ Custom category '{test_category_id}' not found after save")
                    return False
                
                # Check if our test option was saved
                if test_option_key in saved_data.get('optionCategories', {}):
                    print(f"✅ Custom option '{test_option_key}' saved successfully")
                else:
                    print(f"❌ Custom option '{test_option_key}' not found after save")
                    return False
                
                return True
            else:
                print("❌ Could not verify saved data")
                return False
        else:
            print(f"❌ POST /api/prices failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ POST /api/prices error: {str(e)}")
        return False

def test_post_orders():
    """Test POST /api/orders endpoint with new category structure"""
    print("\n🔍 Testing POST /api/orders...")
    
    try:
        # Create test order with realistic data
        test_order = {
            "id": str(uuid.uuid4()),
            "fullName": "Анна Петрова",
            "phoneNumber": "+48123456789",
            "fullAddress": "Варшава, ул. Новая, дом 15, кв. 3",
            "orderDate": "2024-01-15",
            "shellModel": "round200",
            "woodType": "thermo",
            "shellColor": "blue",
            "lidType": "spaLid",
            "woodColor": "natural",
            "sandFilter": "none",
            "features": {
                "jacuzzi": True,
                "airBubble": True,
                "insulation": False,
                "headPillow": True
            },
            "notes": "Доставка в выходные дни предпочтительна",
            "total": 2650.0,
            "createdAt": datetime.now().isoformat()
        }
        
        response = requests.post(f"{BACKEND_URL}/orders", json=test_order)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            saved_order = response.json()
            print("✅ POST /api/orders successful")
            print(f"✅ Order ID: {saved_order.get('id')}")
            print(f"✅ Customer: {saved_order.get('fullName')}")
            print(f"✅ Total: {saved_order.get('total')}€")
            return True
        else:
            print(f"❌ POST /api/orders failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ POST /api/orders error: {str(e)}")
        return False

def test_get_orders():
    """Test GET /api/orders endpoint"""
    print("\n🔍 Testing GET /api/orders...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/orders")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            orders = response.json()
            print(f"✅ GET /api/orders successful")
            print(f"✅ Found {len(orders)} orders")
            
            if orders:
                # Check structure of first order
                first_order = orders[0]
                required_fields = ['id', 'fullName', 'phoneNumber', 'total']
                for field in required_fields:
                    if field in first_order:
                        print(f"✅ Order field '{field}' present")
                    else:
                        print(f"❌ Order field '{field}' missing")
            
            return True
        else:
            print(f"❌ GET /api/orders failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ GET /api/orders error: {str(e)}")
        return False

def test_generate_pdf():
    """Test POST /api/generate-pdf endpoint"""
    print("\n🔍 Testing POST /api/generate-pdf...")
    
    try:
        # Create test PDF request with Cyrillic characters
        pdf_request = {
            "fullName": "Михаил Александрович Волков",
            "phoneNumber": "+48987654321",
            "fullAddress": "Краков, проспект Мира, дом 25, квартира 12",
            "orderDate": "2024-01-20",
            "shellModel": "square220x220",
            "woodType": "redCedric",
            "shellColor": "pearlBlue",
            "lidType": "glassFiberLid",
            "woodColor": "painted",
            "sandFilter": "none",
            "features": {
                "jacuzzi": True,
                "airBubble": True,
                "insulation": True,
                "outsideLed12": True,
                "headPillow": True
            },
            "notes": "Просьба доставить в первой половине дня. Звонить за час до приезда.",
            "total": 3450.0,
            "type": "customer"
        }
        
        response = requests.post(f"{BACKEND_URL}/generate-pdf", json=pdf_request)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ POST /api/generate-pdf successful")
            
            # Check content type
            content_type = response.headers.get('content-type', '')
            if 'application/pdf' in content_type:
                print("✅ Response is PDF format")
            else:
                print(f"❌ Unexpected content type: {content_type}")
                return False
            
            # Check content length
            content_length = len(response.content)
            if content_length > 1000:  # PDF should be at least 1KB
                print(f"✅ PDF size: {content_length} bytes")
            else:
                print(f"❌ PDF too small: {content_length} bytes")
                return False
            
            return True
        else:
            print(f"❌ POST /api/generate-pdf failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ POST /api/generate-pdf error: {str(e)}")
        return False

def test_category_order_functionality():
    """Test category ordering functionality"""
    print("\n🔍 Testing Category Order Functionality...")
    
    try:
        # Get current prices
        response = requests.get(f"{BACKEND_URL}/prices")
        if response.status_code != 200:
            print("❌ Could not get current prices")
            return False
        
        data = response.json()
        categories = data.get('categories', {})
        
        # Test reordering - move woodTypes to order 1
        test_data = data.copy()
        test_data['categories']['woodTypes']['order'] = 1
        test_data['categories']['shellModels']['order'] = 2
        
        # Save the reordered data
        save_response = requests.post(f"{BACKEND_URL}/prices", json=test_data)
        if save_response.status_code != 200:
            print("❌ Could not save reordered categories")
            return False
        
        # Verify the order was saved
        verify_response = requests.get(f"{BACKEND_URL}/prices")
        if verify_response.status_code == 200:
            saved_data = verify_response.json()
            wood_order = saved_data['categories']['woodTypes']['order']
            shell_order = saved_data['categories']['shellModels']['order']
            
            if wood_order == 1 and shell_order == 2:
                print("✅ Category reordering works correctly")
                return True
            else:
                print(f"❌ Category order not saved correctly: wood={wood_order}, shell={shell_order}")
                return False
        else:
            print("❌ Could not verify saved order")
            return False
            
    except Exception as e:
        print(f"❌ Category order test error: {str(e)}")
        return False

def run_all_tests():
    """Run all backend tests"""
    print("🚀 Starting Backend API Tests for Hot Tub Calculator Category Management System")
    print("=" * 80)
    
    test_results = {
        "GET /api/prices": test_get_prices(),
        "POST /api/prices": test_post_prices(),
        "POST /api/orders": test_post_orders(),
        "GET /api/orders": test_get_orders(),
        "POST /api/generate-pdf": test_generate_pdf(),
        "Category Order Functionality": test_category_order_functionality()
    }
    
    print("\n" + "=" * 80)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 80)
    
    passed = 0
    failed = 0
    
    for test_name, result in test_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print(f"\nTotal: {passed + failed} tests")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    
    if failed == 0:
        print("\n🎉 All backend tests passed!")
    else:
        print(f"\n⚠️  {failed} test(s) failed - see details above")
    
    return test_results

if __name__ == "__main__":
    run_all_tests()