#!/usr/bin/env python3
"""
Comprehensive Category Management Flow Testing
Tests the specific scenarios mentioned in the review request
"""

import requests
import json

BACKEND_URL = "https://widget-contract-gen.preview.emergentagent.com/api"

def test_custom_category_flow():
    """Test the complete custom category creation flow as specified in review request"""
    print("🔍 Testing Custom Category Flow (Review Request Scenario)...")
    
    try:
        # Step 1: Get current prices to work with
        response = requests.get(f"{BACKEND_URL}/prices")
        if response.status_code != 200:
            print("❌ Could not get current prices")
            return False
        
        current_data = response.json()
        print("✅ Retrieved current pricing data")
        
        # Step 2: Create new category as specified: ID "extras", Name "Дополнительное оборудование", Type "checkbox"
        test_data = current_data.copy()
        
        # Add the new category
        extras_category_id = "extras"
        test_data['categories'][extras_category_id] = {
            "name": "Дополнительное оборудование",
            "displayType": "checkbox",
            "required": False,
            "order": 7  # After the 6 default categories
        }
        
        # Step 3: Add new option as specified: category "extras", key "test_pump", label "Тестовый насос", price 500, type "checkbox"
        test_option_key = "test_pump"
        test_data['optionLabels'][test_option_key] = "Тестовый насос"
        test_data['optionCategories'][test_option_key] = extras_category_id
        test_data['displayTypes'][test_option_key] = "checkbox"
        
        # Add price for the new option
        if 'features' not in test_data:
            test_data['features'] = {}
        test_data['features'][test_option_key] = 500.0
        
        # Step 4: Save the changes
        save_response = requests.post(f"{BACKEND_URL}/prices", json=test_data)
        if save_response.status_code != 200:
            print(f"❌ Failed to save custom category: {save_response.status_code}")
            print(f"Response: {save_response.text}")
            return False
        
        print("✅ Custom category 'extras' created successfully")
        print("✅ Custom option 'test_pump' added successfully")
        
        # Step 5: Verify the data was saved correctly
        verify_response = requests.get(f"{BACKEND_URL}/prices")
        if verify_response.status_code != 200:
            print("❌ Could not verify saved data")
            return False
        
        saved_data = verify_response.json()
        
        # Check category
        if extras_category_id not in saved_data.get('categories', {}):
            print(f"❌ Category '{extras_category_id}' not found after save")
            return False
        
        saved_category = saved_data['categories'][extras_category_id]
        if saved_category['name'] != "Дополнительное оборудование":
            print(f"❌ Category name incorrect: {saved_category['name']}")
            return False
        
        if saved_category['displayType'] != "checkbox":
            print(f"❌ Category display type incorrect: {saved_category['displayType']}")
            return False
        
        print("✅ Category saved with correct name and display type")
        
        # Check option
        if test_option_key not in saved_data.get('optionCategories', {}):
            print(f"❌ Option '{test_option_key}' not found in optionCategories")
            return False
        
        if saved_data['optionCategories'][test_option_key] != extras_category_id:
            print(f"❌ Option category mapping incorrect")
            return False
        
        if test_option_key not in saved_data.get('optionLabels', {}):
            print(f"❌ Option '{test_option_key}' not found in optionLabels")
            return False
        
        if saved_data['optionLabels'][test_option_key] != "Тестовый насос":
            print(f"❌ Option label incorrect: {saved_data['optionLabels'][test_option_key]}")
            return False
        
        if test_option_key not in saved_data.get('features', {}):
            print(f"❌ Option '{test_option_key}' not found in features pricing")
            return False
        
        if saved_data['features'][test_option_key] != 500.0:
            print(f"❌ Option price incorrect: {saved_data['features'][test_option_key]}")
            return False
        
        print("✅ Option saved with correct label, category, and price")
        
        return True
        
    except Exception as e:
        print(f"❌ Custom category flow error: {str(e)}")
        return False

def test_category_order_scenario():
    """Test the category order scenario from review request"""
    print("\n🔍 Testing Category Order Scenario (Review Request)...")
    
    try:
        # Get current prices
        response = requests.get(f"{BACKEND_URL}/prices")
        if response.status_code != 200:
            print("❌ Could not get current prices")
            return False
        
        current_data = response.json()
        
        # Move "Тип дерева" (woodTypes) category to order 1
        test_data = current_data.copy()
        
        # Set woodTypes to order 1 and adjust others
        test_data['categories']['woodTypes']['order'] = 1
        test_data['categories']['shellModels']['order'] = 2
        test_data['categories']['shellColors']['order'] = 3
        test_data['categories']['lidTypes']['order'] = 4
        test_data['categories']['woodColors']['order'] = 5
        test_data['categories']['features']['order'] = 6
        
        # Save the changes
        save_response = requests.post(f"{BACKEND_URL}/prices", json=test_data)
        if save_response.status_code != 200:
            print(f"❌ Failed to save category order: {save_response.status_code}")
            return False
        
        print("✅ Category order updated - 'Тип дерева' moved to first position")
        
        # Verify the order was saved
        verify_response = requests.get(f"{BACKEND_URL}/prices")
        if verify_response.status_code != 200:
            print("❌ Could not verify saved order")
            return False
        
        saved_data = verify_response.json()
        categories = saved_data.get('categories', {})
        
        # Check that woodTypes is now order 1
        if categories['woodTypes']['order'] != 1:
            print(f"❌ woodTypes order incorrect: {categories['woodTypes']['order']}")
            return False
        
        # Check that shellModels is now order 2
        if categories['shellModels']['order'] != 2:
            print(f"❌ shellModels order incorrect: {categories['shellModels']['order']}")
            return False
        
        print("✅ Category order saved correctly - 'Тип дерева' is now first")
        
        return True
        
    except Exception as e:
        print(f"❌ Category order test error: {str(e)}")
        return False

