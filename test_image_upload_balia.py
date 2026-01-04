#!/usr/bin/env python3
"""
Backend API Testing for Image Upload and Balia Pricing Admin Functionality
Tests the new image upload endpoints and updated Balia pricing structure
"""

import requests
import json
import base64
import uuid
from datetime import datetime

# Get backend URL from frontend .env
BACKEND_URL = "https://pwa-delivery-app.preview.emergentagent.com/api"

def test_upload_image():
    """Test POST /api/upload/image - Upload image file"""
    print("\n🔍 Testing POST /api/upload/image...")
    
    try:
        # Create a simple test image (1x1 PNG)
        # This is a minimal 1x1 transparent PNG image
        png_data = base64.b64decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU8'
            'ByQAAAABJRU5ErkJggg=='
        )
        
        # Prepare multipart form data
        files = {
            'file': ('test_image.png', png_data, 'image/png')
        }
        
        response = requests.post(f"{BACKEND_URL}/upload/image", files=files)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ POST /api/upload/image successful")
            
            # Check response structure
            if 'filename' in data and 'url' in data:
                print(f"✅ Response contains filename: {data['filename']}")
                print(f"✅ Response contains url: {data['url']}")
                
                # Verify URL format
                expected_url = f"/api/uploads/{data['filename']}"
                if data['url'] == expected_url:
                    print("✅ URL format is correct")
                    return data['filename']  # Return filename for other tests
                else:
                    print(f"❌ URL format incorrect: expected {expected_url}, got {data['url']}")
                    return False
            else:
                print("❌ Missing filename or url in response")
                return False
        else:
            print(f"❌ POST /api/upload/image failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ POST /api/upload/image error: {str(e)}")
        return False

def test_get_uploaded_file(filename):
    """Test GET /api/uploads/{filename} - Serve uploaded file"""
    print(f"\n🔍 Testing GET /api/uploads/{filename}...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/uploads/{filename}")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ GET /api/uploads/{filename} successful")
            
            # Check content type
            content_type = response.headers.get('content-type', '')
            if 'image' in content_type:
                print(f"✅ Content type is image: {content_type}")
            else:
                print(f"⚠️ Content type: {content_type}")
            
            # Check content length
            content_length = len(response.content)
            if content_length > 0:
                print(f"✅ File size: {content_length} bytes")
                return True
            else:
                print("❌ File is empty")
                return False
        else:
            print(f"❌ GET /api/uploads/{filename} failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ GET /api/uploads/{filename} error: {str(e)}")
        return False

def test_delete_uploaded_image(filename):
    """Test DELETE /api/upload/image/{filename} - Delete uploaded image"""
    print(f"\n🔍 Testing DELETE /api/upload/image/{filename}...")
    
    try:
        response = requests.delete(f"{BACKEND_URL}/upload/image/{filename}")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ DELETE /api/upload/image/{filename} successful")
            
            if 'message' in data:
                print(f"✅ Response message: {data['message']}")
            
            # Verify file is actually deleted by trying to get it
            verify_response = requests.get(f"{BACKEND_URL}/uploads/{filename}")
            if verify_response.status_code == 404:
                print("✅ File successfully deleted (404 when trying to access)")
                return True
            else:
                print(f"❌ File still accessible after deletion: {verify_response.status_code}")
                return False
        else:
            print(f"❌ DELETE /api/upload/image/{filename} failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ DELETE /api/upload/image/{filename} error: {str(e)}")
        return False

def test_balia_prices_new_structure():
    """Test GET /api/prices - Verify new structure with models[], categories[], currency, currencySymbol"""
    print("\n🔍 Testing GET /api/prices (New Balia Structure)...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/prices")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ GET /api/prices successful")
            
            # Check required fields for new structure
            required_fields = ['models', 'categories', 'currency', 'currencySymbol']
            missing_fields = []
            
            for field in required_fields:
                if field not in data:
                    missing_fields.append(field)
                else:
                    print(f"✅ Field '{field}' present")
            
            if missing_fields:
                print(f"❌ Missing required fields: {missing_fields}")
                return False
            
            # Check models structure
            models = data.get('models', [])
            print(f"📊 Found {len(models)} models")
            
            if models:
                first_model = models[0]
                required_model_fields = ['id', 'name', 'basePrice']
                for field in required_model_fields:
                    if field in first_model:
                        print(f"✅ Model field '{field}' present")
                    else:
                        print(f"❌ Model field '{field}' missing")
                        return False
                
                # Check if imageUrl field exists (can be empty)
                if 'imageUrl' in first_model:
                    image_url = first_model.get('imageUrl', '')
                    print(f"✅ Model imageUrl field present: '{image_url}'")
                else:
                    print("❌ Model imageUrl field missing")
                    return False
            
            # Check categories structure
            categories = data.get('categories', [])
            print(f"📊 Found {len(categories)} categories")
            
            if categories:
                first_category = categories[0]
                required_category_fields = ['id', 'name', 'inputType', 'options']
                for field in required_category_fields:
                    if field in first_category:
                        print(f"✅ Category field '{field}' present")
                    else:
                        print(f"❌ Category field '{field}' missing")
                        return False
                
                # Check if imageUrl field exists (can be empty)
                if 'imageUrl' in first_category:
                    image_url = first_category.get('imageUrl', '')
                    print(f"✅ Category imageUrl field present: '{image_url}'")
                else:
                    print("❌ Category imageUrl field missing")
                    return False
            
            # Check currency fields
            currency = data.get('currency', '')
            currency_symbol = data.get('currencySymbol', '')
            print(f"✅ Currency: {currency}")
            print(f"✅ Currency Symbol: {currency_symbol}")
            
            return True
        else:
            print(f"❌ GET /api/prices failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ GET /api/prices error: {str(e)}")
        return False

