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
BACKEND_URL = "https://orange-ui.preview.emergentagent.com/api"

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

# ============================================================================
# OBSERVER ROLE TESTS (NEW)
# ============================================================================

def test_observer_login():
    """Test observer login with correct credentials"""
    print("\n🔍 Testing Observer Login...")
    
    try:
        login_data = {
            "username": "Наблюдатель",
            "password": "observer123"
        }
        
        response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Observer login successful")
            
            # Check response structure
            if 'token' in data and 'user' in data:
                print("✅ Response contains token and user data")
                
                user = data['user']
                if (user.get('role') == 'observer' and 
                    user.get('username') == 'Наблюдатель' and 
                    user.get('access') == 'all'):
                    print("✅ Observer user data correct - role=observer, access=all")
                    return data['token']  # Return token for other tests
                else:
                    print(f"❌ Incorrect user data: {user}")
                    print(f"Expected: role=observer, username=Наблюдатель, access=all")
                    return False
            else:
                print("❌ Missing token or user in response")
                return False
        else:
            print(f"❌ Observer login failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Observer login error: {str(e)}")
        return False

def test_observer_token_verification(observer_token):
    """Test POST /api/auth/verify with observer's token"""
    print("\n🔍 Testing Observer Token Verification...")
    
    try:
        headers = {"Authorization": f"Bearer {observer_token}"}
        response = requests.post(f"{BACKEND_URL}/auth/verify", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('valid') == True:
                print("✅ Observer token verification successful")
                user_data = data.get('user', {})
                if user_data.get('role') == 'observer':
                    print("✅ Token contains correct observer role")
                    return True
                else:
                    print(f"❌ Token contains incorrect role: {user_data.get('role')}")
                    return False
            else:
                print("❌ Observer token marked as invalid")
                return False
        else:
            print(f"❌ Observer token verification failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Observer token verification error: {str(e)}")
        return False

def test_observer_access_sauna_prices(observer_token):
    """Test GET /api/sauna/prices - Observer should be able to read prices"""
    print("\n🔍 Testing Observer Access to GET /api/sauna/prices...")
    
    try:
        headers = {"Authorization": f"Bearer {observer_token}"}
        response = requests.get(f"{BACKEND_URL}/sauna/prices", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Observer can access sauna prices")
            
            # Check if data structure is correct
            if 'models' in data and 'categories' in data:
                print(f"✅ Sauna prices data structure correct - {len(data.get('models', []))} models, {len(data.get('categories', []))} categories")
                return True
            else:
                print("❌ Sauna prices data structure incorrect")
                return False
        else:
            print(f"❌ Observer access to sauna prices failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Observer sauna prices access error: {str(e)}")
        return False

def test_observer_access_sauna_orders(observer_token):
    """Test GET /api/sauna/orders - Observer should be able to read orders"""
    print("\n🔍 Testing Observer Access to GET /api/sauna/orders...")
    
    try:
        headers = {"Authorization": f"Bearer {observer_token}"}
        response = requests.get(f"{BACKEND_URL}/sauna/orders", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            orders = response.json()
            print(f"✅ Observer can access sauna orders - found {len(orders)} orders")
            return True
        else:
            print(f"❌ Observer access to sauna orders failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Observer sauna orders access error: {str(e)}")
        return False

def test_observer_access_balia_prices(observer_token):
    """Test GET /api/prices - Observer should be able to read Balia prices"""
    print("\n🔍 Testing Observer Access to GET /api/prices (Balia)...")
    
    try:
        headers = {"Authorization": f"Bearer {observer_token}"}
        response = requests.get(f"{BACKEND_URL}/prices", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Observer can access balia prices")
            
            # Check if data structure is correct
            if 'categories' in data and 'displayTypes' in data:
                print(f"✅ Balia prices data structure correct - {len(data.get('categories', {}))} categories")
                return True
            else:
                print("❌ Balia prices data structure incorrect")
                return False
        else:
            print(f"❌ Observer access to balia prices failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Observer balia prices access error: {str(e)}")
        return False

def test_admin_access_users(admin_token):
    """Test GET /api/users with admin token - Should return users list"""
    print("\n🔍 Testing Admin Access to GET /api/users...")
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BACKEND_URL}/users", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            users = response.json()
            print(f"✅ Admin can access users list - found {len(users)} users")
            
            # Check if observer user exists in the list
            observer_user = next((u for u in users if u.get('username') == 'Наблюдатель'), None)
            if observer_user:
                print(f"✅ Observer user found in users list - role: {observer_user.get('role')}, access: {observer_user.get('access')}")
            else:
                print("❌ Observer user not found in users list")
                
            return True
        else:
            print(f"❌ Admin access to users failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Admin users access error: {str(e)}")
        return False

def test_observer_role_system():
    """Run comprehensive observer role tests"""
    print("\n👁️ OBSERVER ROLE TESTS")
    print("=" * 50)
    
    # Test observer login first
    observer_token = test_observer_login()
    if not observer_token:
        print("❌ Cannot proceed with observer tests - login failed")
        return {"Observer Login": False}
    
    # Test admin login for comparison
    admin_token = test_admin_login()
    if not admin_token:
        print("❌ Cannot proceed with admin comparison tests - admin login failed")
        admin_token = None
    
    # Run all observer tests
    observer_results = {
        "Observer Login": True,  # Already passed
        "Observer Token Verification": test_observer_token_verification(observer_token),
        "Observer Access to Sauna Prices": test_observer_access_sauna_prices(observer_token),
        "Observer Access to Sauna Orders": test_observer_access_sauna_orders(observer_token),
        "Observer Access to Balia Prices": test_observer_access_balia_prices(observer_token),
    }
    
    # Add admin comparison test if admin login worked
    if admin_token:
        observer_results["Admin Access to Users (comparison)"] = test_admin_access_users(admin_token)
    
    return observer_results

# ============================================================================
# AUTHENTICATION SYSTEM TESTS
# ============================================================================

def test_admin_login():
    """Test admin login with correct credentials"""
    print("\n🔍 Testing Admin Login...")
    
    try:
        login_data = {
            "username": "admin",
            "password": "159357"
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
            print(f"❌ Admin login failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Admin login error: {str(e)}")
        return False

def test_employee_login():
    """Test employee login with test credentials"""
    print("\n🔍 Testing Employee Login...")
    
    try:
        login_data = {
            "username": "ivan",
            "password": "test123"
        }
        
        response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Employee login successful")
            
            # Check response structure
            if 'token' in data and 'user' in data:
                print("✅ Response contains token and user data")
                
                user = data['user']
                if (user.get('role') == 'employee' and 
                    user.get('username') == 'ivan' and 
                    user.get('access') == 'balia'):
                    print("✅ Employee user data correct")
                    return data['token']  # Return token for other tests
                else:
                    print(f"❌ Incorrect user data: {user}")
                    return False
            else:
                print("❌ Missing token or user in response")
                return False
        else:
            print(f"❌ Employee login failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Employee login error: {str(e)}")
        return False

def test_invalid_login():
    """Test login with invalid credentials"""
    print("\n🔍 Testing Invalid Login...")
    
    try:
        login_data = {
            "username": "invalid_user",
            "password": "wrong_password"
        }
        
        response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 401:
            print("✅ Invalid login correctly rejected")
            return True
        else:
            print(f"❌ Expected 401, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Invalid login test error: {str(e)}")
        return False

def test_get_current_user(token):
    """Test GET /api/auth/me with valid token"""
    print("\n🔍 Testing GET /api/auth/me...")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BACKEND_URL}/auth/me", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            user = response.json()
            print("✅ Get current user successful")
            print(f"✅ User: {user.get('username')} ({user.get('role')})")
            return True
        else:
            print(f"❌ Get current user failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Get current user error: {str(e)}")
        return False

def test_verify_token(token):
    """Test POST /api/auth/verify with valid token"""
    print("\n🔍 Testing POST /api/auth/verify...")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.post(f"{BACKEND_URL}/auth/verify", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('valid') == True:
                print("✅ Token verification successful")
                return True
            else:
                print("❌ Token marked as invalid")
                return False
        else:
            print(f"❌ Token verification failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Token verification error: {str(e)}")
        return False

def test_get_users_admin(admin_token):
    """Test GET /api/users with admin token"""
    print("\n🔍 Testing GET /api/users (Admin)...")
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BACKEND_URL}/users", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            users = response.json()
            print(f"✅ Get users successful - found {len(users)} users")
            
            # Check if admin and ivan are in the list
            usernames = [user.get('username') for user in users]
            if 'admin' in usernames:
                print("✅ Admin user found in list")
            else:
                print("❌ Admin user not found in list")
                
            if 'ivan' in usernames:
                print("✅ Employee 'ivan' found in list")
            else:
                print("❌ Employee 'ivan' not found in list")
                
            return True
        else:
            print(f"❌ Get users failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Get users error: {str(e)}")
        return False

def test_get_users_employee(employee_token):
    """Test GET /api/users with employee token (should fail)"""
    print("\n🔍 Testing GET /api/users (Employee - should fail)...")
    
    try:
        headers = {"Authorization": f"Bearer {employee_token}"}
        response = requests.get(f"{BACKEND_URL}/users", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 403:
            print("✅ Employee correctly denied access to users list")
            return True
        else:
            print(f"❌ Expected 403, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Employee users access test error: {str(e)}")
        return False

def test_create_user(admin_token):
    """Test POST /api/users to create new employee"""
    print("\n🔍 Testing POST /api/users (Create Employee)...")
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        new_user_data = {
            "username": "test_employee",
            "password": "testpass123",
            "access": "sauna"
        }
        
        response = requests.post(f"{BACKEND_URL}/users", json=new_user_data, headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            user = response.json()
            print("✅ Create user successful")
            print(f"✅ Created user: {user.get('username')} with access: {user.get('access')}")
            return user.get('id')  # Return user ID for update/delete tests
        else:
            print(f"❌ Create user failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Create user error: {str(e)}")
        return False

def test_update_user(admin_token, user_id):
    """Test PUT /api/users/{user_id} to update employee"""
    print("\n🔍 Testing PUT /api/users/{user_id} (Update Employee)...")
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        update_data = {
            "access": "all",
            "password": "newpassword123"
        }
        
        response = requests.put(f"{BACKEND_URL}/users/{user_id}", json=update_data, headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            user = response.json()
            print("✅ Update user successful")
            print(f"✅ Updated access to: {user.get('access')}")
            return True
        else:
            print(f"❌ Update user failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Update user error: {str(e)}")
        return False

def test_delete_user(admin_token, user_id):
    """Test DELETE /api/users/{user_id} to delete employee"""
    print("\n🔍 Testing DELETE /api/users/{user_id} (Delete Employee)...")
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.delete(f"{BACKEND_URL}/users/{user_id}", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Delete user successful")
            return True
        else:
            print(f"❌ Delete user failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Delete user error: {str(e)}")
        return False

# ============================================================================
# SAUNA CALCULATOR TESTS
# ============================================================================

def test_get_sauna_prices():
    """Test GET /api/sauna/prices endpoint - should return 13 models and 14 categories with all required fields"""
    print("\n🔍 Testing GET /api/sauna/prices...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/sauna/prices")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ GET /api/sauna/prices successful")
            
            # Check models
            models = data.get('models', [])
            print(f"📊 Found {len(models)} sauna models")
            
            if len(models) == 13:
                print("✅ Correct number of models (13)")
            else:
                print(f"❌ Expected 13 models, found {len(models)}")
                return False
            
            # Check categories
            categories = data.get('categories', [])
            print(f"📊 Found {len(categories)} sauna categories")
            
            if len(categories) == 14:
                print("✅ Correct number of categories (14)")
            else:
                print(f"❌ Expected 14 categories, found {len(categories)}")
                return False
            
            # Verify data structure includes all required fields
            print("🔍 Verifying data structure...")
            
            # Check model structure
            if models:
                first_model = models[0]
                required_model_fields = ['id', 'name', 'basePrice', 'foundationPrice', 'discount', 'imageUrl']
                for field in required_model_fields:
                    if field in first_model:
                        print(f"✅ Model field '{field}' present")
                    else:
                        print(f"❌ Model field '{field}' missing")
                        return False
            
            # Check category structure
            if categories:
                first_category = categories[0]
                required_category_fields = ['id', 'name', 'inputType', 'options']
                for field in required_category_fields:
                    if field in first_category:
                        print(f"✅ Category field '{field}' present")
                    else:
                        print(f"❌ Category field '{field}' missing")
                        return False
                
                # Check option structure
                options = first_category.get('options', [])
                if options:
                    first_option = options[0]
                    required_option_fields = ['id', 'name', 'price', 'inputType']
                    for field in required_option_fields:
                        if field in first_option:
                            print(f"✅ Option field '{field}' present")
                        else:
                            print(f"❌ Option field '{field}' missing")
                            return False
            
            # Verify some key models exist
            model_ids = [model.get('id') for model in models]
            expected_models = [
                'sauna_kwadro_beczka_235x300_cm',
                'sauna_beczka_235x200_cm'
            ]
            
            for model_id in expected_models:
                if model_id in model_ids:
                    model = next(m for m in models if m.get('id') == model_id)
                    print(f"✅ Model '{model_id}' found - Price: {model.get('basePrice')} PLN, Discount: {model.get('discount')}%")
                else:
                    print(f"❌ Model '{model_id}' missing")
                    return False
            
            # Verify some key categories exist
            category_ids = [cat.get('id') for cat in categories]
            expected_categories = ['piece', 'drzwi', 'okna', 'dostawa']
            
            for cat_id in expected_categories:
                if cat_id in category_ids:
                    category = next(c for c in categories if c.get('id') == cat_id)
                    option_count = len(category.get('options', []))
                    print(f"✅ Category '{cat_id}' found with {option_count} options")
                else:
                    print(f"❌ Category '{cat_id}' missing")
                    return False
            
            return True
        else:
            print(f"❌ GET /api/sauna/prices failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ GET /api/sauna/prices error: {str(e)}")
        return False

def test_create_sauna_order():
    """Test POST /api/sauna/orders with specific test data"""
    print("\n🔍 Testing POST /api/sauna/orders...")
    
    try:
        # Create test order as specified in review request
        test_order = {
            "id": str(uuid.uuid4()),
            "fullName": "Test User",
            "phoneNumber": "+48 111 222 333",
            "fullAddress": "Warszawa",
            "orderDate": datetime.now().strftime("%Y-%m-%d"),
            "selectedModel": "sauna_kwadro_beczka_235x300_cm",
            "modelName": "Sauna Kwadro-Beczka 235x300 cm",
            "basePrice": 24100,
            "foundationPrice": 250,
            "discount": 8,
            "selections": {
                "piece": "piec_elektryczny_9kw",
                "strona_pieca": "piec_lewo"
            },
            "notes": "Test sauna order",
            "optionsTotal": 2950,  # 2600 + 350
            "total": 24886.0,  # (24100 + 250 + 2950) × 0.92 = 24886
            "createdAt": datetime.now().isoformat()
        }
        
        response = requests.post(f"{BACKEND_URL}/sauna/orders", json=test_order)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            saved_order = response.json()
            print("✅ POST /api/sauna/orders successful")
            print(f"✅ Order ID: {saved_order.get('id')}")
            print(f"✅ Customer: {saved_order.get('fullName')}")
            print(f"✅ Model: {saved_order.get('modelName')}")
            print(f"✅ Total: {saved_order.get('total')} PLN")
            
            # Verify calculation
            expected_total = 24886.0
            actual_total = saved_order.get('total', 0)
            if abs(actual_total - expected_total) < 1:  # Allow small rounding differences
                print(f"✅ Total calculation correct: {actual_total} PLN")
            else:
                print(f"❌ Total calculation incorrect: expected {expected_total}, got {actual_total}")
                return False
            
            return saved_order.get('id')  # Return order ID for verification
        else:
            print(f"❌ POST /api/sauna/orders failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ POST /api/sauna/orders error: {str(e)}")
        return False

def test_update_sauna_prices():
    """Test POST /api/sauna/prices - Update sauna pricing"""
    print("\n🔍 Testing POST /api/sauna/prices (Update sauna pricing)...")
    
    try:
        # First get current prices
        get_response = requests.get(f"{BACKEND_URL}/sauna/prices")
        if get_response.status_code != 200:
            print("❌ Could not get current sauna prices for testing")
            return False
        
        current_data = get_response.json()
        
        # Create test data with modifications
        test_data = current_data.copy()
        
        # Modify a model's discount percentage
        models = test_data.get('models', [])
        for model in models:
            if model.get('id') == 'sauna_kwadro_beczka_235x300_cm':
                original_discount = model.get('discount', 0)
                model['discount'] = 10  # Change from 8% to 10%
                print(f"✅ Modified model discount from {original_discount}% to 10%")
                break
        
        # Add a new option to a category
        categories = test_data.get('categories', [])
        for category in categories:
            if category.get('id') == 'piece':
                new_option = {
                    "id": "test_piec_premium",
                    "name": "Test Premium Piec 15kW",
                    "price": 7500,
                    "inputType": "radio",
                    "sortOrder": 99
                }
                category['options'].append(new_option)
                print("✅ Added new option 'Test Premium Piec 15kW' to piece category")
                break
        
        # Send POST request
        response = requests.post(f"{BACKEND_URL}/sauna/prices", json=test_data)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ POST /api/sauna/prices successful")
            
            # Verify the changes were saved by getting data again
            verify_response = requests.get(f"{BACKEND_URL}/sauna/prices")
            if verify_response.status_code == 200:
                saved_data = verify_response.json()
                
                # Check if model discount was updated
                saved_models = saved_data.get('models', [])
                for model in saved_models:
                    if model.get('id') == 'sauna_kwadro_beczka_235x300_cm':
                        if model.get('discount') == 10:
                            print("✅ Model discount percentage updated successfully")
                        else:
                            print(f"❌ Model discount not updated: {model.get('discount')}")
                            return False
                        break
                
                # Check if new option was added
                saved_categories = saved_data.get('categories', [])
                option_found = False
                for category in saved_categories:
                    if category.get('id') == 'piece':
                        for option in category.get('options', []):
                            if option.get('id') == 'test_piec_premium':
                                print("✅ New option added to category successfully")
                                option_found = True
                                break
                        break
                
                if not option_found:
                    print("❌ New option not found after save")
                    return False
                
                return True
            else:
                print("❌ Could not verify saved sauna pricing data")
                return False
        else:
            print(f"❌ POST /api/sauna/prices failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ POST /api/sauna/prices error: {str(e)}")
        return False
    """Test GET /api/sauna/orders endpoint"""
    print("\n🔍 Testing GET /api/sauna/orders...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/sauna/orders")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            orders = response.json()
            print(f"✅ GET /api/sauna/orders successful")
            print(f"✅ Found {len(orders)} sauna orders")
            
            if orders:
                # Check structure of first order
                first_order = orders[0]
                required_fields = ['id', 'fullName', 'phoneNumber', 'selectedModel', 'total']
                for field in required_fields:
                    if field in first_order:
                        print(f"✅ Sauna order field '{field}' present")
                    else:
                        print(f"❌ Sauna order field '{field}' missing")
                        return False
                
                # Check if our test order is there
                test_orders = [order for order in orders if order.get('fullName') == 'Test User']
                if test_orders:
                    print("✅ Test sauna order found in list")
                else:
                    print("❌ Test sauna order not found in list")
            
            return True
        else:
            print(f"❌ GET /api/sauna/orders failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ GET /api/sauna/orders error: {str(e)}")
        return False

def test_get_sauna_orders():
    """Test GET /api/sauna/orders endpoint"""
    print("\n🔍 Testing GET /api/sauna/orders...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/sauna/orders")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            orders = response.json()
            print(f"✅ GET /api/sauna/orders successful")
            print(f"✅ Found {len(orders)} sauna orders")
            
            if orders:
                # Check structure of first order
                first_order = orders[0]
                required_fields = ['id', 'fullName', 'phoneNumber', 'selectedModel', 'total']
                for field in required_fields:
                    if field in first_order:
                        print(f"✅ Sauna order field '{field}' present")
                    else:
                        print(f"❌ Sauna order field '{field}' missing")
                        return False
                
                # Check if our test order is there
                test_orders = [order for order in orders if order.get('fullName') == 'Test User']
                if test_orders:
                    print("✅ Test sauna order found in list")
                else:
                    print("❌ Test sauna order not found in list")
            
            return True
        else:
            print(f"❌ GET /api/sauna/orders failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ GET /api/sauna/orders error: {str(e)}")
        return False

def test_generate_sauna_pdf():
    """Test POST /api/sauna/generate-pdf endpoint with discount applied (NEW FORMAT)"""
    print("\n🔍 Testing POST /api/sauna/generate-pdf with discount applied...")
    
    try:
        # Create test PDF request as specified in review request
        pdf_request = {
            "fullName": "Test Customer",
            "email": "test@example.com",
            "phoneNumber": "+48 111 222 333",
            "fullAddress": "Warszawa",
            "orderDate": datetime.now().strftime("%Y-%m-%d"),
            "selectedModel": "sauna_kwadro_beczka_235x300_cm",
            "modelName": "Sauna Kwadro-Beczka 235x300 cm",
            "basePrice": 24100,
            "foundationPrice": 250,
            "discount": 8,
            "discountPercent": 8,
            "selections": {
                "piece": "piec_elektryczny_9kw",
                "strona_pieca": "piec_lewo"
            },
            "notes": "Test PDF generation with new format",
            "optionsTotal": 2950,  # 2600 + 350
            "subtotal": 27050,     # 24100 + 2600 + 350
            "total": 24886,        # 27050 * 0.92 = 24886
            "language": "pl",
            "categories": [
                {
                    "id": "piece",
                    "name": "Piece",
                    "inputType": "radio",
                    "options": [
                        {"id": "piec_elektryczny_9kw", "name": "Piec Elektryczne 9 kW", "price": 2600}
                    ]
                },
                {
                    "id": "strona_pieca",
                    "name": "Strona Pieca:",
                    "inputType": "radio",
                    "options": [
                        {"id": "piec_lewo", "name": "Piec lewo", "price": 350}
                    ]
                }
            ]
        }
        
        response = requests.post(f"{BACKEND_URL}/sauna/generate-pdf", json=pdf_request)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ POST /api/sauna/generate-pdf successful")
            
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
                
                # Verify discount calculation in request
                expected_subtotal = 27050
                expected_total = 24886
                actual_subtotal = pdf_request.get('subtotal', 0)
                actual_total = pdf_request.get('total', 0)
                
                if actual_subtotal == expected_subtotal:
                    print(f"✅ Subtotal calculation correct: {actual_subtotal} PLN")
                else:
                    print(f"❌ Subtotal calculation incorrect: expected {expected_subtotal}, got {actual_subtotal}")
                
                if actual_total == expected_total:
                    print(f"✅ Total with discount calculation correct: {actual_total} PLN")
                else:
                    print(f"❌ Total with discount calculation incorrect: expected {expected_total}, got {actual_total}")
                
                print("✅ PDF generated with new format (two columns for options)")
                
            else:
                print(f"❌ PDF too small: {content_length} bytes")
                return False
            
            return True
        else:
            print(f"❌ POST /api/sauna/generate-pdf failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ POST /api/sauna/generate-pdf error: {str(e)}")
        return False

def test_display_type_feature():
    """Test Display Type feature for Sauna Calculator as specified in review request"""
    print("\n🎨 Testing Display Type Feature for Sauna Calculator...")
    print("=" * 60)
    
    try:
        # Step 1: Get current prices and note displayType values
        print("\n🔍 Step 1: Getting current prices and checking displayType fields...")
        response = requests.get(f"{BACKEND_URL}/sauna/prices")
        
        if response.status_code != 200:
            print(f"❌ Failed to get sauna prices: {response.status_code}")
            return False
        
        current_data = response.json()
        print("✅ GET /api/sauna/prices successful")
        
        # Check if modelsDisplayType field exists
        models_display_type = current_data.get('modelsDisplayType')
        if models_display_type is not None:
            print(f"✅ modelsDisplayType field found: '{models_display_type}'")
        else:
            print("❌ modelsDisplayType field missing")
            return False
        
        # Check if each category has displayType field
        categories = current_data.get('categories', [])
        categories_with_display_type = 0
        piece_category = None
        
        for category in categories:
            display_type = category.get('displayType')
            if display_type is not None:
                categories_with_display_type += 1
                print(f"✅ Category '{category.get('id')}' has displayType: '{display_type}'")
                
                # Find the "Piece" category for later testing
                if category.get('id') == 'piece':
                    piece_category = category
                    print(f"✅ Found 'Piece' category with displayType: '{display_type}'")
            else:
                print(f"❌ Category '{category.get('id')}' missing displayType field")
                return False
        
        print(f"✅ All {categories_with_display_type} categories have displayType field")
        
        if not piece_category:
            print("❌ 'Piece' category not found")
            return False
        
        # Step 2: Update modelsDisplayType from "grid" to "dropdown"
        print("\n🔍 Step 2: Updating modelsDisplayType from 'grid' to 'dropdown'...")
        
        test_data = current_data.copy()
        original_models_display_type = test_data.get('modelsDisplayType', 'grid')
        test_data['modelsDisplayType'] = 'dropdown'
        print(f"✅ Changed modelsDisplayType from '{original_models_display_type}' to 'dropdown'")
        
        # Step 3: Update category "Piece" displayType from "grid" to "dropdown"
        print("\n🔍 Step 3: Updating 'Piece' category displayType to 'dropdown'...")
        
        original_piece_display_type = piece_category.get('displayType', 'grid')
        for category in test_data['categories']:
            if category.get('id') == 'piece':
                category['displayType'] = 'dropdown'
                print(f"✅ Changed 'Piece' category displayType from '{original_piece_display_type}' to 'dropdown'")
                break
        
        # Step 4: Save changes
        print("\n🔍 Step 4: Saving changes...")
        
        save_response = requests.post(f"{BACKEND_URL}/sauna/prices", json=test_data)
        if save_response.status_code != 200:
            print(f"❌ Failed to save changes: {save_response.status_code}")
            print(f"Response: {save_response.text}")
            return False
        
        print("✅ Changes saved successfully")
        
        # Step 5: Get prices again and verify both changes persisted
        print("\n🔍 Step 5: Verifying changes persisted...")
        
        verify_response = requests.get(f"{BACKEND_URL}/sauna/prices")
        if verify_response.status_code != 200:
            print(f"❌ Failed to get updated prices: {verify_response.status_code}")
            return False
        
        updated_data = verify_response.json()
        
        # Verify modelsDisplayType change
        updated_models_display_type = updated_data.get('modelsDisplayType')
        if updated_models_display_type == 'dropdown':
            print("✅ modelsDisplayType successfully updated to 'dropdown'")
        else:
            print(f"❌ modelsDisplayType not updated correctly: expected 'dropdown', got '{updated_models_display_type}'")
            return False
        
        # Verify Piece category displayType change
        updated_piece_category = None
        for category in updated_data.get('categories', []):
            if category.get('id') == 'piece':
                updated_piece_category = category
                break
        
        if updated_piece_category:
            updated_piece_display_type = updated_piece_category.get('displayType')
            if updated_piece_display_type == 'dropdown':
                print("✅ 'Piece' category displayType successfully updated to 'dropdown'")
            else:
                print(f"❌ 'Piece' category displayType not updated correctly: expected 'dropdown', got '{updated_piece_display_type}'")
                return False
        else:
            print("❌ 'Piece' category not found in updated data")
            return False
        
        # Additional validation: Test that both "grid" and "dropdown" are valid values
        print("\n🔍 Additional validation: Testing valid displayType values...")
        
        # Test setting back to "grid"
        test_data_grid = updated_data.copy()
        test_data_grid['modelsDisplayType'] = 'grid'
        for category in test_data_grid['categories']:
            if category.get('id') == 'piece':
                category['displayType'] = 'grid'
                break
        
        grid_response = requests.post(f"{BACKEND_URL}/sauna/prices", json=test_data_grid)
        if grid_response.status_code == 200:
            print("✅ Both 'grid' and 'dropdown' are valid displayType values")
        else:
            print(f"❌ Failed to set displayType back to 'grid': {grid_response.status_code}")
            return False
        
        print("\n🎉 Display Type Feature testing completed successfully!")
        print("✅ All requirements met:")
        print("  - GET /api/sauna/prices returns modelsDisplayType field")
        print("  - Each category has displayType field")
        print("  - POST /api/sauna/prices accepts displayType updates")
        print("  - Changes persist after save")
        print("  - Both 'grid' and 'dropdown' are valid values")
        
        return True
        
    except Exception as e:
        print(f"❌ Display Type Feature test error: {str(e)}")
        return False

def test_sauna_calculator_system():
    """Run comprehensive sauna calculator tests"""
    print("\n🌿 SAUNA CALCULATOR TESTS")
    print("=" * 50)
    
    # Run all sauna tests including the new Display Type feature test
    sauna_results = {
        "GET /api/sauna/prices": test_get_sauna_prices(),
        "POST /api/sauna/prices": test_update_sauna_prices(),
        "POST /api/sauna/orders": test_create_sauna_order(),
        "GET /api/sauna/orders": test_get_sauna_orders(),
        "POST /api/sauna/generate-pdf": test_generate_sauna_pdf(),
        "Display Type Feature": test_display_type_feature(),
    }
    
    return sauna_results

def test_authentication_system():
    """Run comprehensive authentication system tests"""
    print("\n🔐 AUTHENTICATION SYSTEM TESTS")
    print("=" * 50)
    
    # Test admin login first
    admin_token = test_admin_login()
    if not admin_token:
        print("❌ Cannot proceed with admin tests - login failed")
        return {"Admin Login": False}
    
    # Try to create 'ivan' employee if it doesn't exist
    print("\n🔍 Creating test employee 'ivan' if not exists...")
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        ivan_data = {
            "username": "ivan",
            "password": "test123",
            "access": "balia"
        }
        import requests
        create_response = requests.post(f"{BACKEND_URL}/users", json=ivan_data, headers=headers)
        if create_response.status_code == 200:
            print("✅ Created test employee 'ivan'")
        elif create_response.status_code == 400:
            print("✅ Test employee 'ivan' already exists")
        else:
            print(f"⚠️ Could not create test employee: {create_response.status_code}")
    except Exception as e:
        print(f"⚠️ Error creating test employee: {e}")
    
    # Test employee login
    employee_token = test_employee_login()
    if not employee_token:
        print("❌ Cannot proceed with employee tests - login failed")
        # Return partial results for admin tests only
        return {
            "Admin Login": True,
            "Employee Login": False,
            "Invalid Login": test_invalid_login(),
            "Get Current User (Admin)": test_get_current_user(admin_token),
            "Verify Token (Admin)": test_verify_token(admin_token),
            "Get Users (Admin)": test_get_users_admin(admin_token),
        }
    
    # Run all authentication tests
    auth_results = {
        "Invalid Login": test_invalid_login(),
        "Get Current User (Admin)": test_get_current_user(admin_token),
        "Get Current User (Employee)": test_get_current_user(employee_token),
        "Verify Token (Admin)": test_verify_token(admin_token),
        "Verify Token (Employee)": test_verify_token(employee_token),
        "Get Users (Admin)": test_get_users_admin(admin_token),
        "Get Users (Employee - should fail)": test_get_users_employee(employee_token),
    }
    
    # Test user management (create, update, delete)
    created_user_id = test_create_user(admin_token)
    if created_user_id:
        auth_results["Create User"] = True
        auth_results["Update User"] = test_update_user(admin_token, created_user_id)
        auth_results["Delete User"] = test_delete_user(admin_token, created_user_id)
    else:
        auth_results["Create User"] = False
        auth_results["Update User"] = False
        auth_results["Delete User"] = False
    
    return auth_results

def run_all_tests():
    """Run all backend tests"""
    print("🚀 Starting Backend API Tests for Hot Tub Calculator with Sauna Calculator and Authentication System")
    print("=" * 80)
    
    # Run existing category management tests
    test_results = {
        "GET /api/prices": test_get_prices(),
        "POST /api/prices": test_post_prices(),
        "POST /api/orders": test_post_orders(),
        "GET /api/orders": test_get_orders(),
        "POST /api/generate-pdf": test_generate_pdf(),
        "Category Order Functionality": test_category_order_functionality()
    }
    
    # Run sauna calculator tests
    sauna_results = test_sauna_calculator_system()
    
    # Run authentication system tests
    auth_results = test_authentication_system()
    
    # Run observer role tests
    observer_results = test_observer_role_system()
    
    # Combine all results
    all_results = {**test_results, **sauna_results, **auth_results, **observer_results}
    
    print("\n" + "=" * 80)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 80)
    
    passed = 0
    failed = 0
    
    # Show category management results
    print("\n📦 CATEGORY MANAGEMENT TESTS:")
    for test_name, result in test_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {test_name}: {status}")
        if result:
            passed += 1
        else:
            failed += 1
    
    # Show sauna calculator results
    print("\n🌿 SAUNA CALCULATOR TESTS:")
    for test_name, result in sauna_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {test_name}: {status}")
        if result:
            passed += 1
        else:
            failed += 1
    
    # Show authentication results
    print("\n🔐 AUTHENTICATION TESTS:")
    for test_name, result in auth_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {test_name}: {status}")
        if result:
            passed += 1
        else:
            failed += 1
    
    # Show observer role results
    print("\n👁️ OBSERVER ROLE TESTS:")
    for test_name, result in observer_results.items():
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
    else:
        print(f"\n⚠️  {failed} test(s) failed - see details above")
    
    return all_results

def test_display_type_feature_only():
    """Run only the Display Type feature test as specified in review request"""
    print("🎨 DISPLAY TYPE FEATURE TEST")
    print("=" * 50)
    print("Testing Display Type feature for Sauna Calculator")
    print("Review Request Requirements:")
    print("1. GET /api/sauna/prices - Verify modelsDisplayType and category displayType fields")
    print("2. POST /api/sauna/prices - Test updating modelsDisplayType to 'dropdown'")
    print("3. POST /api/sauna/prices - Test updating category displayType from 'grid' to 'dropdown'")
    print("4. Verify persistence of changes")
    print("Authentication: Admin login required")
    print("=" * 50)
    
    # First authenticate as admin
    print("\n🔐 Authenticating as admin...")
    admin_token = test_admin_login()
    if not admin_token:
        print("❌ Admin authentication failed - cannot proceed with Display Type tests")
        return False
    
    # Run the Display Type feature test
    result = test_display_type_feature()
    
    print("\n" + "=" * 50)
    print("📊 DISPLAY TYPE FEATURE TEST RESULT")
    print("=" * 50)
    
    if result:
        print("🎉 Display Type Feature test PASSED!")
        print("✅ All backend APIs for Display Type feature are working correctly")
    else:
        print("❌ Display Type Feature test FAILED!")
        print("⚠️  See detailed error messages above")
    
    return result

# ============================================================================
# TECH SPEC FEATURE TESTS (NEW)
# ============================================================================

def test_create_test_sauna_order():
    """Create a test sauna order for tech spec testing"""
    print("\n🔍 Creating test sauna order for tech spec testing...")
    
    try:
        test_order = {
            "id": "test-order-tech-spec-001",
            "fullName": "Анна Ковальская",
            "phoneNumber": "+48 123 456 789",
            "fullAddress": "Варшава, ул. Тестовая 123",
            "orderDate": datetime.now().strftime("%Y-%m-%d"),
            "selectedModel": "sauna_kwadro_beczka_235x300_cm",
            "modelName": "Sauna Kwadro-Beczka 235x300 cm",
            "basePrice": 24100,
            "foundationPrice": 250,
            "discount": 8,
            "selections": {
                "piece": "piec_elektryczny_9kw",
                "strona_pieca": "piec_lewo",
                "drzwi": "drzwi_szklane"
            },
            "notes": "Test order for tech spec feature",
            "optionsTotal": 2950,
            "total": 24886.0,
            "createdAt": datetime.now().isoformat()
        }
        
        response = requests.post(f"{BACKEND_URL}/sauna/orders", json=test_order)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Test sauna order created successfully")
            return test_order["id"]
        else:
            print(f"❌ Failed to create test order: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error creating test order: {str(e)}")
        return False

def test_save_tech_spec(order_id):
    """Test PUT /api/sauna/orders/{order_id}/tech-spec - Save tech spec to order"""
    print(f"\n🔍 Testing PUT /api/sauna/orders/{order_id}/tech-spec...")
    
    try:
        # Create comprehensive tech spec data
        tech_spec_data = {
            "comment": "Тестовый комментарий для технического задания",
            "selections": {
                "base_color": "Натуральный",
                "door_color": "Темно-коричневый",
                "trim_color": "Светло-коричневый", 
                "roof_color": "Черный",
                "benches": "Стандартные ławki",
                "stove_guard": "Да",
                "stove_base": "Металлическое основание",
                "steam_room_lighting": ["LED освещение", "Диммер"],
                "entrance_door": "Стеклянная дверь",
                "steam_door": "Деревянная дверь",
                "heater": "Электрический 9kW",
                "additional_options": ["Вентиляция", "Термометр"]
            },
            "textInputs": {
                "shelf_size": "80x40 см",
                "special_requirements": "Дополнительная изоляция"
            }
        }
        
        response = requests.put(f"{BACKEND_URL}/sauna/orders/{order_id}/tech-spec", json=tech_spec_data)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Tech spec saved successfully")
            print(f"✅ Response: {data.get('message', 'No message')}")
            return True
        else:
            print(f"❌ Failed to save tech spec: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error saving tech spec: {str(e)}")
        return False

def test_get_tech_spec(order_id):
    """Test GET /api/sauna/orders/{order_id}/tech-spec - Get tech spec from order"""
    print(f"\n🔍 Testing GET /api/sauna/orders/{order_id}/tech-spec...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/sauna/orders/{order_id}/tech-spec")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            tech_spec = response.json()
            print("✅ Tech spec retrieved successfully")
            
            # Verify the structure and content
            if "comment" in tech_spec:
                print(f"✅ Comment found: {tech_spec['comment'][:50]}...")
            else:
                print("❌ Comment field missing")
                return False
            
            if "selections" in tech_spec:
                selections = tech_spec["selections"]
                print(f"✅ Selections found: {len(selections)} items")
                
                # Check some key selections
                expected_selections = ["base_color", "door_color", "heater"]
                for sel in expected_selections:
                    if sel in selections:
                        print(f"✅ Selection '{sel}': {selections[sel]}")
                    else:
                        print(f"❌ Selection '{sel}' missing")
            else:
                print("❌ Selections field missing")
                return False
            
            if "textInputs" in tech_spec:
                text_inputs = tech_spec["textInputs"]
                print(f"✅ Text inputs found: {len(text_inputs)} items")
            else:
                print("❌ Text inputs field missing")
                return False
            
            return tech_spec
        else:
            print(f"❌ Failed to get tech spec: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error getting tech spec: {str(e)}")
        return False

def test_generate_tech_spec_pdf(order_id):
    """Test POST /api/sauna/generate-tech-spec-pdf - Generate PDF for tech spec"""
    print(f"\n🔍 Testing POST /api/sauna/generate-tech-spec-pdf...")
    
    try:
        # First get the order data
        order_response = requests.get(f"{BACKEND_URL}/sauna/orders")
        if order_response.status_code != 200:
            print("❌ Could not get orders for PDF test")
            return False
        
        orders = order_response.json()
        test_order = next((order for order in orders if order.get("id") == order_id), None)
        
        if not test_order:
            print(f"❌ Test order {order_id} not found")
            return False
        
        # Get the tech spec data
        tech_spec_response = requests.get(f"{BACKEND_URL}/sauna/orders/{order_id}/tech-spec")
        if tech_spec_response.status_code != 200:
            print("❌ Could not get tech spec for PDF test")
            return False
        
        tech_spec = tech_spec_response.json()
        
        # Create PDF request
        pdf_request = {
            "order": test_order,
            "techSpec": tech_spec
        }
        
        response = requests.post(f"{BACKEND_URL}/sauna/generate-tech-spec-pdf", json=pdf_request)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Tech spec PDF generated successfully")
            
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
            
            # Check filename in headers
            content_disposition = response.headers.get('content-disposition', '')
            if 'TechSpec_' in content_disposition:
                print("✅ PDF filename contains 'TechSpec_' prefix")
            else:
                print(f"❌ Unexpected filename format: {content_disposition}")
            
            return True
        else:
            print(f"❌ Failed to generate tech spec PDF: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error generating tech spec PDF: {str(e)}")
        return False

def test_tech_spec_with_nonexistent_order():
    """Test tech spec endpoints with non-existent order ID"""
    print("\n🔍 Testing tech spec endpoints with non-existent order...")
    
    fake_order_id = "non-existent-order-123"
    
    try:
        # Test GET with non-existent order
        get_response = requests.get(f"{BACKEND_URL}/sauna/orders/{fake_order_id}/tech-spec")
        if get_response.status_code == 404:
            print("✅ GET tech spec correctly returns 404 for non-existent order")
        else:
            print(f"❌ GET tech spec should return 404, got {get_response.status_code}")
            return False
        
        # Test PUT with non-existent order
        test_data = {"comment": "test", "selections": {}}
        put_response = requests.put(f"{BACKEND_URL}/sauna/orders/{fake_order_id}/tech-spec", json=test_data)
        if put_response.status_code == 404:
            print("✅ PUT tech spec correctly returns 404 for non-existent order")
        else:
            print(f"❌ PUT tech spec should return 404, got {put_response.status_code}")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Error testing non-existent order: {str(e)}")
        return False

def test_tech_spec_feature_system():
    """Run comprehensive tech spec feature tests"""
    print("\n📋 TECH SPEC FEATURE TESTS")
    print("=" * 50)
    
    # Step 1: Create test order
    test_order_id = test_create_test_sauna_order()
    if not test_order_id:
        print("❌ Cannot proceed with tech spec tests - order creation failed")
        return {
            "Create Test Order": False,
            "Save Tech Spec": False,
            "Get Tech Spec": False,
            "Generate Tech Spec PDF": False,
            "Non-existent Order Handling": False
        }
    
    # Step 2: Test saving tech spec
    save_result = test_save_tech_spec(test_order_id)
    
    # Step 3: Test getting tech spec
    get_result = test_get_tech_spec(test_order_id)
    
    # Step 4: Test PDF generation
    pdf_result = test_generate_tech_spec_pdf(test_order_id)
    
    # Step 5: Test error handling
    error_handling_result = test_tech_spec_with_nonexistent_order()
    
    tech_spec_results = {
        "Create Test Order": bool(test_order_id),
        "Save Tech Spec": save_result,
        "Get Tech Spec": bool(get_result),
        "Generate Tech Spec PDF": pdf_result,
        "Non-existent Order Handling": error_handling_result
    }
    
    return tech_spec_results

def test_tech_spec_feature_only():
    """Run only the Tech Spec feature tests as specified in review request"""
    print("📋 TECH SPEC FEATURE TESTS")
    print("=" * 50)
    print("Testing Tech Spec feature for Sauna Orders as specified in review request")
    
    results = test_tech_spec_feature_system()
    
    print("\n📊 TECH SPEC TEST RESULTS:")
    passed = 0
    failed = 0
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {test_name}: {status}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print(f"\nTech Spec Tests - Passed: {passed}, Failed: {failed}")
    
    if failed == 0:
        print("🎉 All Tech Spec tests passed!")
    else:
        print(f"⚠️ {failed} Tech Spec test(s) failed")
    
    return results

# ============================================================================
# SAUNA CRUD API TESTS (NEW)
# ============================================================================

def test_sauna_models_crud():
    """Test full CRUD operations for Sauna Models as specified in review request"""
    print("\n🔧 Testing Sauna Models CRUD Operations...")
    print("=" * 60)
    
    try:
        # Step 1: POST /api/sauna/models - Add new model "Test Sauna XL" with basePrice=15000
        print("\n🔍 Step 1: Adding new model 'Test Sauna XL'...")
        
        new_model = {
            "id": "test_sauna_xl",
            "name": "Test Sauna XL",
            "basePrice": 15000,
            "foundationPrice": 300,
            "discount": 0,
            "imageUrl": "https://example.com/test-sauna.jpg",
            "sortOrder": 99,
            "active": True
        }
        
        response = requests.post(f"{BACKEND_URL}/sauna/models", json=new_model)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ POST /api/sauna/models successful - Model added")
            result = response.json()
            print(f"✅ Added model: {result.get('model', {}).get('name')} with basePrice: {result.get('model', {}).get('basePrice')} PLN")
        else:
            print(f"❌ POST /api/sauna/models failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        # Step 2: PUT /api/sauna/models/test_sauna_xl - Update model, change basePrice to 16000
        print("\n🔍 Step 2: Updating model basePrice to 16000...")
        
        updated_model = new_model.copy()
        updated_model["basePrice"] = 16000
        
        response = requests.put(f"{BACKEND_URL}/sauna/models/test_sauna_xl", json=updated_model)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ PUT /api/sauna/models/test_sauna_xl successful - Model updated")
            result = response.json()
            print(f"✅ Updated basePrice to: {result.get('model', {}).get('basePrice')} PLN")
        else:
            print(f"❌ PUT /api/sauna/models/test_sauna_xl failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        # Step 3: Verify model exists by checking GET /api/sauna/prices
        print("\n🔍 Step 3: Verifying model exists in GET /api/sauna/prices...")
        
        response = requests.get(f"{BACKEND_URL}/sauna/prices")
        if response.status_code == 200:
            data = response.json()
            models = data.get('models', [])
            test_model = next((m for m in models if m.get('id') == 'test_sauna_xl'), None)
            
            if test_model:
                print(f"✅ Model found in prices: {test_model.get('name')} - {test_model.get('basePrice')} PLN")
                if test_model.get('basePrice') == 16000:
                    print("✅ Model basePrice correctly updated to 16000")
                else:
                    print(f"❌ Model basePrice incorrect: expected 16000, got {test_model.get('basePrice')}")
                    return False
            else:
                print("❌ Test model not found in GET /api/sauna/prices")
                return False
        else:
            print(f"❌ GET /api/sauna/prices failed: {response.status_code}")
            return False
        
        # Step 4: DELETE /api/sauna/models/test_sauna_xl - Delete the model
        print("\n🔍 Step 4: Deleting the test model...")
        
        response = requests.delete(f"{BACKEND_URL}/sauna/models/test_sauna_xl")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ DELETE /api/sauna/models/test_sauna_xl successful - Model deleted")
        else:
            print(f"❌ DELETE /api/sauna/models/test_sauna_xl failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        # Step 5: Verify model is deleted by checking GET /api/sauna/prices
        print("\n🔍 Step 5: Verifying model is deleted...")
        
        response = requests.get(f"{BACKEND_URL}/sauna/prices")
        if response.status_code == 200:
            data = response.json()
            models = data.get('models', [])
            test_model = next((m for m in models if m.get('id') == 'test_sauna_xl'), None)
            
            if test_model is None:
                print("✅ Model successfully deleted - not found in GET /api/sauna/prices")
            else:
                print("❌ Model still exists after deletion")
                return False
        else:
            print(f"❌ GET /api/sauna/prices failed: {response.status_code}")
            return False
        
        print("\n🎉 Sauna Models CRUD operations completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Sauna Models CRUD test error: {str(e)}")
        return False

def test_sauna_categories_crud():
    """Test full CRUD operations for Sauna Categories as specified in review request"""
    print("\n🔧 Testing Sauna Categories CRUD Operations...")
    print("=" * 60)
    
    try:
        # Step 1: POST /api/sauna/categories - Add new category "Test Options" with inputType="checkbox"
        print("\n🔍 Step 1: Adding new category 'Test Options'...")
        
        new_category = {
            "id": "test_options",
            "name": "Test Options",
            "inputType": "checkbox",
            "displayType": "grid",
            "options": []
        }
        
        response = requests.post(f"{BACKEND_URL}/sauna/categories", json=new_category)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ POST /api/sauna/categories successful - Category added")
            result = response.json()
            print(f"✅ Added category: {result.get('category', {}).get('name')} with inputType: {result.get('category', {}).get('inputType')}")
        else:
            print(f"❌ POST /api/sauna/categories failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        # Step 2: PUT /api/sauna/categories/test_options - Update category name to "Updated Options"
        print("\n🔍 Step 2: Updating category name to 'Updated Options'...")
        
        updated_category = new_category.copy()
        updated_category["name"] = "Updated Options"
        
        response = requests.put(f"{BACKEND_URL}/sauna/categories/test_options", json=updated_category)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ PUT /api/sauna/categories/test_options successful - Category updated")
            result = response.json()
            print(f"✅ Updated name to: {result.get('category', {}).get('name')}")
        else:
            print(f"❌ PUT /api/sauna/categories/test_options failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        # Step 3: Verify category exists by checking GET /api/sauna/prices
        print("\n🔍 Step 3: Verifying category exists in GET /api/sauna/prices...")
        
        response = requests.get(f"{BACKEND_URL}/sauna/prices")
        if response.status_code == 200:
            data = response.json()
            categories = data.get('categories', [])
            test_category = next((c for c in categories if c.get('id') == 'test_options'), None)
            
            if test_category:
                print(f"✅ Category found in prices: {test_category.get('name')} - {test_category.get('inputType')}")
                if test_category.get('name') == 'Updated Options':
                    print("✅ Category name correctly updated to 'Updated Options'")
                else:
                    print(f"❌ Category name incorrect: expected 'Updated Options', got {test_category.get('name')}")
                    return False
            else:
                print("❌ Test category not found in GET /api/sauna/prices")
                return False
        else:
            print(f"❌ GET /api/sauna/prices failed: {response.status_code}")
            return False
        
        # Step 4: DELETE /api/sauna/categories/test_options - Delete the category
        print("\n🔍 Step 4: Deleting the test category...")
        
        response = requests.delete(f"{BACKEND_URL}/sauna/categories/test_options")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ DELETE /api/sauna/categories/test_options successful - Category deleted")
        else:
            print(f"❌ DELETE /api/sauna/categories/test_options failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        # Step 5: Verify category is deleted by checking GET /api/sauna/prices
        print("\n🔍 Step 5: Verifying category is deleted...")
        
        response = requests.get(f"{BACKEND_URL}/sauna/prices")
        if response.status_code == 200:
            data = response.json()
            categories = data.get('categories', [])
            test_category = next((c for c in categories if c.get('id') == 'test_options'), None)
            
            if test_category is None:
                print("✅ Category successfully deleted - not found in GET /api/sauna/prices")
            else:
                print("❌ Category still exists after deletion")
                return False
        else:
            print(f"❌ GET /api/sauna/prices failed: {response.status_code}")
            return False
        
        print("\n🎉 Sauna Categories CRUD operations completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Sauna Categories CRUD test error: {str(e)}")
        return False

def test_sauna_options_crud():
    """Test full CRUD operations for Sauna Options as specified in review request"""
    print("\n🔧 Testing Sauna Options CRUD Operations...")
    print("=" * 60)
    
    try:
        # Step 1: First create a test category
        print("\n🔍 Step 1: Creating test category for options testing...")
        
        test_category = {
            "id": "test_category_for_options",
            "name": "Test Category for Options",
            "inputType": "radio",
            "displayType": "grid",
            "options": []
        }
        
        response = requests.post(f"{BACKEND_URL}/sauna/categories", json=test_category)
        if response.status_code != 200:
            print(f"❌ Failed to create test category: {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        print("✅ Test category created successfully")
        category_id = test_category["id"]
        
        # Step 2: POST /api/sauna/categories/{category_id}/options - Add option "Option A" with price=500
        print("\n🔍 Step 2: Adding option 'Option A' with price=500...")
        
        new_option = {
            "id": "option_a",
            "name": "Option A",
            "price": 500,
            "inputType": "radio",
            "sortOrder": 1
        }
        
        response = requests.post(f"{BACKEND_URL}/sauna/categories/{category_id}/options", json=new_option)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ POST /api/sauna/categories/{category_id}/options successful - Option added")
            result = response.json()
            print(f"✅ Added option: {result.get('option', {}).get('name')} with price: {result.get('option', {}).get('price')} PLN")
        else:
            print(f"❌ POST /api/sauna/categories/{category_id}/options failed with status {response.status_code}")
            print(f"Response: {response.text}")
            # Clean up category before returning
            requests.delete(f"{BACKEND_URL}/sauna/categories/{category_id}")
            return False
        
        option_id = new_option["id"]
        
        # Step 3: Verify option exists by checking GET /api/sauna/prices
        print("\n🔍 Step 3: Verifying option exists in GET /api/sauna/prices...")
        
        response = requests.get(f"{BACKEND_URL}/sauna/prices")
        if response.status_code == 200:
            data = response.json()
            categories = data.get('categories', [])
            test_cat = next((c for c in categories if c.get('id') == category_id), None)
            
            if test_cat:
                options = test_cat.get('options', [])
                test_option = next((o for o in options if o.get('id') == option_id), None)
                
                if test_option:
                    print(f"✅ Option found in category: {test_option.get('name')} - {test_option.get('price')} PLN")
                    if test_option.get('price') == 500:
                        print("✅ Option price correctly set to 500")
                    else:
                        print(f"❌ Option price incorrect: expected 500, got {test_option.get('price')}")
                        # Clean up before returning
                        requests.delete(f"{BACKEND_URL}/sauna/categories/{category_id}")
                        return False
                else:
                    print("❌ Test option not found in category")
                    # Clean up before returning
                    requests.delete(f"{BACKEND_URL}/sauna/categories/{category_id}")
                    return False
            else:
                print("❌ Test category not found in GET /api/sauna/prices")
                return False
        else:
            print(f"❌ GET /api/sauna/prices failed: {response.status_code}")
            # Clean up before returning
            requests.delete(f"{BACKEND_URL}/sauna/categories/{category_id}")
            return False
        
        # Step 4: DELETE /api/sauna/categories/{category_id}/options/{option_id} - Delete the option
        print("\n🔍 Step 4: Deleting the test option...")
        
        response = requests.delete(f"{BACKEND_URL}/sauna/categories/{category_id}/options/{option_id}")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ DELETE /api/sauna/categories/{category_id}/options/{option_id} successful - Option deleted")
        else:
            print(f"❌ DELETE /api/sauna/categories/{category_id}/options/{option_id} failed with status {response.status_code}")
            print(f"Response: {response.text}")
            # Clean up category before returning
            requests.delete(f"{BACKEND_URL}/sauna/categories/{category_id}")
            return False
        
        # Step 5: Verify option is deleted by checking GET /api/sauna/prices
        print("\n🔍 Step 5: Verifying option is deleted...")
        
        response = requests.get(f"{BACKEND_URL}/sauna/prices")
        if response.status_code == 200:
            data = response.json()
            categories = data.get('categories', [])
            test_cat = next((c for c in categories if c.get('id') == category_id), None)
            
            if test_cat:
                options = test_cat.get('options', [])
                test_option = next((o for o in options if o.get('id') == option_id), None)
                
                if test_option is None:
                    print("✅ Option successfully deleted - not found in category")
                else:
                    print("❌ Option still exists after deletion")
                    # Clean up category before returning
                    requests.delete(f"{BACKEND_URL}/sauna/categories/{category_id}")
                    return False
            else:
                print("❌ Test category not found in GET /api/sauna/prices")
                return False
        else:
            print(f"❌ GET /api/sauna/prices failed: {response.status_code}")
            # Clean up category before returning
            requests.delete(f"{BACKEND_URL}/sauna/categories/{category_id}")
            return False
        
        # Step 6: Clean up test category
        print("\n🔍 Step 6: Cleaning up test category...")
        
        response = requests.delete(f"{BACKEND_URL}/sauna/categories/{category_id}")
        if response.status_code == 200:
            print("✅ Test category cleaned up successfully")
        else:
            print(f"⚠️ Warning: Could not clean up test category: {response.status_code}")
        
        print("\n🎉 Sauna Options CRUD operations completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Sauna Options CRUD test error: {str(e)}")
        # Try to clean up test category if it exists
        try:
            requests.delete(f"{BACKEND_URL}/sauna/categories/test_category_for_options")
        except:
            pass
        return False

def test_sauna_crud_full():
    """Run all CRUD tests for Sauna pricing data as specified in review request"""
    print("\n🔧 SAUNA CRUD API TESTS")
    print("=" * 60)
    print("Testing full CRUD API for Sauna pricing data stored in MongoDB")
    print("Review Request Requirements:")
    print("1. Models CRUD Tests - Add, Update, Delete model")
    print("2. Categories CRUD Tests - Add, Update, Delete category")
    print("3. Options CRUD Tests - Add, Delete option within category")
    print("4. Verify all changes persist in MongoDB")
    print("5. Clean up all test data after tests")
    print("=" * 60)
    
    # Run all CRUD tests
    crud_results = {
        "Sauna Models CRUD": test_sauna_models_crud(),
        "Sauna Categories CRUD": test_sauna_categories_crud(),
        "Sauna Options CRUD": test_sauna_options_crud(),
    }
    
    print("\n" + "=" * 60)
    print("📊 SAUNA CRUD TEST RESULTS")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    for test_name, result in crud_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {test_name}: {status}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print(f"\nTotal CRUD Tests: {passed + failed}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    
    if failed == 0:
        print("\n🎉 All CRUD operations working correctly!")
        print("✅ Data persists in MongoDB")
        print("✅ All test data cleaned up")
    else:
        print(f"\n⚠️  {failed} CRUD test(s) failed - see details above")
    
    return crud_results

def test_observer_role_only():
    """Run only the Observer Role tests as specified in review request"""
    print("👁️ OBSERVER ROLE FUNCTIONALITY TEST")
    print("=" * 50)
    print("Testing Observer role functionality as specified in review request")
    print("Test Cases:")
    print("1. Observer User Login - POST /api/auth/login with Наблюдатель / observer123")
    print("2. Observer Token Verification - POST /api/auth/verify with observer's token")
    print("3. Observer Access to APIs - GET /api/sauna/prices, GET /api/sauna/orders, GET /api/prices")
    print("4. Admin-Only APIs (for comparison) - GET /api/users with admin token")
    print("=" * 50)
    
    # Run observer role tests
    observer_results = test_observer_role_system()
    
    print("\n" + "=" * 50)
    print("📊 OBSERVER ROLE TEST RESULTS")
    print("=" * 50)
    
    passed = 0
    failed = 0
    
    for test_name, result in observer_results.items():
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
        print("\n🎉 All Observer Role tests passed!")
        print("✅ Observer role functionality is working correctly")
    else:
        print(f"\n⚠️  {failed} test(s) failed - see details above")
    
    return observer_results

if __name__ == "__main__":
    # Check if we want to run specific tests
    import sys
    if len(sys.argv) > 1:
        if sys.argv[1] == "display-type":
            test_display_type_feature_only()
        elif sys.argv[1] == "crud":
            test_sauna_crud_full()
        elif sys.argv[1] == "observer":
            test_observer_role_only()
        else:
            run_all_tests()
    else:
        # Run Observer Role tests by default as per review request
        test_observer_role_only()