def test_order_with_custom_options():
    """Test creating an order with custom options"""
    print("\n🔍 Testing Order Creation with Custom Options...")
    
    try:
        # Create an order that includes the custom option we created
        test_order = {
            "fullName": "Тестовый Клиент",
            "phoneNumber": "+48111222333",
            "fullAddress": "Варшава, тестовая улица, дом 1",
            "orderDate": "2024-01-25",
            "shellModel": "round200",
            "woodType": "thermo",
            "shellColor": "blue",
            "lidType": "spaLid",
            "woodColor": "natural",
            "sandFilter": "none",
            "features": {
                "jacuzzi": True,
                "test_pump": True  # Our custom option
            },
            "notes": "Заказ с тестовым насосом",
            "total": 2800.0  # 1500 + 300 + 50 + 300 + 0 + 800 + 500 = 3450, but using 2800 for test
        }
        
        response = requests.post(f"{BACKEND_URL}/orders", json=test_order)
        if response.status_code != 200:
            print(f"❌ Failed to create order: {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        saved_order = response.json()
        print("✅ Order with custom option created successfully")
        print(f"✅ Order ID: {saved_order.get('id')}")
        
        # Check that the custom feature was saved
        if 'test_pump' not in saved_order.get('features', {}):
            print("❌ Custom option 'test_pump' not found in saved order")
            return False
        
        if not saved_order['features']['test_pump']:
            print("❌ Custom option 'test_pump' not set to true")
            return False
        
        print("✅ Custom option 'test_pump' correctly saved in order")
        
        return True
        
    except Exception as e:
        print(f"❌ Order with custom options error: {str(e)}")
        return False

def test_pdf_with_custom_options():
    """Test PDF generation with custom options"""
    print("\n🔍 Testing PDF Generation with Custom Options...")
    
    try:
        # Create PDF request with custom option
        pdf_request = {
            "fullName": "Клиент с Дополнениями",
            "phoneNumber": "+48444555666",
            "fullAddress": "Краков, улица Тестовая, дом 5",
            "orderDate": "2024-01-25",
            "shellModel": "square220x220",
            "woodType": "redCedric",
            "shellColor": "pearlBlue",
            "lidType": "glassFiberLid",
            "woodColor": "painted",
            "sandFilter": "none",
            "features": {
                "jacuzzi": True,
                "airBubble": True,
                "test_pump": True  # Our custom option
            },
            "notes": "PDF с тестовым насосом",
            "total": 3950.0,
            "type": "customer"
        }
        
        response = requests.post(f"{BACKEND_URL}/generate-pdf", json=pdf_request)
        if response.status_code != 200:
            print(f"❌ Failed to generate PDF: {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        print("✅ PDF with custom options generated successfully")
        
        # Check content type and size
        content_type = response.headers.get('content-type', '')
        if 'application/pdf' not in content_type:
            print(f"❌ Unexpected content type: {content_type}")
            return False
        
        content_length = len(response.content)
        if content_length < 1000:
            print(f"❌ PDF too small: {content_length} bytes")
            return False
        
        print(f"✅ PDF size: {content_length} bytes")
        
        return True
        
    except Exception as e:
        print(f"❌ PDF with custom options error: {str(e)}")
        return False

def run_comprehensive_tests():
    """Run all comprehensive category management tests"""
    print("🚀 Starting Comprehensive Category Management Tests")
    print("=" * 80)
    
    test_results = {
        "Custom Category Flow": test_custom_category_flow(),
        "Category Order Scenario": test_category_order_scenario(),
        "Order with Custom Options": test_order_with_custom_options(),
        "PDF with Custom Options": test_pdf_with_custom_options()
    }
    
    print("\n" + "=" * 80)
    print("📊 COMPREHENSIVE TEST RESULTS")
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
        print("\n🎉 All comprehensive tests passed!")
    else:
        print(f"\n⚠️  {failed} test(s) failed - see details above")
    
    return test_results

if __name__ == "__main__":
    run_comprehensive_tests()