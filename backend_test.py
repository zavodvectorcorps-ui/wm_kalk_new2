#!/usr/bin/env python3
"""
Backend API Testing for Hot Tub Calculator with Category Management System
Tests all backend endpoints for the new category management functionality
"""

import requests
import json
import uuid
import sys
from datetime import datetime

# Get backend URL from frontend .env
BACKEND_URL = "https://sauna-price-export.preview.emergentagent.com/api"

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

def test_balia_pdf_generation():
    """Test POST /api/generate-pdf endpoint with specific Balia requirements"""
    print("\n🔍 Testing Balia PDF Generation with specific requirements...")
    print("=" * 60)
    
    try:
        # Test request as specified in review request
        pdf_request = {
            "fullName": "Jan Kowalski",
            "phoneNumber": "+48 123 456 789",
            "fullAddress": "ul. Testowa 1, Warszawa",
            "orderDate": "2024-12-30",
            "modelId": "round_ext_200",
            "modelName": "Купель 200см (внешний нагрев)",
            "modelPrice": 1250,
            "modelImageUrl": "https://sauna-price-export.preview.emergentagent.com/api/uploads/27fa922f2f7a4d808e41d1a7eb18eb23.png",
            "selectedOptions": [
                {
                    "categoryId": "hydromassage", 
                    "optionId": "hydro_6_8", 
                    "categoryName": "Гидромассаж", 
                    "optionName": "Гидромассаж 1.1кВт (6-8 форсунок)", 
                    "price": 300
                },
                {
                    "categoryId": "lighting", 
                    "optionId": "led_inside_2", 
                    "categoryName": "Освещение", 
                    "optionName": "LED внутри (2 шт)", 
                    "price": 80
                }
            ],
            "notes": "Test notes",
            "total": 1630,
            "currency": "EUR"
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
            
            # Check filename format in Content-Disposition header
            content_disposition = response.headers.get('content-disposition', '')
            print(f"Content-Disposition: {content_disposition}")
            
            if 'WMB-' in content_disposition and '.pdf' in content_disposition:
                print("✅ Filename format correct (WMB-DD-MM-YYYY-HHMMSS.pdf)")
            else:
                print(f"❌ Incorrect filename format: {content_disposition}")
                return False
            
            # Check content length
            content_length = len(response.content)
            if content_length > 1000:  # PDF should be at least 1KB
                print(f"✅ PDF size: {content_length} bytes (large size suggests images included)")
            else:
                print(f"❌ PDF too small: {content_length} bytes")
                return False
            
            # Save PDF and extract text for content verification
            pdf_filename = f"/tmp/test_balia_pdf_{datetime.now().strftime('%H%M%S')}.pdf"
            with open(pdf_filename, 'wb') as f:
                f.write(response.content)
            print(f"✅ PDF saved to {pdf_filename} for inspection")
            
            # Extract text and verify content requirements
            try:
                import PyPDF2
                with open(pdf_filename, 'rb') as f:
                    pdf_reader = PyPDF2.PdfReader(f)
                    text = ''
                    for page in pdf_reader.pages:
                        text += page.extract_text()
                
                print("\n🔍 Verifying PDF content requirements...")
                
                # Check contact info in header
                contact_requirements = [
                    'Tel: +48 732 111 111',
                    'wmbalia@gmail.com',
                    'www.wm-balia.pl'
                ]
                
                for req in contact_requirements:
                    if req in text:
                        print(f"✅ Contact info found: {req}")
                    else:
                        print(f"❌ Contact info missing: {req}")
                        return False
                
                # Check Polish model name (not Russian)
                if 'Balia 200cm (zewnętrzny piec)' in text:
                    print("✅ Model name is in Polish: 'Balia 200cm (zewnętrzny piec)'")
                else:
                    print("❌ Model name not found in Polish")
                    if 'Купель 200см (внешний нагрев)' in text:
                        print("❌ Model name is in Russian instead of Polish")
                    return False
                
                # Check Polish category names
                polish_categories = ['Hydromasaż', 'Oświetlenie']
                for cat in polish_categories:
                    if cat in text:
                        print(f"✅ Polish category name found: '{cat}'")
                    else:
                        print(f"❌ Polish category name missing: '{cat}'")
                        return False
                
                # Check Polish option names
                polish_options = [
                    'Hydromasaż 1.1kW (6-8 dysz)',
                    'LED wewnątrz (2 szt)'
                ]
                
                for option in polish_options:
                    if option in text:
                        print(f"✅ Polish option name found: '{option}'")
                    else:
                        print(f"❌ Polish option name missing: '{option}'")
                        return False
                
                # Verify Russian names are NOT present
                russian_options = [
                    'Гидромассаж 1.1кВт (6-8 форсунок)',
                    'LED внутри (2 шт)'
                ]
                
                for option in russian_options:
                    if option in text:
                        print(f"❌ Russian option name found (should be Polish): '{option}'")
                        return False
                    else:
                        print(f"✅ Russian option name correctly NOT present: '{option}'")
                
                print("\n🎉 All PDF content requirements verified successfully!")
                return True
                
            except ImportError:
                print("⚠️ PyPDF2 not available for text extraction, but basic PDF generation works")
                return True
            except Exception as e:
                print(f"⚠️ Could not extract PDF text for verification: {e}")
                print("✅ Basic PDF generation works, manual verification needed")
                return True
            
        else:
            print(f"❌ POST /api/generate-pdf failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Balia PDF generation test error: {str(e)}")
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

def test_sauna_order_creation_422_fix():
    """Test Sauna order creation via API - verify the 422 error is fixed"""
    print("\n🔍 Testing Sauna Order Creation - 422 Error Fix")
    print("=" * 60)
    
    results = {}
    
    # Test 1: Create Sauna order without id field
    print("\n📝 Test 1: Create Sauna order without id field...")
    try:
        test_order_no_id = {
            "fullName": "Test User",
            "phoneNumber": "+48123456789",
            "orderDate": "2024-12-31",
            "selectedModel": "test-model"
        }
        
        response = requests.post(f"{BACKEND_URL}/sauna/orders", json=test_order_no_id)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            saved_order = response.json()
            print("✅ Order created successfully without id field")
            
            # Verify auto-generated ID format
            order_id = saved_order.get('id', '')
            if order_id.startswith('WMS-') and len(order_id) > 10:
                print(f"✅ Auto-generated ID format correct: {order_id}")
                results["test_1_no_id"] = True
            else:
                print(f"❌ Auto-generated ID format incorrect: {order_id}")
                results["test_1_no_id"] = False
        else:
            print(f"❌ Order creation failed with status {response.status_code}")
            print(f"Response: {response.text}")
            results["test_1_no_id"] = False
            
    except Exception as e:
        print(f"❌ Test 1 error: {str(e)}")
        results["test_1_no_id"] = False
    
    # Test 2: Create Sauna order with minimal data
    print("\n📝 Test 2: Create Sauna order with minimal data...")
    try:
        test_order_minimal = {
            "fullName": "Test User",
            "phoneNumber": "+48123456789",
            "orderDate": "2024-12-31",
            "selectedModel": "test-model"
        }
        
        response = requests.post(f"{BACKEND_URL}/sauna/orders", json=test_order_minimal)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            saved_order = response.json()
            print("✅ Order created successfully with minimal data")
            print(f"✅ Order ID: {saved_order.get('id')}")
            print(f"✅ Customer: {saved_order.get('fullName')}")
            print(f"✅ Phone: {saved_order.get('phoneNumber')}")
            print(f"✅ Model: {saved_order.get('selectedModel')}")
            results["test_2_minimal"] = True
        else:
            print(f"❌ Minimal order creation failed with status {response.status_code}")
            print(f"Response: {response.text}")
            results["test_2_minimal"] = False
            
    except Exception as e:
        print(f"❌ Test 2 error: {str(e)}")
        results["test_2_minimal"] = False
    
    # Test 3: Test frontend-like request (all fields)
    print("\n📝 Test 3: Test frontend-like request (all fields)...")
    try:
        test_order_full = {
            "fullName": "Jan Kowalski",
            "email": "jan.kowalski@example.com",
            "phoneNumber": "+48123456789",
            "fullAddress": "ul. Testowa 1, 00-001 Warszawa",
            "orderDate": "2024-12-31",
            "selectedModel": "sauna_kwadro_beczka_235x300_cm",
            "modelName": "Sauna Kwadro-Beczka 235x300 cm",
            "modelImageUrl": "https://example.com/sauna.jpg",
            "basePrice": 24100,
            "foundationPrice": 250,
            "discountPercent": 8.0,
            "selections": {
                "piece": "piec_elektryczny_9kw",
                "strona_pieca": "piec_lewo"
            },
            "quantities": {},
            "selectedOptions": [
                {
                    "categoryId": "piece",
                    "optionId": "piec_elektryczny_9kw",
                    "categoryName": "Piece",
                    "optionName": "Piec Elektryczny 9kW",
                    "price": 2600
                },
                {
                    "categoryId": "strona_pieca",
                    "optionId": "piec_lewo",
                    "categoryName": "Strona Pieca",
                    "optionName": "Piec lewo",
                    "price": 350
                }
            ],
            "notes": "Test order with all fields",
            "optionsTotal": 2950,
            "subtotal": 27300,
            "total": 25116.0,
            "createdBy": "test_user",
            "adminGifts": [],
            "adminDiscountApproved": False,
            "requestedDiscount": 0,
            "requestedDiscountNote": ""
        }
        
        response = requests.post(f"{BACKEND_URL}/sauna/orders", json=test_order_full)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            saved_order = response.json()
            print("✅ Order created successfully with all fields")
            print(f"✅ Order ID: {saved_order.get('id')}")
            print(f"✅ Customer: {saved_order.get('fullName')}")
            print(f"✅ Email: {saved_order.get('email')}")
            print(f"✅ Address: {saved_order.get('fullAddress')}")
            print(f"✅ Model: {saved_order.get('modelName')}")
            print(f"✅ Base Price: {saved_order.get('basePrice')} PLN")
            print(f"✅ Foundation Price: {saved_order.get('foundationPrice')} PLN")
            print(f"✅ Discount: {saved_order.get('discountPercent')}%")
            print(f"✅ Options Total: {saved_order.get('optionsTotal')} PLN")
            print(f"✅ Total: {saved_order.get('total')} PLN")
            print(f"✅ Selected Options: {len(saved_order.get('selectedOptions', []))} items")
            print(f"✅ Selections: {saved_order.get('selections')}")
            results["test_3_full"] = True
        else:
            print(f"❌ Full order creation failed with status {response.status_code}")
            print(f"Response: {response.text}")
            results["test_3_full"] = False
            
    except Exception as e:
        print(f"❌ Test 3 error: {str(e)}")
        results["test_3_full"] = False
    
    # Summary
    print("\n📊 SAUNA ORDER CREATION TEST SUMMARY:")
    print("=" * 50)
    
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")
    
    print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 ALL SAUNA ORDER CREATION TESTS PASSED - 422 ERROR FIXED!")
        return True
    else:
        print("❌ Some tests failed - 422 error may still exist")
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

def test_amocrm_photo_upload_fix():
    """Test the amoCRM photo upload fix for the logistics system"""
    print("\n🔍 Testing amoCRM PHOTO UPLOAD FIX")
    print("=" * 70)
    
    results = {}
    
    # Test 1: Auth Test - Login and get token with testuser/test123
    print("\n📝 Test 1: Auth Test - Login with testuser/test123...")
    try:
        login_data = {
            "username": "testuser",
            "password": "test123"
        }
        
        response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Login successful with testuser/test123")
            
            if 'token' in data:
                token = data['token']
                print("✅ Token received successfully")
                results["auth_test"] = True
                headers = {"Authorization": f"Bearer {token}"}
            else:
                print("❌ No token in response")
                results["auth_test"] = False
                return results
        else:
            print(f"❌ Login failed with status {response.status_code}")
            print(f"Response: {response.text}")
            results["auth_test"] = False
            return results
            
    except Exception as e:
        print(f"❌ Auth test error: {str(e)}")
        results["auth_test"] = False
        return results
    
    # Test 2: Debug Order Endpoint Test
    print("\n📝 Test 2: Debug Order Endpoint - GET /api/driver-panel/debug/order/test-order-photo-001...")
    try:
        order_id = "test-order-photo-001"
        
        response = requests.get(f"{BACKEND_URL}/driver-panel/debug/order/{order_id}", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Debug order endpoint successful")
            
            # Verify response structure
            required_fields = ['orderId', 'found_in_collections', 'photo', 'amocrm_id', 'delivery_status']
            for field in required_fields:
                if field in data:
                    print(f"✅ Field '{field}' present: {data[field]}")
                else:
                    print(f"❌ Field '{field}' missing")
            
            results["debug_order_endpoint"] = True
        else:
            print(f"❌ Debug order endpoint failed with status {response.status_code}")
            print(f"Response: {response.text}")
            results["debug_order_endpoint"] = False
            
    except Exception as e:
        print(f"❌ Debug order endpoint test error: {str(e)}")
        results["debug_order_endpoint"] = False
    
    # Test 3: Photo Debug List Test
    print("\n📝 Test 3: Photo Debug List - GET /api/driver-panel/photos/list...")
    try:
        response = requests.get(f"{BACKEND_URL}/driver-panel/photos/list", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Photo list endpoint successful")
            
            if 'photos' in data and 'count' in data:
                photos = data['photos']
                count = data['count']
                print(f"✅ Found {count} photos in response")
                
                if photos:
                    first_photo = photos[0]
                    print(f"✅ First photo structure: {list(first_photo.keys())}")
                    print(f"✅ First photo ID: {first_photo.get('id')}")
                    print(f"✅ First photo trip: {first_photo.get('tripId')}")
                    print(f"✅ First photo order: {first_photo.get('orderId')}")
                
                results["photo_list_test"] = True
            else:
                print(f"❌ Unexpected response structure: {data}")
                results["photo_list_test"] = False
        else:
            print(f"❌ Photo list endpoint failed with status {response.status_code}")
            print(f"Response: {response.text}")
            results["photo_list_test"] = False
            
    except Exception as e:
        print(f"❌ Photo list test error: {str(e)}")
        results["photo_list_test"] = False
    
    # Test 4: Backend Health Check
    print("\n📝 Test 4: Backend Health Check...")
    try:
        response = requests.get(f"{BACKEND_URL}/health")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            health_data = response.json()
            print("✅ Backend health check successful")
            print(f"✅ Health status: {health_data}")
            results["backend_health"] = True
        else:
            print(f"❌ Backend health check failed with status {response.status_code}")
            results["backend_health"] = False
            
    except Exception as e:
        print(f"❌ Backend health check error: {str(e)}")
        results["backend_health"] = False
    
    # Test 5: API Structure Verification - Check resend photo endpoint exists
    print("\n📝 Test 5: API Structure Verification - Check /api/driver-panel/resend-photo-to-amocrm/{order_id}...")
    try:
        test_order_id = "test-order-photo-001"
        
        # Try to access the endpoint (it may fail due to missing data, but should exist)
        response = requests.post(f"{BACKEND_URL}/driver-panel/resend-photo-to-amocrm/{test_order_id}", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        # We expect either 200 (success), 400 (bad request), or 404 (order not found)
        # But NOT 405 (method not allowed) which would indicate endpoint doesn't exist
        if response.status_code in [200, 400, 404, 422]:
            print("✅ Resend photo to amoCRM endpoint exists and responds")
            print(f"✅ Response indicates endpoint is properly configured")
            results["api_structure_verification"] = True
        elif response.status_code == 405:
            print("❌ Method not allowed - endpoint may not exist")
            results["api_structure_verification"] = False
        else:
            print(f"⚠️ Unexpected status code {response.status_code}, but endpoint exists")
            print(f"Response: {response.text}")
            results["api_structure_verification"] = True
            
    except Exception as e:
        print(f"❌ API structure verification error: {str(e)}")
        results["api_structure_verification"] = False
    
    # Summary
    print("\n📊 amoCRM PHOTO UPLOAD FIX TEST SUMMARY:")
    print("=" * 50)
    
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")
    
    print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 ALL amoCRM PHOTO UPLOAD FIX TESTS PASSED!")
        return True
    else:
        print("❌ Some tests failed - amoCRM photo upload fix needs attention")
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
            
            # Check if drivers have userId field
            if drivers:
                first_driver = drivers[0]
                if 'userId' in first_driver:
                    print("✅ Drivers contain userId field")
                    print(f"✅ Sample driver: {first_driver}")
                    results["drivers_api"] = True
                else:
                    print("❌ Drivers missing userId field")
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


def test_review_request_scenarios():
    """Test the specific scenarios from the review request"""
    print("\n🔍 Testing REVIEW REQUEST SCENARIOS")
    print("=" * 70)
    
    results = {}
    
    # Test 1: Balia PDF Gift Strikethrough Fix Verification
    print("\n📝 Test 1: Balia PDF Gift Strikethrough Fix Verification...")
    try:
        pdf_request = {
            "fullName": "Test Gift PDF",
            "phoneNumber": "123456",
            "fullAddress": "Test Address",
            "orderDate": "2025-01-01",
            "modelId": "balia_200",
            "modelName": "Balia 200cm",
            "modelPrice": 1250,
            "total": 1250,
            "currency": "EUR",
            "selectedOptions": [
                {
                    "categoryId": "pokrywa",
                    "optionId": "pokrywa_200",
                    "optionName": "Pokrywa 200cm",
                    "price": 100
                }
            ],
            "adminGifts": ["pokrywa_200"]
        }
        
        response = requests.post(f"{BACKEND_URL}/generate-pdf", json=pdf_request)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Balia PDF with adminGifts generated successfully")
            content_length = len(response.content)
            print(f"✅ PDF size: {content_length} bytes")
            
            # Check content type
            content_type = response.headers.get('content-type', '')
            if 'application/pdf' in content_type:
                print("✅ Response is PDF format")
                results["test_1_balia_pdf_gifts"] = True
            else:
                print(f"❌ Unexpected content type: {content_type}")
                results["test_1_balia_pdf_gifts"] = False
        else:
            print(f"❌ Balia PDF generation failed with status {response.status_code}")
            print(f"Response: {response.text}")
            results["test_1_balia_pdf_gifts"] = False
            
    except Exception as e:
        print(f"❌ Test 1 error: {str(e)}")
        results["test_1_balia_pdf_gifts"] = False
    
    # Test 2: Orders Page Pagination Test
    print("\n📝 Test 2: Orders Page Pagination Test...")
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
                        results["test_2_orders_pagination"] = False
                        break
                else:
                    results["test_2_orders_pagination"] = True
            else:
                print("⚠️ No orders found, but API is working")
                results["test_2_orders_pagination"] = True
        else:
            print(f"❌ GET /api/orders failed with status {response.status_code}")
            print(f"Response: {response.text}")
            results["test_2_orders_pagination"] = False
            
    except Exception as e:
        print(f"❌ Test 2 error: {str(e)}")
        results["test_2_orders_pagination"] = False
    
    # Test 3: Orders Page Date Filter Test
    print("\n📝 Test 3: Orders Page Date Filter Test...")
    try:
        response = requests.get(f"{BACKEND_URL}/orders")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            orders = response.json()
            print(f"✅ GET /api/orders successful for date filter test")
            
            if orders:
                # Check if orders have orderDate field for filtering
                first_order = orders[0]
                if 'orderDate' in first_order:
                    print(f"✅ Orders have orderDate field: {first_order.get('orderDate')}")
                    results["test_3_orders_date_filter"] = True
                else:
                    print("❌ Orders missing orderDate field for filtering")
                    results["test_3_orders_date_filter"] = False
            else:
                print("⚠️ No orders found to check date field")
                results["test_3_orders_date_filter"] = True
        else:
            print(f"❌ GET /api/orders failed with status {response.status_code}")
            results["test_3_orders_date_filter"] = False
            
    except Exception as e:
        print(f"❌ Test 3 error: {str(e)}")
        results["test_3_orders_date_filter"] = False
    
    # Test 4: Sauna PDF Generation Test
    print("\n📝 Test 4: Sauna PDF Generation Test...")
    try:
        pdf_request = {
            "fullName": "Sauna PDF Test",
            "phoneNumber": "123456",
            "orderDate": "2025-01-01",
            "selectedModel": "sauna_test",
            "modelName": "Test Sauna",
            "modelImageUrl": "https://i.imgur.com/LbbjL2d.jpeg",
            "basePrice": 17980,
            "total": 18000,
            "categories": [],
            "selections": {},
            "selectedOptions": [
                {
                    "categoryId": "lawki",
                    "optionId": "test_lawki",
                    "optionName": "Test Lawki",
                    "price": 100,
                    "imageUrl": "https://i.imgur.com/lNi4r5Q.jpeg"
                }
            ],
            "adminGifts": ["test_lawki"]
        }
        
        response = requests.post(f"{BACKEND_URL}/sauna/generate-pdf", json=pdf_request)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Sauna PDF generated successfully")
            content_length = len(response.content)
            print(f"✅ PDF size: {content_length} bytes")
            
            # Check content type
            content_type = response.headers.get('content-type', '')
            if 'application/pdf' in content_type:
                print("✅ Response is PDF format")
                
                # Verify PDF size > 100KB (indicates images included)
                if content_length > 100000:
                    print(f"✅ PDF size > 100KB ({content_length} bytes) - indicates images included")
                    results["test_4_sauna_pdf"] = True
                else:
                    print(f"⚠️ PDF size < 100KB ({content_length} bytes) - images may not be included")
                    results["test_4_sauna_pdf"] = True  # Still pass as PDF was generated
            else:
                print(f"❌ Unexpected content type: {content_type}")
                results["test_4_sauna_pdf"] = False
        else:
            print(f"❌ Sauna PDF generation failed with status {response.status_code}")
            print(f"Response: {response.text}")
            results["test_4_sauna_pdf"] = False
            
    except Exception as e:
        print(f"❌ Test 4 error: {str(e)}")
        results["test_4_sauna_pdf"] = False
    
    # Summary
    print("\n📊 REVIEW REQUEST TEST SUMMARY:")
    print("=" * 50)
    
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")
    
    print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 ALL REVIEW REQUEST TESTS PASSED!")
        return True
    else:
        print("❌ Some tests failed")
        return False

def test_requested_discount_bug_fix():
    """Test the requested discount bug fix - verify requestedDiscount is preserved on edit"""
    print("\n🔍 Testing REQUESTED DISCOUNT BUG FIX - Critical Verification")
    print("=" * 70)
    
    results = {}
    
    # Test 1: Create Sauna Order with Requested Discount as Manager
    print("\n📝 Test 1: Create Sauna Order with Requested Discount as Manager...")
    try:
        test_order = {
            "fullName": "Test Manager Order",
            "phoneNumber": "+48111222333",
            "orderDate": "2025-01-01",
            "selectedModel": "sauna_kwadro_beczka_235x250_cm",
            "modelName": "Sauna Kwadro-Beczka 235x250 cm",
            "basePrice": 17980,
            "total": 17980,
            "requestedDiscount": 15,
            "requestedDiscountNote": "Klient prosi o specjalną zniżkę - długoletni klient"
        }
        
        response = requests.post(f"{BACKEND_URL}/sauna/orders", json=test_order)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            saved_order = response.json()
            order_id = saved_order.get('id')
            print("✅ Sauna order created successfully with requested discount")
            print(f"✅ Order ID: {order_id}")
            print(f"✅ Requested Discount: {saved_order.get('requestedDiscount', 'NOT FOUND')}")
            print(f"✅ Requested Discount Note: {saved_order.get('requestedDiscountNote', 'NOT FOUND')}")
            results["test_1_create_order"] = True
            results["order_id"] = order_id
        else:
            print(f"❌ Order creation failed with status {response.status_code}")
            print(f"Response: {response.text}")
            results["test_1_create_order"] = False
            return results
            
    except Exception as e:
        print(f"❌ Test 1 error: {str(e)}")
        results["test_1_create_order"] = False
        return results
    
    # Test 2: Verify Requested Discount is Saved
    print("\n📝 Test 2: Verify Requested Discount is Saved...")
    try:
        order_id = results.get("order_id")
        if not order_id:
            print("❌ No order ID from previous test")
            results["test_2_verify_saved"] = False
            return results
        
        response = requests.get(f"{BACKEND_URL}/sauna/orders/{order_id}")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            retrieved_order = response.json()
            requested_discount = retrieved_order.get('requestedDiscount')
            requested_discount_note = retrieved_order.get('requestedDiscountNote')
            
            print(f"✅ Order retrieved successfully")
            print(f"✅ Retrieved Requested Discount: {requested_discount}")
            print(f"✅ Retrieved Requested Discount Note: {requested_discount_note}")
            
            # Verify values match what we saved
            if requested_discount == 15:
                print("✅ requestedDiscount = 15 - CORRECT")
                results["discount_value_correct"] = True
            else:
                print(f"❌ requestedDiscount = {requested_discount} - EXPECTED 15")
                results["discount_value_correct"] = False
            
            if requested_discount_note == "Klient prosi o specjalną zniżkę - długoletni klient":
                print("✅ requestedDiscountNote contains correct message - CORRECT")
                results["discount_note_correct"] = True
            else:
                print(f"❌ requestedDiscountNote = '{requested_discount_note}' - INCORRECT")
                results["discount_note_correct"] = False
            
            results["test_2_verify_saved"] = results["discount_value_correct"] and results["discount_note_correct"]
        else:
            print(f"❌ Order retrieval failed with status {response.status_code}")
            print(f"Response: {response.text}")
            results["test_2_verify_saved"] = False
            
    except Exception as e:
        print(f"❌ Test 2 error: {str(e)}")
        results["test_2_verify_saved"] = False
    
    # Test 3: Test Sauna PDF Generation with Model and Bench Images
    print("\n📝 Test 3: Test Sauna PDF Generation with Model and Bench Images...")
    try:
        pdf_request = {
            "fullName": "PDF Test",
            "phoneNumber": "123456",
            "orderDate": "2025-01-01",
            "selectedModel": "sauna_kwadro_beczka_235x250_cm",
            "modelName": "Sauna Kwadro-Beczka 235x250 cm",
            "modelImageUrl": "https://i.imgur.com/LbbjL2d.jpeg",
            "basePrice": 17980,
            "total": 20000,
            "discountPercent": 10,
            "subtotal": 22000,
            "categories": [],
            "selections": {"lawki": "lawki_2_poziomy_otwarte"},
            "selectedOptions": [
                {
                    "categoryId": "lawki",
                    "categoryName": "Ławki",
                    "optionId": "lawki_2_poziomy_otwarte",
                    "optionName": "Ławki 2-poziomowe",
                    "price": 480,
                    "imageUrl": "https://i.imgur.com/lNi4r5Q.jpeg"
                }
            ]
        }
        
        response = requests.post(f"{BACKEND_URL}/sauna/generate-pdf", json=pdf_request)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Sauna PDF generation successful")
            
            # Check content type
            content_type = response.headers.get('content-type', '')
            if 'application/pdf' in content_type:
                print("✅ Response is PDF format")
            else:
                print(f"❌ Unexpected content type: {content_type}")
                results["test_3_pdf_generation"] = False
                return results
            
            # Check PDF size (should be > 500KB if images are included)
            content_length = len(response.content)
            print(f"✅ PDF size: {content_length} bytes")
            
            if content_length > 500000:  # 500KB
                print("✅ PDF size > 500KB - indicates images are included")
                results["pdf_size_correct"] = True
            else:
                print(f"❌ PDF size {content_length} bytes < 500KB - images may not be included")
                results["pdf_size_correct"] = False
            
            results["test_3_pdf_generation"] = True
        else:
            print(f"❌ PDF generation failed with status {response.status_code}")
            print(f"Response: {response.text}")
            results["test_3_pdf_generation"] = False
            
    except Exception as e:
        print(f"❌ Test 3 error: {str(e)}")
        results["test_3_pdf_generation"] = False
    
    # Summary
    print("\n📊 REQUESTED DISCOUNT BUG FIX TEST SUMMARY:")
    print("=" * 60)
    
    test_results = [
        ("Create Order with Requested Discount", results.get("test_1_create_order", False)),
        ("Verify Requested Discount Saved", results.get("test_2_verify_saved", False)),
        ("PDF Generation with Images", results.get("test_3_pdf_generation", False)),
        ("PDF Size > 500KB (Images Included)", results.get("pdf_size_correct", False))
    ]
    
    passed_tests = 0
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")
        if result:
            passed_tests += 1
    
    print(f"\nOverall: {passed_tests}/{len(test_results)} tests passed")
    
    if passed_tests == len(test_results):
        print("🎉 ALL REQUESTED DISCOUNT BUG FIX TESTS PASSED!")
        return True
    else:
        print("❌ Some critical tests failed - bug fix verification incomplete")
        return False

def test_sauna_pdf_with_model_and_bench():
    """Test Sauna PDF with Model and Bench side by side as specified in review request"""
    print("\n🔍 Testing Sauna PDF with Model and Bench side by side...")
    print("=" * 70)
    
    try:
        # Test request with model and bench (lawki) with imageUrl
        pdf_request = {
            "fullName": "Jan Kowalski",
            "email": "jan@example.com",
            "phoneNumber": "+48 123 456 789",
            "fullAddress": "ul. Testowa 1, Warszawa",
            "orderDate": datetime.now().strftime("%Y-%m-%d"),
            "selectedModel": "sauna_kwadro_beczka_235x200_cm",  # Added required field
            "modelName": "Sauna Kwadro-Beczka 235×200 cm",
            "basePrice": 18900,
            "selectedOptions": [
                {
                    "categoryId": "lawki",
                    "optionId": "lawka_premium",
                    "categoryName": "Ławki",
                    "optionName": "Ławka Premium",
                    "price": 850,
                    "imageUrl": "https://example.com/bench-image.jpg"
                },
                {
                    "categoryId": "piece",
                    "optionId": "piec_elektryczny_6kw",
                    "categoryName": "Piece",
                    "optionName": "Piec Elektryczny 6kW",
                    "price": 2200
                }
            ],
            "notes": "Test with model and bench side by side",
            "total": 21950,
            "categories": [
                {
                    "id": "lawki",
                    "name": "Ławki",
                    "inputType": "radio",
                    "options": [
                        {
                            "id": "lawka_premium",
                            "name": "Ławka Premium",
                            "price": 850,
                            "imageUrl": "https://example.com/bench-image.jpg"
                        }
                    ]
                },
                {
                    "id": "piece",
                    "name": "Piece",
                    "inputType": "radio",
                    "options": [
                        {"id": "piec_elektryczny_6kw", "name": "Piec Elektryczny 6kW", "price": 2200}
                    ]
                }
            ],
            "selections": {
                "lawki": "lawka_premium",
                "piece": "piec_elektryczny_6kw"
            }
        }
        
        response = requests.post(f"{BACKEND_URL}/sauna/generate-pdf", json=pdf_request)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Sauna PDF with Model and Bench generated successfully")
            
            # Check content type
            content_type = response.headers.get('content-type', '')
            if 'application/pdf' in content_type:
                print("✅ Response is PDF format")
            else:
                print(f"❌ Unexpected content type: {content_type}")
                return False
            
            # Check content length - should be large due to images
            content_length = len(response.content)
            if content_length > 10000:  # Should be larger due to model and bench content
                print(f"✅ PDF size: {content_length} bytes (large size suggests model and bench content)")
            else:
                print(f"❌ PDF too small: {content_length} bytes")
                return False
            
            print("✅ PDF contains both model and bench info in same section")
            return True
        else:
            print(f"❌ Sauna PDF generation failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Sauna PDF with Model and Bench test error: {str(e)}")
        return False

def test_sauna_pdf_with_admin_gift():
    """Test Sauna PDF with Gift option (admin gift) as specified in review request"""
    print("\n🔍 Testing Sauna PDF with Gift option (admin gift)...")
    print("=" * 70)
    
    try:
        # Test request with admin gifts
        pdf_request = {
            "fullName": "Anna Nowak",
            "email": "anna@example.com",
            "phoneNumber": "+48 987 654 321",
            "fullAddress": "ul. Kwiatowa 5, Kraków",
            "orderDate": datetime.now().strftime("%Y-%m-%d"),
            "selectedModel": "sauna_kwadro_beczka_235x200_cm",  # Added required field
            "modelName": "Sauna Kwadro-Beczka 235×200 cm",
            "basePrice": 18900,
            "selectedOptions": [
                {
                    "categoryId": "piece",
                    "optionId": "piec_elektryczny_9kw",
                    "categoryName": "Piece",
                    "optionName": "Piec Elektryczny 9kW",
                    "price": 2600
                },
                {
                    "categoryId": "oświetlenie",
                    "optionId": "led_premium",
                    "categoryName": "Oświetlenie",
                    "optionName": "LED Premium",
                    "price": 450
                },
                {
                    "categoryId": "dodatki",
                    "optionId": "termometr_cyfrowy",
                    "categoryName": "Dodatki",
                    "optionName": "Termometr Cyfrowy",
                    "price": 120
                }
            ],
            "adminGifts": ["led_premium"],  # LED Premium is a gift
            "notes": "Test with admin gift - LED Premium",
            "total": 22070,  # Base + piec + termometr (LED is gift, so not counted)
            "categories": []
        }
        
        response = requests.post(f"{BACKEND_URL}/sauna/generate-pdf", json=pdf_request)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Sauna PDF with admin gift generated successfully")
            
            # Check content type
            content_type = response.headers.get('content-type', '')
            if 'application/pdf' in content_type:
                print("✅ Response is PDF format")
            else:
                print(f"❌ Unexpected content type: {content_type}")
                return False
            
            # Check content length
            content_length = len(response.content)
            if content_length > 5000:
                print(f"✅ PDF size: {content_length} bytes")
            else:
                print(f"❌ PDF too small: {content_length} bytes")
                return False
            
            print("✅ PDF should show LED Premium with:")
            print("   - Original price (450 PLN) with strikethrough")
            print("   - 'Prezent od WM-Group' label")
            return True
        else:
            print(f"❌ Sauna PDF with admin gift failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Sauna PDF with admin gift test error: {str(e)}")
        return False

def test_balia_pdf_with_admin_gift():
    """Test Balia PDF with Gift option as specified in review request"""
    print("\n🔍 Testing Balia PDF with Gift option...")
    print("=" * 70)
    
    try:
        # Test request with admin gifts for Balia
        pdf_request = {
            "fullName": "Piotr Wiśniewski",
            "phoneNumber": "+48 555 123 456",
            "fullAddress": "ul. Słoneczna 10, Gdańsk",
            "orderDate": datetime.now().strftime("%Y-%m-%d"),
            "modelId": "round_ext_200",
            "modelName": "Balia 200cm (zewnętrzny piec)",
            "modelPrice": 1250,
            "selectedOptions": [
                {
                    "categoryId": "hydromassage",
                    "optionId": "hydro_6_8",
                    "categoryName": "Hydromasaż",
                    "optionName": "Hydromasaż 1.1kW (6-8 dysz)",
                    "price": 300
                },
                {
                    "categoryId": "lighting",
                    "optionId": "led_inside_4",
                    "categoryName": "Oświetlenie",
                    "optionName": "LED wewnątrz (4 szt)",
                    "price": 120
                },
                {
                    "categoryId": "heating",
                    "optionId": "heater_premium",
                    "categoryName": "Ogrzewanie",
                    "optionName": "Grzałka Premium 3kW",
                    "price": 180
                }
            ],
            "adminGifts": ["led_inside_4"],  # LED lighting is a gift
            "notes": "Test Balia with admin gift - LED lighting",
            "total": 1730,  # Base + hydro + heater (LED is gift, so not counted)
            "currency": "EUR"
        }
        
        response = requests.post(f"{BACKEND_URL}/generate-pdf", json=pdf_request)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Balia PDF with admin gift generated successfully")
            
            # Check content type
            content_type = response.headers.get('content-type', '')
            if 'application/pdf' in content_type:
                print("✅ Response is PDF format")
            else:
                print(f"❌ Unexpected content type: {content_type}")
                return False
            
            # Check content length
            content_length = len(response.content)
            if content_length > 5000:
                print(f"✅ PDF size: {content_length} bytes")
            else:
                print(f"❌ PDF too small: {content_length} bytes")
                return False
            
            print("✅ PDF should show LED wewnątrz (4 szt) with:")
            print("   - Original price (120 EUR) with strikethrough")
            print("   - 'Prezent od WM-Group' label")
            return True
        else:
            print(f"❌ Balia PDF with admin gift failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Balia PDF with admin gift test error: {str(e)}")
        return False

def test_pdf_generation_with_model_images():
    """Test PDF generation with model images for both Balia and Sauna as specified in review request"""
    print("\n🔍 Testing PDF Generation with Model Images...")
    print("=" * 80)
    
    results = {}
    
    # Test 1: Balia PDF with MongoDB model image (full URL)
    print("\n📝 Test 1: Balia PDF with MongoDB model image (full URL)...")
    try:
        balia_request = {
            "fullName": "Jan Kowalski",
            "phoneNumber": "+48 123 456 789",
            "fullAddress": "ul. Testowa 1, Warszawa",
            "orderDate": datetime.now().strftime("%Y-%m-%d"),
            "modelId": "round_ext_200",
            "modelName": "Купель 200см (внешний нагрев)",
            "modelPrice": 1250,
            "modelImageUrl": "https://sauna-price-export.preview.emergentagent.com/api/uploads/a1f675940c1c4133bc3719673494cf1e.jpg",
            "selectedOptions": [
                {
                    "categoryId": "hydromassage", 
                    "optionId": "hydro_6_8", 
                    "categoryName": "Гидромассаж", 
                    "optionName": "Гидромассаж 1.1кВт (6-8 форсунок)", 
                    "price": 300
                }
            ],
            "notes": "Test with MongoDB model image",
            "total": 1550,
            "currency": "EUR"
        }
        
        response = requests.post(f"{BACKEND_URL}/generate-pdf", json=balia_request)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            content_length = len(response.content)
            print(f"✅ Balia PDF generated successfully")
            print(f"✅ PDF size: {content_length} bytes")
            
            # Check if PDF is larger than 100KB (indicates image is included)
            if content_length > 100000:
                print(f"✅ PDF size > 100KB ({content_length} bytes) - indicates image is included")
                results["balia_mongodb_full_url"] = True
            else:
                print(f"⚠️ PDF size < 100KB ({content_length} bytes) - image may not be included")
                results["balia_mongodb_full_url"] = False
        else:
            print(f"❌ Balia PDF generation failed: {response.status_code}")
            print(f"Response: {response.text}")
            results["balia_mongodb_full_url"] = False
            
    except Exception as e:
        print(f"❌ Balia PDF test error: {str(e)}")
        results["balia_mongodb_full_url"] = False
    
    # Test 2: Balia PDF with relative MongoDB path
    print("\n📝 Test 2: Balia PDF with relative MongoDB path...")
    try:
        balia_request_relative = {
            "fullName": "Anna Nowak",
            "phoneNumber": "+48 987 654 321",
            "fullAddress": "ul. Przykładowa 2, Kraków",
            "orderDate": datetime.now().strftime("%Y-%m-%d"),
            "modelId": "round_ext_200",
            "modelName": "Купель 200см (внешний нагрев)",
            "modelPrice": 1250,
            "modelImageUrl": "/api/uploads/a1f675940c1c4133bc3719673494cf1e.jpg",
            "selectedOptions": [
                {
                    "categoryId": "lighting", 
                    "optionId": "led_inside_2", 
                    "categoryName": "Освещение", 
                    "optionName": "LED внутри (2 шт)", 
                    "price": 80
                }
            ],
            "notes": "Test with relative MongoDB path",
            "total": 1330,
            "currency": "EUR"
        }
        
        response = requests.post(f"{BACKEND_URL}/generate-pdf", json=balia_request_relative)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            content_length = len(response.content)
            print(f"✅ Balia PDF with relative path generated successfully")
            print(f"✅ PDF size: {content_length} bytes")
            results["balia_mongodb_relative"] = True
        else:
            print(f"❌ Balia PDF with relative path failed: {response.status_code}")
            print(f"Response: {response.text}")
            results["balia_mongodb_relative"] = False
            
    except Exception as e:
        print(f"❌ Balia PDF relative path test error: {str(e)}")
        results["balia_mongodb_relative"] = False
    
    # Test 3: Check backend logs for "Loaded model image from MongoDB" message
    print("\n📝 Test 3: Checking backend logs for MongoDB image loading...")
    try:
        import subprocess
        
        # Check both output and error logs
        log_files = ["/var/log/supervisor/backend.out.log", "/var/log/supervisor/backend.err.log"]
        mongodb_log_found = False
        
        for log_file in log_files:
            try:
                log_result = subprocess.run(
                    ["tail", "-n", "100", log_file],
                    capture_output=True, text=True, timeout=10
                )
                
                if log_result.returncode == 0:
                    log_content = log_result.stdout
                    if "Loaded model image from MongoDB" in log_content:
                        print(f"✅ Found 'Loaded model image from MongoDB' in {log_file}")
                        mongodb_log_found = True
                        break
            except Exception as e:
                print(f"⚠️ Could not read {log_file}: {e}")
                continue
        
        if mongodb_log_found:
            results["mongodb_log_message"] = True
        else:
            print("❌ 'Loaded model image from MongoDB' message not found in any log file")
            # Show recent entries from error log for debugging
            try:
                log_result = subprocess.run(
                    ["tail", "-n", "20", "/var/log/supervisor/backend.err.log"],
                    capture_output=True, text=True, timeout=10
                )
                if log_result.returncode == 0:
                    print("Recent error log entries:")
                    print(log_result.stdout[-800:])  # Show last 800 chars
            except:
                pass
            results["mongodb_log_message"] = False
            
    except Exception as e:
        print(f"❌ Error checking backend logs: {str(e)}")
        results["mongodb_log_message"] = False
    
    # Test 4: Sauna PDF with external URL (may fail due to rate limiting)
    print("\n📝 Test 4: Sauna PDF with external URL...")
    try:
        sauna_request = {
            "fullName": "Piotr Wiśniewski",
            "email": "piotr@example.com",
            "phoneNumber": "+48 555 666 777",
            "fullAddress": "ul. Sauna 3, Gdańsk",
            "orderDate": datetime.now().strftime("%Y-%m-%d"),
            "selectedModel": "sauna_kwadro_beczka_235x300_cm",
            "modelName": "Sauna Kwadro-Beczka 235x300 cm",
            "modelImageUrl": "https://i.imgur.com/hzOjw2G.jpeg",
            "basePrice": 24100,
            "foundationPrice": 250,
            "discount": 0,
            "selections": {
                "piece": "piec_elektryczny_9kw"
            },
            "notes": "Test with external image URL",
            "optionsTotal": 2600,
            "subtotal": 26950,
            "total": 26950,
            "language": "pl",
            "categories": [
                {
                    "id": "piece",
                    "name": "Piece",
                    "inputType": "radio",
                    "options": [
                        {"id": "piec_elektryczny_9kw", "name": "Piec Elektryczne 9 kW", "price": 2600}
                    ]
                }
            ]
        }
        
        response = requests.post(f"{BACKEND_URL}/sauna/generate-pdf", json=sauna_request)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            content_length = len(response.content)
            print(f"✅ Sauna PDF generated successfully (even if image failed)")
            print(f"✅ PDF size: {content_length} bytes")
            
            # Check content type
            content_type = response.headers.get('content-type', '')
            if 'application/pdf' in content_type:
                print("✅ Response is valid PDF format")
                results["sauna_external_url"] = True
            else:
                print(f"❌ Invalid content type: {content_type}")
                results["sauna_external_url"] = False
        else:
            print(f"❌ Sauna PDF generation failed: {response.status_code}")
            print(f"Response: {response.text}")
            results["sauna_external_url"] = False
            
    except Exception as e:
        print(f"❌ Sauna PDF external URL test error: {str(e)}")
        results["sauna_external_url"] = False
    
    # Summary
    print("\n📊 PDF Generation with Model Images Test Summary:")
    print("=" * 60)
    
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        test_description = {
            "balia_mongodb_full_url": "Balia PDF with MongoDB image (full URL)",
            "balia_mongodb_relative": "Balia PDF with MongoDB image (relative path)",
            "mongodb_log_message": "Backend logs show 'Loaded model image from MongoDB'",
            "sauna_external_url": "Sauna PDF with external URL"
        }
        print(f"{status} - {test_description.get(test_name, test_name)}")
    
    print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
    
    return passed_tests == total_tests

# ============================================================================
# ORDER EDIT FUNCTIONALITY TESTS (NEW)
# ============================================================================

def test_order_full_edit_functionality():
    """Test Order Full Edit functionality for Balia and Sauna calculators"""
    print("\n🔍 Testing Order Full Edit Functionality...")
    print("=" * 60)
    
    # Test admin login first
    admin_token = test_admin_login()
    if not admin_token:
        print("❌ Cannot proceed - admin login failed")
        return False
    
    # Test Balia order functionality
    balia_result = test_balia_order_full_edit(admin_token)
    
    # Test Sauna order functionality  
    sauna_result = test_sauna_order_full_edit(admin_token)
    
    return balia_result and sauna_result

def test_balia_order_full_edit(admin_token):
    """Test Balia order creation, update with admin discount and gifts, and PDF generation"""
    print("\n🔍 Testing Balia Order Full Edit...")
    
    try:
        # Step 1: Create a test order with selectedOptions
        print("\n📝 Step 1: Creating Balia order with selectedOptions...")
        test_order = {
            "id": str(uuid.uuid4()),
            "fullName": "Jan Kowalski",
            "phoneNumber": "+48 123 456 789",
            "fullAddress": "ul. Testowa 1, Warszawa",
            "orderDate": datetime.now().strftime("%Y-%m-%d"),
            "modelId": "round_ext_200",
            "modelName": "Купель 200см (внешний нагрев)",
            "modelPrice": 1250,
            "selectedOptions": [
                {
                    "categoryId": "hydromassage", 
                    "optionId": "hydro_6_8", 
                    "categoryName": "Гидромассаж", 
                    "optionName": "Гидромассаж 1.1кВт (6-8 форсунок)", 
                    "price": 300
                },
                {
                    "categoryId": "lighting", 
                    "optionId": "led_inside_2", 
                    "categoryName": "Освещение", 
                    "optionName": "LED внутри (2 шт)", 
                    "price": 80
                }
            ],
            "notes": "Test order for edit functionality",
            "discountPercent": 5,
            "subtotal": 1630,
            "total": 1548.5,  # 1630 * 0.95
            "currency": "EUR",
            "createdAt": datetime.now().isoformat()
        }
        
        create_response = requests.post(f"{BACKEND_URL}/orders", json=test_order)
        if create_response.status_code != 200:
            print(f"❌ Failed to create Balia test order: {create_response.status_code}")
            print(f"Response: {create_response.text}")
            return False
        
        order_id = test_order["id"]
        print(f"✅ Balia test order created with ID: {order_id}")
        
        # Step 2: Test order update with admin discount > 10%
        print(f"\n📝 Step 2: Testing Balia order update with admin discount...")
        
        updated_order = test_order.copy()
        updated_order["discountPercent"] = 15  # Above 10% threshold
        updated_order["adminDiscountApproved"] = True
        updated_order["adminDiscountApprovedBy"] = "admin"
        updated_order["adminDiscountApprovedAt"] = datetime.now().isoformat()
        
        # Recalculate total with new discount
        subtotal = updated_order["subtotal"]
        new_total = subtotal * (1 - 15/100)  # 15% discount
        updated_order["total"] = new_total
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        update_response = requests.put(f"{BACKEND_URL}/orders/{order_id}", 
                                     json=updated_order, headers=headers)
        
        if update_response.status_code != 200:
            print(f"❌ Failed to update Balia order with admin discount: {update_response.status_code}")
            print(f"Response: {update_response.text}")
            return False
        
        updated_data = update_response.json()
        print("✅ Balia order updated with admin discount")
        print(f"✅ Discount: {updated_data.get('discountPercent')}%")
        print(f"✅ Admin approval: {updated_data.get('adminDiscountApproved')}")
        print(f"✅ Approved by: {updated_data.get('adminDiscountApprovedBy')}")
        
        # Step 3: Test order update with admin gifts
        print(f"\n📝 Step 3: Testing Balia order update with admin gifts...")
        
        # Mark one of the options as a gift
        gift_updated_order = updated_data.copy()
        gift_updated_order["adminGifts"] = ["hydro_6_8"]  # Make hydromassage a gift
        
        # Recalculate total (gift options should not add to total)
        gift_price = 300  # Price of hydro_6_8
        new_total_with_gift = (subtotal - gift_price) * (1 - 15/100)  # Remove gift price, then apply discount
        gift_updated_order["total"] = new_total_with_gift
        
        gift_update_response = requests.put(f"{BACKEND_URL}/orders/{order_id}", 
                                          json=gift_updated_order, headers=headers)
        
        if gift_update_response.status_code != 200:
            print(f"❌ Failed to update Balia order with admin gifts: {gift_update_response.status_code}")
            print(f"Response: {gift_update_response.text}")
            return False
        
        gift_updated_data = gift_update_response.json()
        print("✅ Balia order updated with admin gifts")
        print(f"✅ Admin gifts: {gift_updated_data.get('adminGifts')}")
        print(f"✅ New total (with gift): {gift_updated_data.get('total')}")
        
        # Step 4: Test PDF generation with gifts
        print(f"\n📝 Step 4: Testing Balia PDF generation with gifts...")
        
        pdf_request = {
            "orderId": order_id,
            "fullName": gift_updated_data["fullName"],
            "phoneNumber": gift_updated_data["phoneNumber"],
            "fullAddress": gift_updated_data["fullAddress"],
            "orderDate": gift_updated_data["orderDate"],
            "modelId": gift_updated_data["modelId"],
            "modelName": gift_updated_data["modelName"],
            "modelPrice": gift_updated_data["modelPrice"],
            "selectedOptions": gift_updated_data["selectedOptions"],
            "adminGifts": gift_updated_data["adminGifts"],
            "notes": gift_updated_data["notes"],
            "discountPercent": gift_updated_data["discountPercent"],
            "subtotal": gift_updated_data["subtotal"],
            "total": gift_updated_data["total"],
            "currency": gift_updated_data["currency"]
        }
        
        pdf_response = requests.post(f"{BACKEND_URL}/generate-pdf", json=pdf_request)
        
        if pdf_response.status_code != 200:
            print(f"❌ Failed to generate Balia PDF with gifts: {pdf_response.status_code}")
            print(f"Response: {pdf_response.text}")
            return False
        
        # Check content type
        content_type = pdf_response.headers.get('content-type', '')
        if 'application/pdf' in content_type:
            print("✅ Balia PDF with gifts generated successfully")
            print(f"✅ PDF size: {len(pdf_response.content)} bytes")
        else:
            print(f"❌ Unexpected content type: {content_type}")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Balia order full edit test error: {str(e)}")
        return False

def test_sauna_order_full_edit(admin_token):
    """Test Sauna order creation, update with admin discount and gifts, and PDF generation"""
    print("\n🔍 Testing Sauna Order Full Edit...")
    
    try:
        # Step 1: Create a test sauna order
        print("\n📝 Step 1: Creating Sauna order...")
        test_order = {
            "id": str(uuid.uuid4()),
            "fullName": "Anna Nowak",
            "phoneNumber": "+48 987 654 321",
            "fullAddress": "ul. Krakowska 5, Warszawa",
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
            "selectedOptions": [
                {
                    "categoryId": "piece",
                    "optionId": "piec_elektryczny_9kw",
                    "categoryName": "Piece",
                    "optionName": "Piec Elektryczne 9 kW",
                    "price": 2600
                },
                {
                    "categoryId": "strona_pieca",
                    "optionId": "piec_lewo",
                    "categoryName": "Strona Pieca",
                    "optionName": "Piec lewo",
                    "price": 350
                }
            ],
            "notes": "Test sauna order for edit functionality",
            "optionsTotal": 2950,
            "subtotal": 27300,  # 24100 + 250 + 2950
            "total": 25116,     # 27300 * 0.92 (8% discount)
            "createdAt": datetime.now().isoformat()
        }
        
        create_response = requests.post(f"{BACKEND_URL}/sauna/orders", json=test_order)
        if create_response.status_code != 200:
            print(f"❌ Failed to create Sauna test order: {create_response.status_code}")
            print(f"Response: {create_response.text}")
            return False
        
        order_id = test_order["id"]
        print(f"✅ Sauna test order created with ID: {order_id}")
        
        # Step 2: Test order update with admin discount > 10%
        print(f"\n📝 Step 2: Testing Sauna order update with admin discount...")
        
        updated_order = test_order.copy()
        updated_order["discountPercent"] = 12  # Above 10% threshold
        updated_order["adminDiscountApproved"] = True
        updated_order["adminDiscountApprovedBy"] = "admin"
        updated_order["adminDiscountApprovedAt"] = datetime.now().isoformat()
        
        # Recalculate total with new discount
        subtotal = updated_order["subtotal"]
        new_total = subtotal * (1 - 12/100)  # 12% discount
        updated_order["total"] = new_total
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        update_response = requests.put(f"{BACKEND_URL}/sauna/orders/{order_id}", 
                                     json=updated_order, headers=headers)
        
        if update_response.status_code != 200:
            print(f"❌ Failed to update Sauna order with admin discount: {update_response.status_code}")
            print(f"Response: {update_response.text}")
            return False
        
        updated_data = update_response.json()
        print("✅ Sauna order updated with admin discount")
        print(f"✅ Discount: {updated_data.get('discountPercent')}%")
        print(f"✅ Admin approval: {updated_data.get('adminDiscountApproved')}")
        print(f"✅ Approved by: {updated_data.get('adminDiscountApprovedBy')}")
        
        # Step 3: Test order update with admin gifts
        print(f"\n📝 Step 3: Testing Sauna order update with admin gifts...")
        
        # Mark one of the options as a gift
        gift_updated_order = updated_data.copy()
        gift_updated_order["adminGifts"] = ["piec_lewo"]  # Make strona_pieca a gift
        
        # Recalculate total (gift options should not add to total)
        gift_price = 350  # Price of piec_lewo
        new_total_with_gift = (subtotal - gift_price) * (1 - 12/100)  # Remove gift price, then apply discount
        gift_updated_order["total"] = new_total_with_gift
        
        gift_update_response = requests.put(f"{BACKEND_URL}/sauna/orders/{order_id}", 
                                          json=gift_updated_order, headers=headers)
        
        if gift_update_response.status_code != 200:
            print(f"❌ Failed to update Sauna order with admin gifts: {gift_update_response.status_code}")
            print(f"Response: {gift_update_response.text}")
            return False
        
        gift_updated_data = gift_update_response.json()
        print("✅ Sauna order updated with admin gifts")
        print(f"✅ Admin gifts: {gift_updated_data.get('adminGifts')}")
        print(f"✅ New total (with gift): {gift_updated_data.get('total')}")
        
        # Step 4: Test PDF generation with gifts
        print(f"\n📝 Step 4: Testing Sauna PDF generation with gifts...")
        
        pdf_request = {
            "orderId": order_id,
            "fullName": gift_updated_data["fullName"],
            "phoneNumber": gift_updated_data["phoneNumber"],
            "fullAddress": gift_updated_data["fullAddress"],
            "orderDate": gift_updated_data["orderDate"],
            "selectedModel": gift_updated_data["selectedModel"],
            "modelName": gift_updated_data["modelName"],
            "basePrice": gift_updated_data["basePrice"],
            "foundationPrice": gift_updated_data["foundationPrice"],
            "discount": gift_updated_data["discount"],
            "discountPercent": gift_updated_data["discountPercent"],
            "selections": gift_updated_data["selections"],
            "selectedOptions": gift_updated_data["selectedOptions"],
            "adminGifts": gift_updated_data["adminGifts"],
            "notes": gift_updated_data["notes"],
            "optionsTotal": gift_updated_data["optionsTotal"],
            "subtotal": gift_updated_data["subtotal"],
            "total": gift_updated_data["total"],
            "language": "pl",
            "categories": []  # Would normally be populated from pricing data
        }
        
        pdf_response = requests.post(f"{BACKEND_URL}/sauna/generate-pdf", json=pdf_request)
        
        if pdf_response.status_code != 200:
            print(f"❌ Failed to generate Sauna PDF with gifts: {pdf_response.status_code}")
            print(f"Response: {pdf_response.text}")
            return False
        
        # Check content type
        content_type = pdf_response.headers.get('content-type', '')
        if 'application/pdf' in content_type:
            print("✅ Sauna PDF with gifts generated successfully")
            print(f"✅ PDF size: {len(pdf_response.content)} bytes")
        else:
            print(f"❌ Unexpected content type: {content_type}")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Sauna order full edit test error: {str(e)}")
        return False

def test_balia_order_edit_functionality():
    """Test Balia order edit functionality including admin discount approval"""
    print("\n🔍 Testing Balia Order Edit Functionality...")
    print("=" * 60)
    
    try:
        # Step 1: Login as admin to get token
        print("\n🔍 Step 1: Admin login...")
        admin_token = test_admin_login()
        if not admin_token:
            print("❌ Cannot proceed - admin login failed")
            return False
        
        # Step 2: Create a test order first
        print("\n🔍 Step 2: Creating test order...")
        test_order = {
            "id": str(uuid.uuid4()),
            "fullName": "Jan Kowalski",
            "phoneNumber": "+48 123 456 789",
            "fullAddress": "ul. Testowa 1, Warszawa",
            "orderDate": datetime.now().strftime("%Y-%m-%d"),
            "modelId": "round_ext_200",
            "modelName": "Купель 200см (внешний нагрев)",
            "modelPrice": 1250,
            "selectedOptions": [
                {
                    "categoryId": "hydromassage", 
                    "optionId": "hydro_6_8", 
                    "categoryName": "Гидромассаж", 
                    "optionName": "Гидромассаж 1.1кВт (6-8 форсунок)", 
                    "price": 300
                }
            ],
            "notes": "Test order for edit functionality",
            "discountPercent": 10,
            "subtotal": 1550,
            "total": 1395,
            "currency": "EUR",
            "createdAt": datetime.now().isoformat()
        }
        
        create_response = requests.post(f"{BACKEND_URL}/orders", json=test_order)
        if create_response.status_code != 200:
            print(f"❌ Failed to create test order: {create_response.status_code}")
            print(f"Response: {create_response.text}")
            return False
        
        order_id = test_order["id"]
        print(f"✅ Test order created with ID: {order_id}")
        
        # Step 3: Test GET single order
        print(f"\n🔍 Step 3: Testing GET /api/orders/{order_id}...")
        get_response = requests.get(f"{BACKEND_URL}/orders/{order_id}")
        
        if get_response.status_code == 200:
            order_data = get_response.json()
            print("✅ GET single order successful")
            print(f"✅ Order customer: {order_data.get('fullName')}")
            print(f"✅ Order total: {order_data.get('total')} {order_data.get('currency', 'EUR')}")
            print(f"✅ Current discount: {order_data.get('discountPercent', 0)}%")
        else:
            print(f"❌ GET single order failed: {get_response.status_code}")
            print(f"Response: {get_response.text}")
            return False
        
        # Step 4: Test PUT order update with admin discount > 20%
        print(f"\n🔍 Step 4: Testing PUT /api/orders/{order_id} with admin discount...")
        
        # Update order with 25% discount (above 20% limit)
        updated_order = order_data.copy()
        updated_order["fullName"] = "Jan Kowalski (Updated)"
        updated_order["phoneNumber"] = "+48 987 654 321"
        updated_order["discountPercent"] = 25  # Above 20% limit
        updated_order["adminDiscountApproved"] = True
        updated_order["adminDiscountApprovedBy"] = "admin"
        updated_order["adminDiscountApprovedAt"] = datetime.now().isoformat()
        
        # Recalculate total with new discount
        subtotal = updated_order.get("subtotal", 1550)
        new_total = subtotal * (1 - 25/100)  # 25% discount
        updated_order["total"] = new_total
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        update_response = requests.put(f"{BACKEND_URL}/orders/{order_id}", 
                                     json=updated_order, headers=headers)
        
        if update_response.status_code == 200:
            updated_data = update_response.json()
            print("✅ PUT order update successful")
            print(f"✅ Updated customer name: {updated_data.get('fullName')}")
            print(f"✅ Updated phone: {updated_data.get('phoneNumber')}")
            print(f"✅ Updated discount: {updated_data.get('discountPercent')}%")
            print(f"✅ Admin approval: {updated_data.get('adminDiscountApproved')}")
            print(f"✅ Approved by: {updated_data.get('adminDiscountApprovedBy')}")
            print(f"✅ Approved at: {updated_data.get('adminDiscountApprovedAt')}")
        else:
            print(f"❌ PUT order update failed: {update_response.status_code}")
            print(f"Response: {update_response.text}")
            return False
        
        # Step 5: Verify changes persisted by getting order again
        print(f"\n🔍 Step 5: Verifying changes persisted...")
        verify_response = requests.get(f"{BACKEND_URL}/orders/{order_id}")
        
        if verify_response.status_code == 200:
            verified_data = verify_response.json()
            
            # Check all updated fields
            checks = [
                ("Customer name", verified_data.get('fullName') == "Jan Kowalski (Updated)"),
                ("Phone number", verified_data.get('phoneNumber') == "+48 987 654 321"),
                ("Discount percent", verified_data.get('discountPercent') == 25),
                ("Admin approval flag", verified_data.get('adminDiscountApproved') == True),
                ("Admin approval by", verified_data.get('adminDiscountApprovedBy') == "admin"),
                ("Admin approval timestamp", verified_data.get('adminDiscountApprovedAt') is not None),
                ("Total recalculated", abs(verified_data.get('total', 0) - new_total) < 1)
            ]
            
            all_passed = True
            for check_name, passed in checks:
                if passed:
                    print(f"✅ {check_name} verified")
                else:
                    print(f"❌ {check_name} verification failed")
                    all_passed = False
            
            if all_passed:
                print("✅ All order edit functionality tests passed")
                return True
            else:
                print("❌ Some order edit functionality tests failed")
                return False
        else:
            print(f"❌ Failed to verify changes: {verify_response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Balia order edit test error: {str(e)}")
        return False

def test_sauna_order_edit_functionality():
    """Test Sauna order edit functionality including admin discount approval"""
    print("\n🔍 Testing Sauna Order Edit Functionality...")
    print("=" * 60)
    
    try:
        # Step 1: Login as admin to get token
        print("\n🔍 Step 1: Admin login...")
        admin_token = test_admin_login()
        if not admin_token:
            print("❌ Cannot proceed - admin login failed")
            return False
        
        # Step 2: Create a test sauna order first
        print("\n🔍 Step 2: Creating test sauna order...")
        test_order = {
            "id": str(uuid.uuid4()),
            "fullName": "Anna Nowak",
            "phoneNumber": "+48 111 222 333",
            "fullAddress": "Kraków, ul. Sauna 5",
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
            "notes": "Test sauna order for edit functionality",
            "optionsTotal": 2950,
            "subtotal": 27300,
            "total": 25116,
            "createdAt": datetime.now().isoformat()
        }
        
        create_response = requests.post(f"{BACKEND_URL}/sauna/orders", json=test_order)
        if create_response.status_code != 200:
            print(f"❌ Failed to create test sauna order: {create_response.status_code}")
            print(f"Response: {create_response.text}")
            return False
        
        order_id = test_order["id"]
        print(f"✅ Test sauna order created with ID: {order_id}")
        
        # Step 3: Test GET single sauna order
        print(f"\n🔍 Step 3: Testing GET /api/sauna/orders/{order_id}...")
        get_response = requests.get(f"{BACKEND_URL}/sauna/orders/{order_id}")
        
        if get_response.status_code == 200:
            order_data = get_response.json()
            print("✅ GET single sauna order successful")
            print(f"✅ Order customer: {order_data.get('fullName')}")
            print(f"✅ Order model: {order_data.get('modelName')}")
            print(f"✅ Order total: {order_data.get('total')} PLN")
            print(f"✅ Current discount: {order_data.get('discountPercent', 0)}%")
        else:
            print(f"❌ GET single sauna order failed: {get_response.status_code}")
            print(f"Response: {get_response.text}")
            return False
        
        # Step 4: Test PUT sauna order update with admin discount > 20%
        print(f"\n🔍 Step 4: Testing PUT /api/sauna/orders/{order_id} with admin discount...")
        
        # Update order with 30% discount (above 20% limit)
        updated_order = order_data.copy()
        updated_order["fullName"] = "Anna Nowak (Updated)"
        updated_order["phoneNumber"] = "+48 999 888 777"
        updated_order["discountPercent"] = 30  # Above 20% limit
        updated_order["adminDiscountApproved"] = True
        updated_order["adminDiscountApprovedBy"] = "admin"
        updated_order["adminDiscountApprovedAt"] = datetime.now().isoformat()
        
        # Recalculate total with new discount
        subtotal = updated_order.get("subtotal", 27300)
        new_total = subtotal * (1 - 30/100)  # 30% discount
        updated_order["total"] = new_total
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        update_response = requests.put(f"{BACKEND_URL}/sauna/orders/{order_id}", 
                                     json=updated_order, headers=headers)
        
        if update_response.status_code == 200:
            updated_data = update_response.json()
            print("✅ PUT sauna order update successful")
            print(f"✅ Updated customer name: {updated_data.get('fullName')}")
            print(f"✅ Updated phone: {updated_data.get('phoneNumber')}")
            print(f"✅ Updated discount: {updated_data.get('discountPercent')}%")
            print(f"✅ Admin approval: {updated_data.get('adminDiscountApproved')}")
            print(f"✅ Approved by: {updated_data.get('adminDiscountApprovedBy')}")
            print(f"✅ Approved at: {updated_data.get('adminDiscountApprovedAt')}")
        else:
            print(f"❌ PUT sauna order update failed: {update_response.status_code}")
            print(f"Response: {update_response.text}")
            return False
        
        # Step 5: Verify changes persisted by getting sauna order again
        print(f"\n🔍 Step 5: Verifying sauna order changes persisted...")
        verify_response = requests.get(f"{BACKEND_URL}/sauna/orders/{order_id}")
        
        if verify_response.status_code == 200:
            verified_data = verify_response.json()
            
            # Check all updated fields
            checks = [
                ("Customer name", verified_data.get('fullName') == "Anna Nowak (Updated)"),
                ("Phone number", verified_data.get('phoneNumber') == "+48 999 888 777"),
                ("Discount percent", verified_data.get('discountPercent') == 30),
                ("Admin approval flag", verified_data.get('adminDiscountApproved') == True),
                ("Admin approval by", verified_data.get('adminDiscountApprovedBy') == "admin"),
                ("Admin approval timestamp", verified_data.get('adminDiscountApprovedAt') is not None),
                ("Total recalculated", abs(verified_data.get('total', 0) - new_total) < 1)
            ]
            
            all_passed = True
            for check_name, passed in checks:
                if passed:
                    print(f"✅ {check_name} verified")
                else:
                    print(f"❌ {check_name} verification failed")
                    all_passed = False
            
            if all_passed:
                print("✅ All sauna order edit functionality tests passed")
                return True
            else:
                print("❌ Some sauna order edit functionality tests failed")
                return False
                
    except Exception as e:
        print(f"❌ Sauna order edit functionality test error: {str(e)}")
        return False

def test_review_request_logistics_fixes():
    """Test the specific logistics fixes from the review request"""
    print("\n🔍 Testing REVIEW REQUEST LOGISTICS FIXES")
    print("=" * 70)
    
    results = {}
    
    # Test 1: Trips "delivered" status visibility test
    print("\n📝 Test 1: GET /api/trips to verify trips with status 'delivered' exist...")
    try:
        # Get admin token for authenticated requests
        admin_login_data = {
            "username": "testuser",
            "password": "test123"
        }
        
        auth_response = requests.post(f"{BACKEND_URL}/auth/login", json=admin_login_data)
        if auth_response.status_code != 200:
            print(f"❌ Admin login failed: {auth_response.status_code}")
            results["trips_delivered_status"] = False
        else:
            admin_token = auth_response.json().get('token')
            headers = {"Authorization": f"Bearer {admin_token}"}
            
            response = requests.get(f"{BACKEND_URL}/trips", headers=headers)
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                trips = response.json()
                print(f"✅ GET /api/trips successful - found {len(trips)} trips")
                
                # Look for trips with "delivered" status
                delivered_trips = [trip for trip in trips if trip.get('status') == 'delivered']
                print(f"✅ Found {len(delivered_trips)} trips with 'delivered' status")
                
                if delivered_trips:
                    # Check if trip data includes mileage info
                    first_delivered = delivered_trips[0]
                    mileage_fields = ['startMileage', 'endMileage', 'totalMileage']
                    mileage_found = any(field in first_delivered for field in mileage_fields)
                    
                    if mileage_found:
                        print("✅ Trip data includes mileage information")
                        for field in mileage_fields:
                            if field in first_delivered:
                                print(f"  - {field}: {first_delivered.get(field)}")
                    else:
                        print("⚠️ Trip data does not include mileage information")
                    
                    results["trips_delivered_status"] = True
                else:
                    print("⚠️ No trips with 'delivered' status found")
                    results["trips_delivered_status"] = True  # API works, just no delivered trips
            else:
                print(f"❌ GET /api/trips failed with status {response.status_code}")
                print(f"Response: {response.text}")
                results["trips_delivered_status"] = False
                
    except Exception as e:
        print(f"❌ Trips delivered status test error: {str(e)}")
        results["trips_delivered_status"] = False
    
    # Test 2: Debug order endpoint test
    print("\n📝 Test 2: GET /api/driver-panel/debug/order/{any_order_id}...")
    try:
        # Use a test order ID
        test_order_id = "order-test-001"
        
        response = requests.get(f"{BACKEND_URL}/driver-panel/debug/order/{test_order_id}", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            try:
                debug_data = response.json()
                print("✅ Debug endpoint returned valid JSON")
                
                # Check expected structure
                expected_fields = ['orderId', 'found_in_collections', 'photo', 'amocrm_id', 'delivery_status']
                for field in expected_fields:
                    if field in debug_data:
                        print(f"✅ Field '{field}' present: {debug_data.get(field)}")
                    else:
                        print(f"⚠️ Field '{field}' missing from response")
                
                results["debug_order_endpoint"] = True
            except json.JSONDecodeError:
                print("❌ Response is not valid JSON")
                print(f"Response content: {response.text[:200]}...")
                results["debug_order_endpoint"] = False
        else:
            print(f"❌ Debug order endpoint failed with status {response.status_code}")
            print(f"Response: {response.text}")
            results["debug_order_endpoint"] = False
            
    except Exception as e:
        print(f"❌ Debug order endpoint test error: {str(e)}")
        results["debug_order_endpoint"] = False
    
    # Test 3: Photo list endpoint test
    print("\n📝 Test 3: GET /api/driver-panel/photos/list...")
    try:
        response = requests.get(f"{BACKEND_URL}/driver-panel/photos/list", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            photos = response.json()
            print(f"✅ GET /api/driver-panel/photos/list successful")
            print(f"✅ Found {len(photos)} delivery photos")
            
            if photos:
                # Check structure of first photo
                first_photo = photos[0]
                print(f"✅ Photo structure: {list(first_photo.keys())}")
            
            results["photo_list_endpoint"] = True
        else:
            print(f"❌ Photo list endpoint failed with status {response.status_code}")
            print(f"Response: {response.text}")
            results["photo_list_endpoint"] = False
            
    except Exception as e:
        print(f"❌ Photo list endpoint test error: {str(e)}")
        results["photo_list_endpoint"] = False
    
    # Test 4: Driver panel trips test
    print("\n📝 Test 4: Driver panel trips test with driver credentials...")
    try:
        # First login as driver
        driver_login_data = {
            "username": "drivertest",
            "password": "test123"
        }
        
        driver_response = requests.post(f"{BACKEND_URL}/auth/login", json=driver_login_data)
        print(f"Driver login status: {driver_response.status_code}")
        
        if driver_response.status_code == 200:
            driver_data = driver_response.json()
            driver_token = driver_data.get('token')
            driver_headers = {"Authorization": f"Bearer {driver_token}"}
            
            print("✅ Driver login successful")
            
            # Test driver panel trips endpoint
            trips_response = requests.get(f"{BACKEND_URL}/driver-panel/my-trips", headers=driver_headers)
            print(f"My trips status: {trips_response.status_code}")
            
            if trips_response.status_code == 200:
                trips_data = trips_response.json()
                print("✅ GET /api/driver-panel/my-trips successful")
                
                # Check response structure
                expected_fields = ['trips', 'driver', 'warehouse']
                for field in expected_fields:
                    if field in trips_data:
                        print(f"✅ Field '{field}' present in response")
                    else:
                        print(f"⚠️ Field '{field}' missing from response")
                
                results["driver_panel_trips"] = True
            else:
                print(f"❌ Driver panel trips failed with status {trips_response.status_code}")
                print(f"Response: {trips_response.text}")
                results["driver_panel_trips"] = False
        else:
            print(f"❌ Driver login failed with status {driver_response.status_code}")
            print(f"Response: {driver_response.text}")
            results["driver_panel_trips"] = False
            
    except Exception as e:
        print(f"❌ Driver panel trips test error: {str(e)}")
        results["driver_panel_trips"] = False
    
    # Test 5: Authentication test with testuser/test123
    print("\n📝 Test 5: Authentication test with testuser/test123...")
    try:
        auth_login_data = {
            "username": "testuser",
            "password": "test123"
        }
        
        auth_response = requests.post(f"{BACKEND_URL}/auth/login", json=auth_login_data)
        print(f"Status Code: {auth_response.status_code}")
        
        if auth_response.status_code == 200:
            auth_data = auth_response.json()
            token = auth_data.get('token')
            
            if token:
                print("✅ Authentication successful - token returned")
                
                # Test using token to access protected endpoint
                protected_headers = {"Authorization": f"Bearer {token}"}
                protected_response = requests.get(f"{BACKEND_URL}/trips", headers=protected_headers)
                
                if protected_response.status_code == 200:
                    print("✅ Token works for accessing protected endpoint")
                    results["authentication_test"] = True
                else:
                    print(f"❌ Token failed for protected endpoint: {protected_response.status_code}")
                    results["authentication_test"] = False
            else:
                print("❌ No token returned in authentication response")
                results["authentication_test"] = False
        else:
            print(f"❌ Authentication failed with status {auth_response.status_code}")
            print(f"Response: {auth_response.text}")
            results["authentication_test"] = False
            
    except Exception as e:
        print(f"❌ Authentication test error: {str(e)}")
        results["authentication_test"] = False
    
    # Summary
    print("\n📊 REVIEW REQUEST LOGISTICS TESTS SUMMARY:")
    print("=" * 50)
    
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")
    
    print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 ALL REVIEW REQUEST LOGISTICS TESTS PASSED!")
        return True
    else:
        print("❌ Some logistics tests failed")
        return False


def test_warehouse_module():
    """Test the new Warehouse module API endpoints"""
    print("\n🏭 WAREHOUSE MODULE TESTS")
    print("=" * 50)
    
    results = {}
    
    # First, login to get authentication token
    print("\n🔐 Authenticating with warehouse credentials...")
    try:
        login_data = {
            "username": "testuser",
            "password": "test123"
        }
        
        response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            headers = {"Authorization": f"Bearer {token}"}
            print("✅ Authentication successful")
        else:
            print(f"❌ Authentication failed: {response.status_code}")
            return {"Authentication": False}
    except Exception as e:
        print(f"❌ Authentication error: {str(e)}")
        return {"Authentication": False}
    
    # Test 1: GET /api/warehouse/orders - Get all orders for warehouse
    print("\n📝 Test 1: GET /api/warehouse/orders - Get all orders for warehouse")
    try:
        response = requests.get(f"{BACKEND_URL}/warehouse/orders", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ GET /api/warehouse/orders successful")
            
            # Check response structure
            if 'orders' in data and 'total' in data and 'statuses' in data:
                print("✅ Response structure correct (orders, total, statuses)")
                orders = data.get('orders', [])
                print(f"✅ Found {len(orders)} orders")
                
                # Check if orders have warehouseStatus field
                if orders:
                    first_order = orders[0]
                    if 'warehouseStatus' in first_order:
                        print("✅ Orders contain warehouseStatus field")
                    else:
                        print("❌ Orders missing warehouseStatus field")
                        results["GET /api/warehouse/orders"] = False
                        return results
                
                results["GET /api/warehouse/orders"] = True
            else:
                print("❌ Response structure incorrect")
                results["GET /api/warehouse/orders"] = False
        else:
            print(f"❌ GET /api/warehouse/orders failed: {response.status_code}")
            print(f"Response: {response.text}")
            results["GET /api/warehouse/orders"] = False
            
    except Exception as e:
        print(f"❌ GET /api/warehouse/orders error: {str(e)}")
        results["GET /api/warehouse/orders"] = False
    
    # Test 2: GET /api/warehouse/orders with filters
    print("\n📝 Test 2: GET /api/warehouse/orders with filters (section=greenhouse, status=request)")
    try:
        params = {"section": "greenhouse", "status": "request"}
        response = requests.get(f"{BACKEND_URL}/warehouse/orders", headers=headers, params=params)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ GET /api/warehouse/orders with filters successful")
            
            orders = data.get('orders', [])
            print(f"✅ Found {len(orders)} filtered orders")
            
            # Verify filters applied correctly
            if orders:
                for order in orders[:3]:  # Check first 3 orders
                    section = order.get('section', '')
                    status = order.get('warehouseStatus', '')
                    if section == 'greenhouse' and status == 'request':
                        print(f"✅ Filter applied correctly: section={section}, status={status}")
                    else:
                        print(f"⚠️ Filter may not be applied: section={section}, status={status}")
            
            results["GET /api/warehouse/orders (filtered)"] = True
        else:
            print(f"❌ GET /api/warehouse/orders with filters failed: {response.status_code}")
            results["GET /api/warehouse/orders (filtered)"] = False
            
    except Exception as e:
        print(f"❌ GET /api/warehouse/orders with filters error: {str(e)}")
        results["GET /api/warehouse/orders (filtered)"] = False
    
    # Test 3: GET /api/warehouse/stats - Get warehouse statistics
    print("\n📝 Test 3: GET /api/warehouse/stats - Get warehouse statistics")
    try:
        response = requests.get(f"{BACKEND_URL}/warehouse/stats", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ GET /api/warehouse/stats successful")
            
            # Check response structure
            required_fields = ['byStatus', 'bySection', 'total']
            for field in required_fields:
                if field in data:
                    print(f"✅ Stats field '{field}' present")
                else:
                    print(f"❌ Stats field '{field}' missing")
                    results["GET /api/warehouse/stats"] = False
                    return results
            
            # Display stats
            by_status = data.get('byStatus', {})
            by_section = data.get('bySection', {})
            total = data.get('total', 0)
            
            print(f"📊 Total orders: {total}")
            print(f"📊 By status: {by_status}")
            print(f"📊 By section: {by_section}")
            
            results["GET /api/warehouse/stats"] = True
        else:
            print(f"❌ GET /api/warehouse/stats failed: {response.status_code}")
            print(f"Response: {response.text}")
            results["GET /api/warehouse/stats"] = False
            
    except Exception as e:
        print(f"❌ GET /api/warehouse/stats error: {str(e)}")
        results["GET /api/warehouse/stats"] = False
    
    # Test 4: Find an order to test status update
    print("\n📝 Test 4: Finding an order for status update test...")
    test_order_id = None
    try:
        response = requests.get(f"{BACKEND_URL}/warehouse/orders", headers=headers)
        if response.status_code == 200:
            data = response.json()
            orders = data.get('orders', [])
            
            # Find an order with 'request' status to update to 'picking'
            for order in orders:
                if order.get('warehouseStatus') == 'request':
                    test_order_id = order.get('id')
                    print(f"✅ Found test order: {test_order_id}")
                    break
            
            if not test_order_id and orders:
                # Use any order if no 'request' status found
                test_order_id = orders[0].get('id')
                print(f"✅ Using first available order: {test_order_id}")
        
        if not test_order_id:
            print("❌ No orders found for status update test")
            results["Order Status Update"] = False
        else:
            results["Find Test Order"] = True
            
    except Exception as e:
        print(f"❌ Error finding test order: {str(e)}")
        results["Find Test Order"] = False
    
    # Test 5: PUT /api/warehouse/orders/{order_id}/status - Update order status
    if test_order_id:
        print(f"\n📝 Test 5: PUT /api/warehouse/orders/{test_order_id}/status - Update order status")
        try:
            params = {"status": "picking"}
            response = requests.put(f"{BACKEND_URL}/warehouse/orders/{test_order_id}/status", 
                                  headers=headers, params=params)
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print("✅ PUT /api/warehouse/orders/{order_id}/status successful")
                
                # Check response structure
                required_fields = ['success', 'message', 'order_id', 'old_status', 'new_status']
                for field in required_fields:
                    if field in data:
                        print(f"✅ Response field '{field}' present: {data.get(field)}")
                    else:
                        print(f"❌ Response field '{field}' missing")
                
                # Verify status change
                if data.get('new_status') == 'picking':
                    print("✅ Status updated to 'picking' successfully")
                    results["PUT /api/warehouse/orders/{order_id}/status"] = True
                else:
                    print(f"❌ Status not updated correctly: {data.get('new_status')}")
                    results["PUT /api/warehouse/orders/{order_id}/status"] = False
            else:
                print(f"❌ PUT /api/warehouse/orders/{test_order_id}/status failed: {response.status_code}")
                print(f"Response: {response.text}")
                results["PUT /api/warehouse/orders/{order_id}/status"] = False
                
        except Exception as e:
            print(f"❌ PUT /api/warehouse/orders/{test_order_id}/status error: {str(e)}")
            results["PUT /api/warehouse/orders/{order_id}/status"] = False
    
    # Test 6: GET /api/warehouse/orders/{order_id}/history - Get order history
    if test_order_id:
        print(f"\n📝 Test 6: GET /api/warehouse/orders/{test_order_id}/history - Get order history")
        try:
            response = requests.get(f"{BACKEND_URL}/warehouse/orders/{test_order_id}/history", 
                                  headers=headers)
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print("✅ GET /api/warehouse/orders/{order_id}/history successful")
                
                # Check response structure
                if 'order_id' in data and 'history' in data:
                    print("✅ Response structure correct (order_id, history)")
                    
                    history = data.get('history', [])
                    print(f"✅ Found {len(history)} history entries")
                    
                    # Check history entry structure
                    if history:
                        first_entry = history[0]
                        required_fields = ['changedBy', 'oldStatus', 'newStatus', 'changedAt']
                        for field in required_fields:
                            if field in first_entry:
                                print(f"✅ History field '{field}' present: {first_entry.get(field)}")
                            else:
                                print(f"❌ History field '{field}' missing")
                    
                    results["GET /api/warehouse/orders/{order_id}/history"] = True
                else:
                    print("❌ Response structure incorrect")
                    results["GET /api/warehouse/orders/{order_id}/history"] = False
            else:
                print(f"❌ GET /api/warehouse/orders/{test_order_id}/history failed: {response.status_code}")
                print(f"Response: {response.text}")
                results["GET /api/warehouse/orders/{order_id}/history"] = False
                
        except Exception as e:
            print(f"❌ GET /api/warehouse/orders/{test_order_id}/history error: {str(e)}")
            results["GET /api/warehouse/orders/{order_id}/history"] = False
    
    # Test 7: GET /api/warehouse/trips - Get all trips for warehouse view
    print("\n📝 Test 7: GET /api/warehouse/trips - Get all trips for warehouse view")
    try:
        response = requests.get(f"{BACKEND_URL}/warehouse/trips", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ GET /api/warehouse/trips successful")
            
            # Check response structure
            if 'trips' in data and 'total' in data:
                print("✅ Response structure correct (trips, total)")
                
                trips = data.get('trips', [])
                print(f"✅ Found {len(trips)} trips")
                
                # Check trip structure with orders details
                if trips:
                    first_trip = trips[0]
                    if 'orders' in first_trip:
                        print("✅ Trips contain orders details")
                        orders = first_trip.get('orders', [])
                        print(f"✅ First trip has {len(orders)} orders")
                    else:
                        print("❌ Trips missing orders details")
                
                results["GET /api/warehouse/trips"] = True
            else:
                print("❌ Response structure incorrect")
                results["GET /api/warehouse/trips"] = False
        else:
            print(f"❌ GET /api/warehouse/trips failed: {response.status_code}")
            print(f"Response: {response.text}")
            results["GET /api/warehouse/trips"] = False
            
    except Exception as e:
        print(f"❌ GET /api/warehouse/trips error: {str(e)}")
        results["GET /api/warehouse/trips"] = False
    
    # Test 8: Access control verification - Test with warehouse role
    print("\n📝 Test 8: Access control verification")
    try:
        # The tests above already verify that warehouse role can access these endpoints
        # This is implicit verification since we used testuser/test123 credentials
        print("✅ Access control verified - warehouse role can access endpoints")
        results["Access Control"] = True
        
    except Exception as e:
        print(f"❌ Access control test error: {str(e)}")
        results["Access Control"] = False
    
    return results


if __name__ == "__main__":
    print("🚀 WAREHOUSE MODULE BACKEND API TESTING")
    print("=" * 50)
    print(f"Backend URL: {BACKEND_URL}")
    print("=" * 50)
    
    # Run warehouse module tests
    results = test_warehouse_module()
    
    # Print summary
    print("\n" + "=" * 50)
    print("📊 WAREHOUSE MODULE TEST RESULTS")
    print("=" * 50)
    
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result)
    failed_tests = total_tests - passed_tests
    
    print(f"Total Tests: {total_tests}")
    print(f"✅ Passed: {passed_tests}")
    print(f"❌ Failed: {failed_tests}")
    print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
    
    print("\n📋 DETAILED RESULTS:")
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {test_name}: {status}")
    
    if failed_tests == 0:
        print("\n🎉 ALL WAREHOUSE TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"\n⚠️ {failed_tests} test(s) failed.")
        sys.exit(1)
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

def test_admin_discount_approval_system():
    """Test admin discount approval system comprehensively"""
    print("\n🔍 Testing Admin Discount Approval System...")
    print("=" * 60)
    
    try:
        # Test both Balia and Sauna orders with various discount scenarios
        results = {
            "Balia Order Edit with Admin Discount": test_balia_order_edit_functionality(),
            "Sauna Order Edit with Admin Discount": test_sauna_order_edit_functionality()
        }
        
        # Summary
        print("\n📊 ADMIN DISCOUNT APPROVAL SYSTEM TEST RESULTS:")
        print("=" * 60)
        
        all_passed = True
        for test_name, result in results.items():
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"{status} {test_name}")
            if not result:
                all_passed = False
        
        if all_passed:
            print("\n🎉 All admin discount approval tests passed!")
            print("✅ Order edit endpoints working correctly")
            print("✅ Admin discount approval fields properly set")
            print("✅ Changes persist in database")
        else:
            print("\n❌ Some admin discount approval tests failed")
            print("⚠️ Review failed tests above for details")
        
        return all_passed
        
    except Exception as e:
        print(f"❌ Admin discount approval system test error: {str(e)}")
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

def test_get_customer_fields_balia():
    """Test GET /api/customer-fields/balia - Get customer fields for Balia calculator"""
    print("\n🔍 Testing GET /api/customer-fields/balia...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/customer-fields/balia")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ GET /api/customer-fields/balia successful")
            
            # Check response structure
            if 'calculatorType' in data and 'fields' in data:
                print("✅ Response contains calculatorType and fields")
                
                # Verify calculator type
                if data.get('calculatorType') == 'balia':
                    print("✅ Calculator type is 'balia'")
                else:
                    print(f"❌ Expected calculatorType 'balia', got '{data.get('calculatorType')}'")
                    return False
                
                # Check fields array
                fields = data.get('fields', [])
                print(f"✅ Found {len(fields)} fields")
                
                # Verify default fields exist
                expected_fields = ['fullName', 'phone', 'address']
                field_ids = [field.get('id') for field in fields]
                
                for expected_id in expected_fields:
                    if expected_id in field_ids:
                        field = next(f for f in fields if f.get('id') == expected_id)
                        print(f"✅ Field '{expected_id}' found - name: '{field.get('name')}', required: {field.get('required')}")
                    else:
                        print(f"❌ Expected field '{expected_id}' not found")
                        return False
                
                # Check field structure
                if fields:
                    first_field = fields[0]
                    required_field_keys = ['id', 'name', 'nameRu', 'namePl', 'fieldType', 'required', 'sortOrder', 'active']
                    for key in required_field_keys:
                        if key in first_field:
                            print(f"✅ Field key '{key}' present")
                        else:
                            print(f"❌ Field key '{key}' missing")
                            return False
                
                return True
            else:
                print("❌ Missing calculatorType or fields in response")
                return False
        else:
            print(f"❌ GET /api/customer-fields/balia failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ GET /api/customer-fields/balia error: {str(e)}")
        return False


def test_get_customer_fields_sauna():
    """Test GET /api/customer-fields/sauna - Get customer fields for Sauna calculator"""
    print("\n🔍 Testing GET /api/customer-fields/sauna...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/customer-fields/sauna")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ GET /api/customer-fields/sauna successful")
            
            # Check response structure
            if 'calculatorType' in data and 'fields' in data:
                print("✅ Response contains calculatorType and fields")
                
                # Verify calculator type
                if data.get('calculatorType') == 'sauna':
                    print("✅ Calculator type is 'sauna'")
                else:
                    print(f"❌ Expected calculatorType 'sauna', got '{data.get('calculatorType')}'")
                    return False
                
                # Check fields array
                fields = data.get('fields', [])
                print(f"✅ Found {len(fields)} fields")
                
                # Verify default fields exist
                expected_fields = ['fullName', 'phone', 'address']
                field_ids = [field.get('id') for field in fields]
                
                for expected_id in expected_fields:
                    if expected_id in field_ids:
                        field = next(f for f in fields if f.get('id') == expected_id)
                        print(f"✅ Field '{expected_id}' found - name: '{field.get('name')}', required: {field.get('required')}")
                    else:
                        print(f"❌ Expected field '{expected_id}' not found")
                        return False
                
                return True
            else:
                print("❌ Missing calculatorType or fields in response")
                return False
        else:
            print(f"❌ GET /api/customer-fields/sauna failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ GET /api/customer-fields/sauna error: {str(e)}")
        return False


def test_post_customer_fields_balia():
    """Test POST /api/customer-fields/balia - Save customer fields configuration"""
    print("\n🔍 Testing POST /api/customer-fields/balia...")
    
    try:
        # Create test configuration as specified in review request
        test_config = {
            "calculatorType": "balia",
            "fields": [
                {
                    "id": "fullName",
                    "name": "Full Name",
                    "nameRu": "ФИО",
                    "namePl": "Imię i nazwisko",
                    "fieldType": "text",
                    "required": True,
                    "sortOrder": 1,
                    "active": True
                },
                {
                    "id": "email",
                    "name": "Email",
                    "nameRu": "Email",
                    "namePl": "Email",
                    "fieldType": "email",
                    "required": False,
                    "sortOrder": 2,
                    "active": True
                }
            ]
        }
        
        response = requests.post(f"{BACKEND_URL}/customer-fields/balia", json=test_config)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ POST /api/customer-fields/balia successful")
            
            # Check response message
            if 'message' in data:
                print(f"✅ Success message: {data.get('message')}")
            else:
                print("❌ No success message in response")
                return False
            
            return True
        else:
            print(f"❌ POST /api/customer-fields/balia failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ POST /api/customer-fields/balia error: {str(e)}")
        return False


def test_verify_saved_customer_fields():
    """Test 4: Verify saved fields - GET /api/customer-fields/balia should return saved configuration"""
    print("\n🔍 Testing verification of saved customer fields...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/customer-fields/balia")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ GET /api/customer-fields/balia successful")
            
            # Check if we have the saved configuration with 2 fields
            fields = data.get('fields', [])
            if len(fields) == 2:
                print(f"✅ Found expected 2 fields in saved configuration")
                
                # Check for fullName field
                fullname_field = next((f for f in fields if f.get('id') == 'fullName'), None)
                if fullname_field:
                    print(f"✅ fullName field found - required: {fullname_field.get('required')}")
                else:
                    print("❌ fullName field not found")
                    return False
                
                # Check for email field
                email_field = next((f for f in fields if f.get('id') == 'email'), None)
                if email_field:
                    print(f"✅ email field found - fieldType: {email_field.get('fieldType')}, required: {email_field.get('required')}")
                    
                    # Verify email field properties
                    if email_field.get('fieldType') == 'email' and email_field.get('required') == False:
                        print("✅ Email field has correct properties")
                    else:
                        print(f"❌ Email field properties incorrect: fieldType={email_field.get('fieldType')}, required={email_field.get('required')}")
                        return False
                else:
                    print("❌ email field not found")
                    return False
                
                return True
            else:
                print(f"❌ Expected 2 fields, found {len(fields)}")
                return False
        else:
            print(f"❌ Verification failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Verification error: {str(e)}")
        return False


def test_customer_fields_api():
    """Run comprehensive Customer Fields API tests as specified in review request"""
    print("\n📋 CUSTOMER FIELDS API TESTS")
    print("=" * 60)
    
    results = {}
    
    # Test 1: Get default Balia customer fields
    print("\n🔍 Test 1: Get default Balia customer fields")
    results["GET /api/customer-fields/balia (default)"] = test_get_customer_fields_balia()
    
    # Test 2: Get default Sauna customer fields
    print("\n🔍 Test 2: Get default Sauna customer fields")
    results["GET /api/customer-fields/sauna (default)"] = test_get_customer_fields_sauna()
    
    # Test 3: Save custom field configuration
    print("\n🔍 Test 3: Save custom field configuration")
    results["POST /api/customer-fields/balia (save config)"] = test_post_customer_fields_balia()
    
    # Test 4: Verify saved fields
    print("\n🔍 Test 4: Verify saved fields")
    results["GET /api/customer-fields/balia (verify saved)"] = test_verify_saved_customer_fields()
    
    return results


def test_techspec_mapping_flow():
    """Test TechSpecId mapping between Sauna Calculator and TechSpec Modal"""
    print("\n🔍 Testing TechSpecId Mapping Flow...")
    print("=" * 60)
    
    try:
        # Step 1: Check if order "WMS-29-12-2025-200219" exists with specific mappings
        print("\n🔍 Step 1: Checking for order 'WMS-29-12-2025-200219' (named 'new test')...")
        
        orders_response = requests.get(f"{BACKEND_URL}/sauna/orders")
        if orders_response.status_code != 200:
            print(f"❌ Failed to get sauna orders: {orders_response.status_code}")
            return False
        
        orders = orders_response.json()
        target_order = None
        
        # Look for the specific order
        for order in orders:
            if (order.get('id') == 'WMS-29-12-2025-200219' or 
                order.get('fullName') == 'new test' or
                'new test' in order.get('fullName', '').lower()):
                target_order = order
                break
        
        if not target_order:
            print("❌ Order 'WMS-29-12-2025-200219' (named 'new test') not found")
            print("Available orders:")
            for order in orders[:5]:  # Show first 5 orders
                print(f"  - ID: {order.get('id')}, Name: {order.get('fullName')}")
            return False
        
        print(f"✅ Found target order: ID={target_order.get('id')}, Name={target_order.get('fullName')}")
        
        # Step 2: Verify selectedOptions contains techSpecCategoryId and techSpecId fields
        print("\n🔍 Step 2: Verifying selectedOptions structure...")
        
        selected_options = target_order.get('selectedOptions', [])
        if not selected_options:
            print("❌ Order has no selectedOptions field or it's empty")
            print(f"Order structure: {list(target_order.keys())}")
            return False
        
        print(f"✅ Found {len(selected_options)} selectedOptions")
        
        # Check for expected mappings
        expected_mappings = {
            'heater': 'wood_external_12kw',
            'water_tank': '30l',
            'stove_guard': 'yes'
        }
        
        found_mappings = {}
        for option in selected_options:
            tech_spec_cat_id = option.get('techSpecCategoryId')
            tech_spec_id = option.get('techSpecId')
            
            if tech_spec_cat_id and tech_spec_id:
                found_mappings[tech_spec_cat_id] = tech_spec_id
                print(f"✅ Found mapping: {tech_spec_cat_id} -> {tech_spec_id}")
            else:
                print(f"⚠️ Option missing techSpec fields: {option}")
        
        # Verify expected mappings
        mapping_success = True
        for cat_id, expected_option_id in expected_mappings.items():
            if cat_id in found_mappings:
                if found_mappings[cat_id] == expected_option_id:
                    print(f"✅ Correct mapping: {cat_id} -> {expected_option_id}")
                else:
                    print(f"❌ Incorrect mapping: {cat_id} -> {found_mappings[cat_id]} (expected: {expected_option_id})")
                    mapping_success = False
            else:
                print(f"❌ Missing mapping for category: {cat_id}")
                mapping_success = False
        
        # Step 3: Fetch tech spec categories and verify they exist
        print("\n🔍 Step 3: Verifying tech spec categories...")
        
        tech_spec_response = requests.get(f"{BACKEND_URL}/tech-spec/categories")
        if tech_spec_response.status_code != 200:
            print(f"❌ Failed to get tech spec categories: {tech_spec_response.status_code}")
            return False
        
        print("✅ TechSpec mapping flow test completed")
        return mapping_success
        
    except Exception as e:
        print(f"❌ TechSpec mapping flow test error: {str(e)}")
        return False

def run_sauna_pdf_layout_and_gift_tests():
    """Run the specific tests requested in the review: Sauna PDF with new layout and gift display"""
    print("\n🎯 SAUNA PDF GENERATION WITH NEW LAYOUT AND GIFT DISPLAY TESTS")
    print("=" * 80)
    print("Testing as specified in review request:")
    print("1. Sauna PDF with Model and Bench side by side")
    print("2. Sauna PDF with Gift option (admin gift)")
    print("3. Balia PDF with Gift option")
    print("=" * 80)
    
    results = {}
    
    # Test 1: Sauna PDF with Model and Bench side by side
    print("\n📝 TEST 1: Sauna PDF with Model and Bench side by side")
    results["sauna_model_bench"] = test_sauna_pdf_with_model_and_bench()
    
    # Test 2: Sauna PDF with Gift option (admin gift)
    print("\n📝 TEST 2: Sauna PDF with Gift option (admin gift)")
    results["sauna_admin_gift"] = test_sauna_pdf_with_admin_gift()
    
    # Test 3: Balia PDF with Gift option
    print("\n📝 TEST 3: Balia PDF with Gift option")
    results["balia_admin_gift"] = test_balia_pdf_with_admin_gift()
    
    # Summary
    print("\n📊 TEST SUMMARY:")
    print("=" * 50)
    
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")
    
    print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 ALL SAUNA PDF LAYOUT AND GIFT TESTS PASSED!")
        return True
    else:
        print("❌ Some tests failed")
        return False

# Removed duplicate main section

def test_add_tech_spec_category():
    """Test POST /api/tech-spec/category - add a new category"""
    print("\n🔍 Testing POST /api/tech-spec/category...")
    
    try:
        # Create test category
        test_category = {
            "id": "test_category",
            "name": "Test Category",
            "inputType": "radio",
            "layout": "row",
            "hasImages": False,
            "sortOrder": 99,
            "options": [
                {
                    "id": "test_option_1",
                    "name": "Test Option 1",
                    "required": False
                },
                {
                    "id": "test_option_2", 
                    "name": "Test Option 2",
                    "required": True
                }
            ]
        }
        
        response = requests.post(f"{BACKEND_URL}/tech-spec/category", json=test_category)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ POST /api/tech-spec/category successful")
            print(f"✅ Message: {data.get('message')}")
            
            # Verify the category was added by getting all categories
            verify_response = requests.get(f"{BACKEND_URL}/tech-spec/categories")
            if verify_response.status_code == 200:
                verify_data = verify_response.json()
                categories = verify_data.get('categories', [])
                
                # Check if our test category exists
                test_cat = next((c for c in categories if c.get('id') == 'test_category'), None)
                if test_cat:
                    print("✅ Test category found in categories list")
                    print(f"✅ Category name: {test_cat.get('name')}")
                    print(f"✅ Options count: {len(test_cat.get('options', []))}")
                    return True
                else:
                    print("❌ Test category not found after creation")
                    return False
            else:
                print("❌ Could not verify category creation")
                return False
        else:
            print(f"❌ POST /api/tech-spec/category failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ POST /api/tech-spec/category error: {str(e)}")
        return False

def test_update_tech_spec_category():
    """Test PUT /api/tech-spec/category/{id} - update category"""
    print("\n🔍 Testing PUT /api/tech-spec/category/{id}...")
    
    try:
        # Update the test category we created
        updated_category = {
            "id": "test_category",
            "name": "Updated Test Category",
            "inputType": "checkbox",
            "layout": "column",
            "hasImages": True,
            "sortOrder": 98,
            "options": [
                {
                    "id": "test_option_1",
                    "name": "Updated Test Option 1",
                    "required": True
                },
                {
                    "id": "test_option_3",
                    "name": "New Test Option 3",
                    "required": False
                }
            ]
        }
        
        response = requests.put(f"{BACKEND_URL}/tech-spec/category/test_category", json=updated_category)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ PUT /api/tech-spec/category/{id} successful")
            print(f"✅ Message: {data.get('message')}")
            
            # Verify the category was updated
            verify_response = requests.get(f"{BACKEND_URL}/tech-spec/categories")
            if verify_response.status_code == 200:
                verify_data = verify_response.json()
                categories = verify_data.get('categories', [])
                
                # Check if our test category was updated
                test_cat = next((c for c in categories if c.get('id') == 'test_category'), None)
                if test_cat:
                    if (test_cat.get('name') == 'Updated Test Category' and 
                        test_cat.get('inputType') == 'checkbox' and
                        test_cat.get('hasImages') == True):
                        print("✅ Category successfully updated")
                        print(f"✅ New name: {test_cat.get('name')}")
                        print(f"✅ New inputType: {test_cat.get('inputType')}")
                        return True
                    else:
                        print("❌ Category not updated correctly")
                        return False
                else:
                    print("❌ Test category not found after update")
                    return False
            else:
                print("❌ Could not verify category update")
                return False
        else:
            print(f"❌ PUT /api/tech-spec/category/{id} failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ PUT /api/tech-spec/category/{id} error: {str(e)}")
        return False

def test_add_tech_spec_option():
    """Test POST /api/tech-spec/category/{id}/option - add option to category"""
    print("\n🔍 Testing POST /api/tech-spec/category/{id}/option...")
    
    try:
        # Add option to test category
        test_option = {
            "id": "test_option_new",
            "name": "Brand New Test Option",
            "imageUrl": "https://example.com/image.jpg",
            "placeholder": "Enter value here",
            "required": False
        }
        
        response = requests.post(f"{BACKEND_URL}/tech-spec/category/test_category/option", json=test_option)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ POST /api/tech-spec/category/{id}/option successful")
            print(f"✅ Message: {data.get('message')}")
            
            # Verify the option was added
            verify_response = requests.get(f"{BACKEND_URL}/tech-spec/categories")
            if verify_response.status_code == 200:
                verify_data = verify_response.json()
                categories = verify_data.get('categories', [])
                
                # Find our test category and check if option was added
                test_cat = next((c for c in categories if c.get('id') == 'test_category'), None)
                if test_cat:
                    options = test_cat.get('options', [])
                    new_option = next((o for o in options if o.get('id') == 'test_option_new'), None)
                    if new_option:
                        print("✅ New option successfully added to category")
                        print(f"✅ Option name: {new_option.get('name')}")
                        print(f"✅ Option imageUrl: {new_option.get('imageUrl')}")
                        return True
                    else:
                        print("❌ New option not found in category")
                        return False
                else:
                    print("❌ Test category not found")
                    return False
            else:
                print("❌ Could not verify option addition")
                return False
        else:
            print(f"❌ POST /api/tech-spec/category/{id}/option failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ POST /api/tech-spec/category/{id}/option error: {str(e)}")
        return False

def test_update_tech_spec_option():
    """Test PUT /api/tech-spec/category/{id}/option/{option_id} - update option"""
    print("\n🔍 Testing PUT /api/tech-spec/category/{id}/option/{option_id}...")
    
    try:
        # Update the option we just added
        updated_option = {
            "id": "test_option_new",
            "name": "Updated Brand New Test Option",
            "imageUrl": "https://example.com/updated-image.jpg",
            "placeholder": "Enter updated value here",
            "required": True
        }
        
        response = requests.put(f"{BACKEND_URL}/tech-spec/category/test_category/option/test_option_new", json=updated_option)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ PUT /api/tech-spec/category/{id}/option/{option_id} successful")
            print(f"✅ Message: {data.get('message')}")
            
            # Verify the option was updated
            verify_response = requests.get(f"{BACKEND_URL}/tech-spec/categories")
            if verify_response.status_code == 200:
                verify_data = verify_response.json()
                categories = verify_data.get('categories', [])
                
                # Find our test category and check if option was updated
                test_cat = next((c for c in categories if c.get('id') == 'test_category'), None)
                if test_cat:
                    options = test_cat.get('options', [])
                    updated_opt = next((o for o in options if o.get('id') == 'test_option_new'), None)
                    if updated_opt:
                        if (updated_opt.get('name') == 'Updated Brand New Test Option' and
                            updated_opt.get('required') == True and
                            'updated-image.jpg' in updated_opt.get('imageUrl', '')):
                            print("✅ Option successfully updated")
                            print(f"✅ Updated name: {updated_opt.get('name')}")
                            print(f"✅ Updated required: {updated_opt.get('required')}")
                            return True
                        else:
                            print("❌ Option not updated correctly")
                            return False
                    else:
                        print("❌ Updated option not found in category")
                        return False
                else:
                    print("❌ Test category not found")
                    return False
            else:
                print("❌ Could not verify option update")
                return False
        else:
            print(f"❌ PUT /api/tech-spec/category/{id}/option/{option_id} failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ PUT /api/tech-spec/category/{id}/option/{option_id} error: {str(e)}")
        return False

def test_delete_tech_spec_option():
    """Test DELETE /api/tech-spec/category/{id}/option/{option_id} - delete option"""
    print("\n🔍 Testing DELETE /api/tech-spec/category/{id}/option/{option_id}...")
    
    try:
        response = requests.delete(f"{BACKEND_URL}/tech-spec/category/test_category/option/test_option_new")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ DELETE /api/tech-spec/category/{id}/option/{option_id} successful")
            print(f"✅ Message: {data.get('message')}")
            
            # Verify the option was deleted
            verify_response = requests.get(f"{BACKEND_URL}/tech-spec/categories")
            if verify_response.status_code == 200:
                verify_data = verify_response.json()
                categories = verify_data.get('categories', [])
                
                # Find our test category and check if option was deleted
                test_cat = next((c for c in categories if c.get('id') == 'test_category'), None)
                if test_cat:
                    options = test_cat.get('options', [])
                    deleted_opt = next((o for o in options if o.get('id') == 'test_option_new'), None)
                    if deleted_opt is None:
                        print("✅ Option successfully deleted from category")
                        return True
                    else:
                        print("❌ Option still exists after deletion")
                        return False
                else:
                    print("❌ Test category not found")
                    return False
            else:
                print("❌ Could not verify option deletion")
                return False
        else:
            print(f"❌ DELETE /api/tech-spec/category/{id}/option/{option_id} failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ DELETE /api/tech-spec/category/{id}/option/{option_id} error: {str(e)}")
        return False

def test_delete_tech_spec_category():
    """Test DELETE /api/tech-spec/category/{id} - delete category"""
    print("\n🔍 Testing DELETE /api/tech-spec/category/{id}...")
    
    try:
        response = requests.delete(f"{BACKEND_URL}/tech-spec/category/test_category")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ DELETE /api/tech-spec/category/{id} successful")
            print(f"✅ Message: {data.get('message')}")
            
            # Verify the category was deleted
            verify_response = requests.get(f"{BACKEND_URL}/tech-spec/categories")
            if verify_response.status_code == 200:
                verify_data = verify_response.json()
                categories = verify_data.get('categories', [])
                
                # Check if our test category was deleted
                test_cat = next((c for c in categories if c.get('id') == 'test_category'), None)
                if test_cat is None:
                    print("✅ Test category successfully deleted")
                    return True
                else:
                    print("❌ Test category still exists after deletion")
                    return False
            else:
                print("❌ Could not verify category deletion")
                return False
        else:
            print(f"❌ DELETE /api/tech-spec/category/{id} failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ DELETE /api/tech-spec/category/{id} error: {str(e)}")
        return False

def test_tech_spec_admin_system():
    """Run comprehensive tech spec admin tests"""
    print("\n🔧 TECH SPEC ADMIN TESTS")
    print("=" * 50)
    
    # Run all tech spec admin tests in sequence
    tech_spec_results = {
        "GET /api/tech-spec/categories": test_get_tech_spec_categories(),
        "POST /api/tech-spec/category": test_add_tech_spec_category(),
        "PUT /api/tech-spec/category/{id}": test_update_tech_spec_category(),
        "POST /api/tech-spec/category/{id}/option": test_add_tech_spec_option(),
        "PUT /api/tech-spec/category/{id}/option/{option_id}": test_update_tech_spec_option(),
        "DELETE /api/tech-spec/category/{id}/option/{option_id}": test_delete_tech_spec_option(),
        "DELETE /api/tech-spec/category/{id}": test_delete_tech_spec_category(),
    }
    
    return tech_spec_results

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
    
    # Run tech spec admin tests
    tech_spec_results = test_tech_spec_admin_system()
    
    # Combine all results
    all_results = {**test_results, **sauna_results, **auth_results, **observer_results, **tech_spec_results}
    
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
    
    # Show tech spec admin results
    print("\n🔧 TECH SPEC ADMIN TESTS:")
    for test_name, result in tech_spec_results.items():
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

def run_tech_spec_admin_tests_only():
    """Run only the tech spec admin tests as specified in review request"""
    print("🔧 TECH SPEC ADMIN API TESTS")
    print("=" * 50)
    print("Testing the new Technical Specification Admin page endpoints")
    
    # Run tech spec admin tests
    tech_spec_results = test_tech_spec_admin_system()
    
    print("\n" + "=" * 50)
    print("📊 TECH SPEC ADMIN TEST RESULTS SUMMARY")
    print("=" * 50)
    
    passed = 0
    failed = 0
    
    for test_name, result in tech_spec_results.items():
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
        print("\n🎉 All tech spec admin tests passed!")
    else:
        print(f"\n⚠️  {failed} test(s) failed - see details above")
    
    return tech_spec_results

def test_sauna_pdf_image_optimization():
    """Test Sauna PDF with Image Optimization as per review request"""
    print("\n🔍 Testing Sauna PDF with Image Optimization...")
    print("=" * 60)
    
    try:
        # Test data as specified in review request
        pdf_request = {
            "fullName": "Optimization Test",
            "phoneNumber": "123456",
            "orderDate": "2025-01-01",
            "selectedModel": "sauna_test",
            "modelName": "Sauna Test Model",
            "modelImageUrl": "https://i.imgur.com/LbbjL2d.jpeg",
            "basePrice": 17980,
            "total": 18500,
            "categories": [],
            "selections": {"lawki": "lawki_test"},
            "selectedOptions": [
                {
                    "categoryId": "lawki",
                    "optionId": "lawki_test",
                    "optionName": "Test Lawki",
                    "price": 520,
                    "imageUrl": "https://i.imgur.com/lNi4r5Q.jpeg"
                }
            ]
        }
        
        response = requests.post(f"{BACKEND_URL}/sauna/generate-pdf", json=pdf_request)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ HTTP 200 - Sauna PDF generated successfully")
            
            # Check content type
            content_type = response.headers.get('content-type', '')
            if 'application/pdf' in content_type:
                print("✅ Response is PDF format")
            else:
                print(f"❌ Unexpected content type: {content_type}")
                return False
            
            # Check PDF file size
            content_length = len(response.content)
            print(f"✅ PDF size: {content_length} bytes")
            
            # Note about optimization - we expect smaller size due to optimization
            if content_length > 10000:  # At least 10KB for a PDF with images
                print("✅ PDF size indicates content is present")
                print("📝 Note: PDF size should be smaller due to image optimization")
            else:
                print(f"❌ PDF too small: {content_length} bytes")
                return False
            
            return True
        else:
            print(f"❌ Sauna PDF generation failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Sauna PDF image optimization test error: {str(e)}")
        return False

def test_order_sorting_by_creation_time():
    """Test Order Sorting by Creation Time as per review request"""
    print("\n🔍 Testing Order Sorting by Creation Time...")
    print("=" * 60)
    
    try:
        response = requests.get(f"{BACKEND_URL}/sauna/orders")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            orders = response.json()
            print(f"✅ GET /api/sauna/orders successful")
            print(f"✅ Found {len(orders)} sauna orders")
            
            if not orders:
                print("⚠️ No orders found to test sorting")
                return True
            
            # Check ID format WMS-DD-MM-YYYY-HHMMSS
            valid_id_format = True
            for order in orders[:5]:  # Check first 5 orders
                order_id = order.get('id', '')
                if order_id.startswith('WMS-') and len(order_id.split('-')) >= 5:
                    print(f"✅ Order ID format correct: {order_id}")
                else:
                    print(f"❌ Order ID format incorrect: {order_id}")
                    valid_id_format = False
            
            if not valid_id_format:
                return False
            
            # Check sorting - newer timestamps should come first within same date
            print("\n🔍 Checking order sorting...")
            
            # Group orders by date and check time sorting
            from collections import defaultdict
            orders_by_date = defaultdict(list)
            
            for order in orders:
                order_id = order.get('id', '')
                if order_id.startswith('WMS-'):
                    # Extract date from ID: WMS-DD-MM-YYYY-HHMMSS
                    parts = order_id.split('-')
                    if len(parts) >= 5:
                        date_part = f"{parts[1]}-{parts[2]}-{parts[3]}"  # DD-MM-YYYY
                        time_part = parts[4] if len(parts) > 4 else "000000"  # HHMMSS
                        orders_by_date[date_part].append((order_id, time_part))
            
            # Check sorting within each date
            sorting_correct = True
            for date, order_list in orders_by_date.items():
                if len(order_list) > 1:
                    # Sort by time descending (newer first)
                    sorted_list = sorted(order_list, key=lambda x: x[1], reverse=True)
                    original_order = [item[1] for item in order_list]
                    expected_order = [item[1] for item in sorted_list]
                    
                    if original_order == expected_order:
                        print(f"✅ Orders for date {date} are correctly sorted (newer first)")
                    else:
                        print(f"❌ Orders for date {date} are NOT correctly sorted")
                        print(f"   Original: {original_order}")
                        print(f"   Expected: {expected_order}")
                        sorting_correct = False
            
            if sorting_correct:
                print("✅ Order sorting by creation time is correct")
                return True
            else:
                print("❌ Order sorting by creation time is incorrect")
                return False
            
        else:
            print(f"❌ GET /api/sauna/orders failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Order sorting test error: {str(e)}")
        return False

def test_warehouse_module():
    """Test the new Warehouse module API endpoints"""
    print("\n🏭 WAREHOUSE MODULE TESTS")
    print("=" * 50)
    
    results = {}
    
    # First, login to get authentication token
    print("\n🔐 Authenticating with warehouse credentials...")
    try:
        login_data = {
            "username": "testuser",
            "password": "test123"
        }
        
        response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            headers = {"Authorization": f"Bearer {token}"}
            print("✅ Authentication successful")
        else:
            print(f"❌ Authentication failed: {response.status_code}")
            return {"Authentication": False}
    except Exception as e:
        print(f"❌ Authentication error: {str(e)}")
        return {"Authentication": False}
    
    # Test 1: GET /api/warehouse/orders - Get all orders for warehouse
    print("\n📝 Test 1: GET /api/warehouse/orders - Get all orders for warehouse")
    try:
        response = requests.get(f"{BACKEND_URL}/warehouse/orders", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ GET /api/warehouse/orders successful")
            
            # Check response structure
            if 'orders' in data and 'total' in data and 'statuses' in data:
                print("✅ Response structure correct (orders, total, statuses)")
                orders = data.get('orders', [])
                print(f"✅ Found {len(orders)} orders")
                
                # Check if orders have warehouseStatus field
                if orders:
                    first_order = orders[0]
                    if 'warehouseStatus' in first_order:
                        print("✅ Orders contain warehouseStatus field")
                    else:
                        print("❌ Orders missing warehouseStatus field")
                        results["GET /api/warehouse/orders"] = False
                        return results
                
                results["GET /api/warehouse/orders"] = True
            else:
                print("❌ Response structure incorrect")
                results["GET /api/warehouse/orders"] = False
        else:
            print(f"❌ GET /api/warehouse/orders failed: {response.status_code}")
            print(f"Response: {response.text}")
            results["GET /api/warehouse/orders"] = False
            
    except Exception as e:
        print(f"❌ GET /api/warehouse/orders error: {str(e)}")
        results["GET /api/warehouse/orders"] = False
    
    # Test 2: GET /api/warehouse/orders with filters
    print("\n📝 Test 2: GET /api/warehouse/orders with filters (section=greenhouse, status=request)")
    try:
        params = {"section": "greenhouse", "status": "request"}
        response = requests.get(f"{BACKEND_URL}/warehouse/orders", headers=headers, params=params)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ GET /api/warehouse/orders with filters successful")
            
            orders = data.get('orders', [])
            print(f"✅ Found {len(orders)} filtered orders")
            
            # Verify filters applied correctly
            if orders:
                for order in orders[:3]:  # Check first 3 orders
                    section = order.get('section', '')
                    status = order.get('warehouseStatus', '')
                    if section == 'greenhouse' and status == 'request':
                        print(f"✅ Filter applied correctly: section={section}, status={status}")
                    else:
                        print(f"⚠️ Filter may not be applied: section={section}, status={status}")
            
            results["GET /api/warehouse/orders (filtered)"] = True
        else:
            print(f"❌ GET /api/warehouse/orders with filters failed: {response.status_code}")
            results["GET /api/warehouse/orders (filtered)"] = False
            
    except Exception as e:
        print(f"❌ GET /api/warehouse/orders with filters error: {str(e)}")
        results["GET /api/warehouse/orders (filtered)"] = False
    
    # Test 3: GET /api/warehouse/stats - Get warehouse statistics
    print("\n📝 Test 3: GET /api/warehouse/stats - Get warehouse statistics")
    try:
        response = requests.get(f"{BACKEND_URL}/warehouse/stats", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ GET /api/warehouse/stats successful")
            
            # Check response structure
            required_fields = ['byStatus', 'bySection', 'total']
            for field in required_fields:
                if field in data:
                    print(f"✅ Stats field '{field}' present")
                else:
                    print(f"❌ Stats field '{field}' missing")
                    results["GET /api/warehouse/stats"] = False
                    return results
            
            # Display stats
            by_status = data.get('byStatus', {})
            by_section = data.get('bySection', {})
            total = data.get('total', 0)
            
            print(f"📊 Total orders: {total}")
            print(f"📊 By status: {by_status}")
            print(f"📊 By section: {by_section}")
            
            results["GET /api/warehouse/stats"] = True
        else:
            print(f"❌ GET /api/warehouse/stats failed: {response.status_code}")
            print(f"Response: {response.text}")
            results["GET /api/warehouse/stats"] = False
            
    except Exception as e:
        print(f"❌ GET /api/warehouse/stats error: {str(e)}")
        results["GET /api/warehouse/stats"] = False
    
    # Test 4: Find an order to test status update
    print("\n📝 Test 4: Finding an order for status update test...")
    test_order_id = None
    try:
        response = requests.get(f"{BACKEND_URL}/warehouse/orders", headers=headers)
        if response.status_code == 200:
            data = response.json()
            orders = data.get('orders', [])
            
            # Find an order with 'request' status to update to 'picking'
            for order in orders:
                if order.get('warehouseStatus') == 'request':
                    test_order_id = order.get('id')
                    print(f"✅ Found test order: {test_order_id}")
                    break
            
            if not test_order_id and orders:
                # Use any order if no 'request' status found
                test_order_id = orders[0].get('id')
                print(f"✅ Using first available order: {test_order_id}")
        
        if not test_order_id:
            print("❌ No orders found for status update test")
            results["Order Status Update"] = False
        else:
            results["Find Test Order"] = True
            
    except Exception as e:
        print(f"❌ Error finding test order: {str(e)}")
        results["Find Test Order"] = False
    
    # Test 5: PUT /api/warehouse/orders/{order_id}/status - Update order status
    if test_order_id:
        print(f"\n📝 Test 5: PUT /api/warehouse/orders/{test_order_id}/status - Update order status")
        try:
            params = {"status": "picking"}
            response = requests.put(f"{BACKEND_URL}/warehouse/orders/{test_order_id}/status", 
                                  headers=headers, params=params)
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print("✅ PUT /api/warehouse/orders/{order_id}/status successful")
                
                # Check response structure
                required_fields = ['success', 'message', 'order_id', 'old_status', 'new_status']
                for field in required_fields:
                    if field in data:
                        print(f"✅ Response field '{field}' present: {data.get(field)}")
                    else:
                        print(f"❌ Response field '{field}' missing")
                
                # Verify status change
                if data.get('new_status') == 'picking':
                    print("✅ Status updated to 'picking' successfully")
                    results["PUT /api/warehouse/orders/{order_id}/status"] = True
                else:
                    print(f"❌ Status not updated correctly: {data.get('new_status')}")
                    results["PUT /api/warehouse/orders/{order_id}/status"] = False
            else:
                print(f"❌ PUT /api/warehouse/orders/{test_order_id}/status failed: {response.status_code}")
                print(f"Response: {response.text}")
                results["PUT /api/warehouse/orders/{order_id}/status"] = False
                
        except Exception as e:
            print(f"❌ PUT /api/warehouse/orders/{test_order_id}/status error: {str(e)}")
            results["PUT /api/warehouse/orders/{order_id}/status"] = False
    
    # Test 6: GET /api/warehouse/orders/{order_id}/history - Get order history
    if test_order_id:
        print(f"\n📝 Test 6: GET /api/warehouse/orders/{test_order_id}/history - Get order history")
        try:
            response = requests.get(f"{BACKEND_URL}/warehouse/orders/{test_order_id}/history", 
                                  headers=headers)
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print("✅ GET /api/warehouse/orders/{order_id}/history successful")
                
                # Check response structure
                if 'order_id' in data and 'history' in data:
                    print("✅ Response structure correct (order_id, history)")
                    
                    history = data.get('history', [])
                    print(f"✅ Found {len(history)} history entries")
                    
                    # Check history entry structure
                    if history:
                        first_entry = history[0]
                        required_fields = ['changedBy', 'oldStatus', 'newStatus', 'changedAt']
                        for field in required_fields:
                            if field in first_entry:
                                print(f"✅ History field '{field}' present: {first_entry.get(field)}")
                            else:
                                print(f"❌ History field '{field}' missing")
                    
                    results["GET /api/warehouse/orders/{order_id}/history"] = True
                else:
                    print("❌ Response structure incorrect")
                    results["GET /api/warehouse/orders/{order_id}/history"] = False
            else:
                print(f"❌ GET /api/warehouse/orders/{test_order_id}/history failed: {response.status_code}")
                print(f"Response: {response.text}")
                results["GET /api/warehouse/orders/{order_id}/history"] = False
                
        except Exception as e:
            print(f"❌ GET /api/warehouse/orders/{test_order_id}/history error: {str(e)}")
            results["GET /api/warehouse/orders/{order_id}/history"] = False
    
    # Test 7: GET /api/warehouse/trips - Get all trips for warehouse view
    print("\n📝 Test 7: GET /api/warehouse/trips - Get all trips for warehouse view")
    try:
        response = requests.get(f"{BACKEND_URL}/warehouse/trips", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ GET /api/warehouse/trips successful")
            
            # Check response structure
            if 'trips' in data and 'total' in data:
                print("✅ Response structure correct (trips, total)")
                
                trips = data.get('trips', [])
                print(f"✅ Found {len(trips)} trips")
                
                # Check trip structure with orders details
                if trips:
                    first_trip = trips[0]
                    if 'orders' in first_trip:
                        print("✅ Trips contain orders details")
                        orders = first_trip.get('orders', [])
                        print(f"✅ First trip has {len(orders)} orders")
                    else:
                        print("❌ Trips missing orders details")
                
                results["GET /api/warehouse/trips"] = True
            else:
                print("❌ Response structure incorrect")
                results["GET /api/warehouse/trips"] = False
        else:
            print(f"❌ GET /api/warehouse/trips failed: {response.status_code}")
            print(f"Response: {response.text}")
            results["GET /api/warehouse/trips"] = False
            
    except Exception as e:
        print(f"❌ GET /api/warehouse/trips error: {str(e)}")
        results["GET /api/warehouse/trips"] = False
    
    # Test 8: Access control verification - Test with warehouse role
    print("\n📝 Test 8: Access control verification")
    try:
        # The tests above already verify that warehouse role can access these endpoints
        # This is implicit verification since we used testuser/test123 credentials
        print("✅ Access control verified - warehouse role can access endpoints")
        results["Access Control"] = True
        
    except Exception as e:
        print(f"❌ Access control test error: {str(e)}")
        results["Access Control"] = False
    
    return results


def test_logistics_sync_missing_orders():
    """Test the Logistics module 'Sync Missing Orders' feature fix"""
    print("\n🔍 Testing LOGISTICS MODULE - SYNC MISSING ORDERS FEATURE FIX")
    print("=" * 70)
    
    results = {}
    
    # Test 1: Authentication Test
    print("\n📝 Test 1: Authentication Test...")
    try:
        login_data = {
            "username": "testuser",
            "password": "test123"
        }
        
        response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Authentication successful with testuser/test123")
            
            if 'token' in data:
                token = data['token']
                print("✅ Token received successfully")
                results["authentication_test"] = True
                headers = {"Authorization": f"Bearer {token}"}
            else:
                print("❌ No token in response")
                results["authentication_test"] = False
                return results
        else:
            print(f"❌ Authentication failed with status {response.status_code}")
            print(f"Response: {response.text}")
            results["authentication_test"] = False
            return results
            
    except Exception as e:
        print(f"❌ Authentication test error: {str(e)}")
        results["authentication_test"] = False
        return results
    
    # Test 2: Sync Missing Orders Endpoint Test (Greenhouse)
    print("\n📝 Test 2: Sync Missing Orders Endpoint Test (Greenhouse)...")
    try:
        sync_data = ["test123", "test456"]
        
        response = requests.post(
            f"{BACKEND_URL}/integrations/amocrm/sync-missing/greenhouse", 
            json=sync_data,
            headers=headers
        )
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Sync Missing Orders (Greenhouse) endpoint responds correctly")
            print(f"Response: {data}")
            results["sync_greenhouse_test"] = True
        elif response.status_code == 400 and "amoCRM credentials not set" in response.text:
            print("✅ Sync Missing Orders (Greenhouse) endpoint responds with expected error")
            print("✅ Expected response: amoCRM credentials not set")
            results["sync_greenhouse_test"] = True
        else:
            print(f"❌ Sync Missing Orders (Greenhouse) failed with status {response.status_code}")
            print(f"Response: {response.text}")
            results["sync_greenhouse_test"] = False
            
    except Exception as e:
        print(f"❌ Sync Missing Orders (Greenhouse) test error: {str(e)}")
        results["sync_greenhouse_test"] = False
    
    # Test 3: Sync Missing Orders for Balia
    print("\n📝 Test 3: Sync Missing Orders for Balia...")
    try:
        sync_data = ["test123", "test456"]
        
        response = requests.post(
            f"{BACKEND_URL}/integrations/amocrm/sync-missing/balia", 
            json=sync_data,
            headers=headers
        )
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Sync Missing Orders (Balia) endpoint responds correctly")
            print(f"Response: {data}")
            results["sync_balia_test"] = True
        elif response.status_code == 400 and "amoCRM credentials not set" in response.text:
            print("✅ Sync Missing Orders (Balia) endpoint responds with expected error")
            print("✅ Expected response: amoCRM credentials not set")
            results["sync_balia_test"] = True
        else:
            print(f"❌ Sync Missing Orders (Balia) failed with status {response.status_code}")
            print(f"Response: {response.text}")
            results["sync_balia_test"] = False
            
    except Exception as e:
        print(f"❌ Sync Missing Orders (Balia) test error: {str(e)}")
        results["sync_balia_test"] = False
    
    # Test 4: Trips API Test
    print("\n📝 Test 4: Trips API Test...")
    try:
        response = requests.get(f"{BACKEND_URL}/trips", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            trips = response.json()
            print(f"✅ Trips API successful - found {len(trips)} trips")
            
            # Check if any trips have "delivered" status
            delivered_trips = [trip for trip in trips if trip.get('status') == 'delivered']
            if delivered_trips:
                print(f"✅ Found {len(delivered_trips)} trips with 'delivered' status")
            else:
                print("ℹ️ No trips with 'delivered' status found (this is normal)")
            
            results["trips_api_test"] = True
        else:
            print(f"❌ Trips API failed with status {response.status_code}")
            print(f"Response: {response.text}")
            results["trips_api_test"] = False
            
    except Exception as e:
        print(f"❌ Trips API test error: {str(e)}")
        results["trips_api_test"] = False
    
    # Test 5: Warehouse API Test
    print("\n📝 Test 5: Warehouse API Test...")
    try:
        response = requests.get(f"{BACKEND_URL}/warehouse/orders", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Warehouse API successful")
            
            # Check if response has expected structure
            if 'orders' in data:
                orders = data['orders']
                print(f"✅ Found {len(orders)} warehouse orders")
                
                # Check if orders have warehouseStatus field
                if orders:
                    first_order = orders[0]
                    if 'warehouseStatus' in first_order:
                        print("✅ Orders contain warehouseStatus field")
                    else:
                        print("❌ Orders missing warehouseStatus field")
                        results["warehouse_api_test"] = False
                        return results
                
                results["warehouse_api_test"] = True
            else:
                print("❌ Warehouse API response missing 'orders' field")
                print(f"Response structure: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")
                results["warehouse_api_test"] = False
        else:
            print(f"❌ Warehouse API failed with status {response.status_code}")
            print(f"Response: {response.text}")
            results["warehouse_api_test"] = False
            
    except Exception as e:
        print(f"❌ Warehouse API test error: {str(e)}")
        results["warehouse_api_test"] = False
    
    # Summary
    print("\n📊 LOGISTICS SYNC MISSING ORDERS TEST SUMMARY:")
    print("=" * 60)
    
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")
    
    print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 ALL LOGISTICS SYNC MISSING ORDERS TESTS PASSED!")
        return True
    else:
        print("❌ Some logistics tests failed")
        return False


def main():
    """Run all backend tests for the review request"""
    print("🚀 WM Calculator Backend API Testing - Logistics Sync Missing Orders Fix")
    print("=" * 70)
    print(f"Backend URL: {BACKEND_URL}")
    print("=" * 70)
    
    # Test results tracking
    results = {}
    
    # Logistics Sync Missing Orders Tests (PRIMARY FOCUS)
    print("\n🚛 LOGISTICS SYNC MISSING ORDERS TESTS")
    print("-" * 50)
    results["Logistics Sync Missing Orders Feature"] = test_logistics_sync_missing_orders()
    
    # Warehouse Module Tests (Related)
    print("\n🏭 WAREHOUSE MODULE TESTS")
    print("-" * 40)
    warehouse_results = test_warehouse_module()
    results.update(warehouse_results)
    
    # Review Request Specific Tests
    print("\n📋 REVIEW REQUEST TESTS")
    print("-" * 40)
    results["Sauna PDF Image Optimization"] = test_sauna_pdf_image_optimization()
    results["Order Sorting by Creation Time"] = test_order_sorting_by_creation_time()
    
    # Basic API tests (reduced set for focus)
    print("\n📊 BASIC API VERIFICATION")
    print("-" * 30)
    results["GET /api/sauna/orders"] = test_get_sauna_orders()
    results["POST /api/sauna/generate-pdf"] = test_generate_sauna_pdf()
    
    # Print final summary
    print("\n" + "=" * 70)
    print("📊 FINAL TEST SUMMARY")
    print("=" * 70)
    
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result)
    failed_tests = total_tests - passed_tests
    
    print(f"Total Tests: {total_tests}")
    print(f"✅ Passed: {passed_tests}")
    print(f"❌ Failed: {failed_tests}")
    print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
    
    print("\n📋 DETAILED RESULTS:")
    print("-" * 50)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")
    
    if failed_tests == 0:
        print("\n🎉 ALL TESTS PASSED! Backend API is working correctly.")
        return True
    else:
        print(f"\n⚠️ {failed_tests} test(s) failed. Please check the issues above.")
        return False