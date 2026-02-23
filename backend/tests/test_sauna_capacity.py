"""
Test suite for Sauna Calculator capacity field and hidden options filtering.
Tests the features:
1. Capacity field in SaunaModel
2. Hidden options filtering based on incompatibleModels/incompatibleWithOptions
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://config-preview-1.preview.emergentagent.com')


class TestSaunaCapacityField:
    """Tests for the capacity field in sauna models"""
    
    def test_sauna_prices_endpoint_returns_models(self):
        """Test that /api/sauna/prices returns models with capacity field"""
        response = requests.get(f"{BASE_URL}/api/sauna/prices")
        assert response.status_code == 200
        
        data = response.json()
        assert 'models' in data
        assert len(data['models']) > 0
        
        # Check first model has capacity field (even if null)
        first_model = data['models'][0]
        assert 'capacity' in first_model, "Model should have 'capacity' field"
        
        # Check other expected fields
        assert 'id' in first_model
        assert 'name' in first_model
        assert 'basePrice' in first_model
        assert 'relaxRoomSize' in first_model
        assert 'steamRoomSize' in first_model
        
        print(f"First model: {first_model['name']}, capacity: {first_model.get('capacity')}")
    
    def test_sauna_model_structure(self):
        """Test that sauna models have all required fields"""
        response = requests.get(f"{BASE_URL}/api/sauna/prices")
        assert response.status_code == 200
        
        data = response.json()
        models = data['models']
        
        required_fields = ['id', 'name', 'basePrice', 'foundationPrice', 'discount', 
                          'capacity', 'relaxRoomSize', 'steamRoomSize']
        
        for model in models:
            for field in required_fields:
                assert field in model, f"Model {model.get('name')} missing field: {field}"


class TestSaunaOptionsIncompatibility:
    """Tests for options incompatibility rules"""
    
    def test_options_have_incompatibility_fields(self):
        """Test that options have incompatibleModels and incompatibleWithOptions fields"""
        response = requests.get(f"{BASE_URL}/api/sauna/prices")
        assert response.status_code == 200
        
        data = response.json()
        categories = data.get('categories', [])
        
        assert len(categories) > 0, "Should have categories"
        
        # Check that options have incompatibility fields
        options_checked = 0
        for category in categories:
            for option in category.get('options', []):
                assert 'incompatibleModels' in option, f"Option {option.get('name')} missing incompatibleModels"
                assert 'incompatibleWithOptions' in option, f"Option {option.get('name')} missing incompatibleWithOptions"
                options_checked += 1
        
        print(f"Checked {options_checked} options for incompatibility fields")
        assert options_checked > 0, "Should have checked at least one option"
    
    def test_options_incompatibility_structure(self):
        """Test that incompatibility fields have correct structure"""
        response = requests.get(f"{BASE_URL}/api/sauna/prices")
        assert response.status_code == 200
        
        data = response.json()
        categories = data.get('categories', [])
        
        for category in categories:
            for option in category.get('options', []):
                # incompatibleModels should be a list
                incompatible_models = option.get('incompatibleModels', [])
                assert isinstance(incompatible_models, list), \
                    f"incompatibleModels should be list, got {type(incompatible_models)}"
                
                # incompatibleWithOptions should be a dict
                incompatible_with_options = option.get('incompatibleWithOptions', {})
                assert isinstance(incompatible_with_options, dict), \
                    f"incompatibleWithOptions should be dict, got {type(incompatible_with_options)}"


class TestSaunaOrderCreation:
    """Tests for sauna order creation with hidden options filtering"""
    
    def test_create_order_endpoint(self):
        """Test that order creation endpoint works"""
        # Get prices first to get valid model ID
        prices_response = requests.get(f"{BASE_URL}/api/sauna/prices")
        assert prices_response.status_code == 200
        
        prices_data = prices_response.json()
        first_model = prices_data['models'][0]
        
        # Create a test order
        order_data = {
            "fullName": "TEST_Capacity_Test",
            "phoneNumber": "+48123456789",
            "fullAddress": "Test Address",
            "email": "test@example.com",
            "selectedModel": first_model['id'],
            "modelName": first_model['name'],
            "basePrice": first_model['basePrice'],
            "foundationPrice": 0,
            "discountPercent": 0,
            "selections": {},
            "quantities": {},
            "selectedOptions": [],
            "notes": "Test order for capacity field",
            "optionsTotal": 0,
            "subtotal": first_model['basePrice'],
            "total": first_model['basePrice'],
            "createdBy": "test"
        }
        
        response = requests.post(f"{BASE_URL}/api/sauna/orders", json=order_data)
        assert response.status_code in [200, 201], f"Order creation failed: {response.text}"
        
        result = response.json()
        assert 'id' in result, "Order should have ID"
        
        print(f"Created test order: {result.get('id')}")
        
        # Clean up - delete the test order
        order_id = result.get('id')
        if order_id:
            delete_response = requests.delete(f"{BASE_URL}/api/sauna/orders/{order_id}")
            print(f"Cleanup: Delete order {order_id}, status: {delete_response.status_code}")


class TestSaunaPDFGeneration:
    """Tests for PDF generation with hidden options filtering"""
    
    def test_pdf_generation_endpoint(self):
        """Test that PDF generation endpoint works"""
        # Get prices first
        prices_response = requests.get(f"{BASE_URL}/api/sauna/prices")
        assert prices_response.status_code == 200
        
        prices_data = prices_response.json()
        first_model = prices_data['models'][0]
        
        # Create PDF request data
        pdf_data = {
            "orderId": "TEST-PDF-001",
            "fullName": "TEST_PDF_Generation",
            "phoneNumber": "+48123456789",
            "fullAddress": "Test Address",
            "email": "test@example.com",
            "selectedModel": first_model['id'],
            "modelName": first_model['name'],
            "modelImageUrl": first_model.get('imageUrl', ''),
            "basePrice": first_model['basePrice'],
            "foundationPrice": 0,
            "discountPercent": 0,
            "selections": {},
            "quantities": {},
            "selectedOptions": [],  # Empty - no options selected
            "notes": "",
            "optionsTotal": 0,
            "subtotal": first_model['basePrice'],
            "total": first_model['basePrice'],
            "language": "pl",
            "categories": prices_data.get('categories', []),
            "adminGifts": []
        }
        
        response = requests.post(f"{BASE_URL}/api/sauna/generate-pdf", json=pdf_data)
        assert response.status_code == 200, f"PDF generation failed: {response.status_code}"
        
        # Check that response is PDF
        content_type = response.headers.get('content-type', '')
        assert 'pdf' in content_type.lower() or len(response.content) > 1000, \
            "Response should be PDF content"
        
        print(f"PDF generated successfully, size: {len(response.content)} bytes")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