def test_save_balia_prices_with_images():
    """Test POST /api/prices - Save prices with imageUrl fields for models and categories"""
    print("\n🔍 Testing POST /api/prices (Save with imageUrl fields)...")
    
    try:
        # First get current prices
        get_response = requests.get(f"{BACKEND_URL}/prices")
        if get_response.status_code != 200:
            print("❌ Could not get current prices for testing")
            return False
        
        current_data = get_response.json()
        
        # Create test data with imageUrl modifications
        test_data = current_data.copy()
        
        # Update a model with imageUrl
        models = test_data.get('models', [])
        if models:
            models[0]['imageUrl'] = '/api/uploads/test_model_image.jpg'
            print(f"✅ Updated model '{models[0]['id']}' with imageUrl: {models[0]['imageUrl']}")
        
        # Update a category with imageUrl
        categories = test_data.get('categories', [])
        if categories:
            categories[0]['imageUrl'] = '/api/uploads/test_category_image.jpg'
            print(f"✅ Updated category '{categories[0]['id']}' with imageUrl: {categories[0]['imageUrl']}")
        
        # Send POST request
        response = requests.post(f"{BACKEND_URL}/prices", json=test_data)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ POST /api/prices successful")
            
            # Verify the data was saved by getting it again
            verify_response = requests.get(f"{BACKEND_URL}/prices")
            if verify_response.status_code == 200:
                saved_data = verify_response.json()
                
                # Check if model imageUrl was saved
                saved_models = saved_data.get('models', [])
                if saved_models and saved_models[0].get('imageUrl') == '/api/uploads/test_model_image.jpg':
                    print("✅ Model imageUrl saved successfully")
                else:
                    print("❌ Model imageUrl not saved correctly")
                    return False
                
                # Check if category imageUrl was saved
                saved_categories = saved_data.get('categories', [])
                if saved_categories and saved_categories[0].get('imageUrl') == '/api/uploads/test_category_image.jpg':
                    print("✅ Category imageUrl saved successfully")
                else:
                    print("❌ Category imageUrl not saved correctly")
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

def main():
    """Run image upload and Balia pricing tests"""
    print("📸 IMAGE UPLOAD & BALIA PRICING ADMIN TESTS")
    print("=" * 60)
    
    results = {}
    
    # Test 1: Upload image
    print("\n1️⃣ Testing Image Upload...")
    uploaded_filename = test_upload_image()
    results["POST /api/upload/image"] = bool(uploaded_filename)
    
    if uploaded_filename:
        # Test 2: Get uploaded file
        print("\n2️⃣ Testing Get Uploaded File...")
        results["GET /api/uploads/{filename}"] = test_get_uploaded_file(uploaded_filename)
        
        # Test 3: Delete uploaded file
        print("\n3️⃣ Testing Delete Uploaded File...")
        results["DELETE /api/upload/image/{filename}"] = test_delete_uploaded_image(uploaded_filename)
    else:
        print("❌ Skipping file retrieval and deletion tests due to upload failure")
        results["GET /api/uploads/{filename}"] = False
        results["DELETE /api/upload/image/{filename}"] = False
    
    # Test 4: Balia prices new structure
    print("\n4️⃣ Testing Balia Prices New Structure...")
    results["GET /api/prices (New Structure)"] = test_balia_prices_new_structure()
    
    # Test 5: Save prices with imageUrl
    print("\n5️⃣ Testing Save Prices with ImageUrl...")
    results["POST /api/prices (With imageUrl)"] = test_save_balia_prices_with_images()
    
    # Print summary
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    for test_name, result in results.items():
        if result:
            print(f"✅ {test_name}")
            passed += 1
        else:
            print(f"❌ {test_name}")
            failed += 1
    
    print(f"\n📈 TOTAL: {passed + failed} tests")
    print(f"✅ PASSED: {passed}")
    print(f"❌ FAILED: {failed}")
    
    if failed == 0:
        print("\n🎉 ALL IMAGE UPLOAD & BALIA PRICING TESTS PASSED!")
    else:
        print(f"\n⚠️ {failed} TESTS FAILED")
    
    return failed == 0

if __name__ == "__main__":
    main()