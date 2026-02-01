"""
Comprehensive tests for Sauna Calculator API endpoints.
Tests: prices, models, categories, orders, wizard-steps, generate-pdf
"""
import pytest
import requests
import os
import json
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSaunaPricesAPI:
    """Tests for /api/sauna/prices endpoint"""
    
    def test_get_prices_returns_200(self):
        """GET /api/sauna/prices should return 200 and price data"""
        response = requests.get(f"{BASE_URL}/api/sauna/prices")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "models" in data, "Response should contain 'models' key"
        assert "categories" in data, "Response should contain 'categories' key"
        assert isinstance(data["models"], list), "Models should be a list"
        assert isinstance(data["categories"], list), "Categories should be a list"
        print(f"✓ GET /api/sauna/prices: {len(data['models'])} models, {len(data['categories'])} categories")
    
    def test_prices_models_structure(self):
        """Verify model structure in prices response"""
        response = requests.get(f"{BASE_URL}/api/sauna/prices")
        assert response.status_code == 200
        
        data = response.json()
        if data["models"]:
            model = data["models"][0]
            required_fields = ["id", "name", "basePrice"]
            for field in required_fields:
                assert field in model, f"Model should have '{field}' field"
            print(f"✓ Model structure valid: {model['name']}")
    
    def test_prices_categories_structure(self):
        """Verify category structure in prices response"""
        response = requests.get(f"{BASE_URL}/api/sauna/prices")
        assert response.status_code == 200
        
        data = response.json()
        if data["categories"]:
            category = data["categories"][0]
            required_fields = ["id", "name"]
            for field in required_fields:
                assert field in category, f"Category should have '{field}' field"
            print(f"✓ Category structure valid: {category['name']}")


class TestSaunaWizardStepsAPI:
    """Tests for /api/sauna/wizard-steps endpoint"""
    
    def test_get_wizard_steps_returns_200(self):
        """GET /api/sauna/wizard-steps should return 200 and steps data"""
        response = requests.get(f"{BASE_URL}/api/sauna/wizard-steps")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should have at least one wizard step"
        print(f"✓ GET /api/sauna/wizard-steps: {len(data)} steps")
    
    def test_wizard_steps_structure(self):
        """Verify wizard step structure"""
        response = requests.get(f"{BASE_URL}/api/sauna/wizard-steps")
        assert response.status_code == 200
        
        data = response.json()
        if data:
            step = data[0]
            required_fields = ["id", "name", "isActive"]
            for field in required_fields:
                assert field in step, f"Step should have '{field}' field"
            print(f"✓ Wizard step structure valid: {step['name']}")
    
    def test_wizard_steps_sorted_by_order(self):
        """Verify wizard steps are sorted by sortOrder"""
        response = requests.get(f"{BASE_URL}/api/sauna/wizard-steps")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 1:
            sort_orders = [step.get("sortOrder", 0) for step in data]
            assert sort_orders == sorted(sort_orders), "Steps should be sorted by sortOrder"
            print(f"✓ Wizard steps sorted correctly: {sort_orders}")


class TestSaunaOrdersAPI:
    """Tests for /api/sauna/orders CRUD endpoints"""
    
    @pytest.fixture
    def test_order_data(self):
        """Generate test order data"""
        return {
            "id": f"TEST-SAUNA-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "fullName": "TEST_Sauna_Customer",
            "phoneNumber": "+48123456789",
            "email": "test@example.com",
            "fullAddress": "Test Address 123",
            "orderDate": datetime.now().strftime("%Y-%m-%d"),
            "selectedModel": "sauna_kwadro_beczka_235x200_cm",
            "modelName": "Sauna Kwadro-Beczka 235x200 cm",
            "basePrice": 14200,
            "foundationPrice": 150,
            "discountPercent": 0,
            "selections": {},
            "quantities": {},
            "selectedOptions": [],
            "notes": "Test order for API testing",
            "total": 14200,
            "createdBy": "test_user"
        }
    
    def test_get_orders_returns_200(self):
        """GET /api/sauna/orders should return 200"""
        response = requests.get(f"{BASE_URL}/api/sauna/orders")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/sauna/orders: {len(data)} orders")
    
    def test_create_order_returns_200(self, test_order_data):
        """POST /api/sauna/orders should create order"""
        response = requests.post(
            f"{BASE_URL}/api/sauna/orders",
            json=test_order_data,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("id") == test_order_data["id"], "Order ID should match"
        assert data.get("fullName") == test_order_data["fullName"], "Full name should match"
        print(f"✓ POST /api/sauna/orders: Created order {data.get('id')}")
        
        # Cleanup - delete test order
        requests.delete(f"{BASE_URL}/api/sauna/orders/{test_order_data['id']}")
    
    def test_get_single_order(self, test_order_data):
        """GET /api/sauna/orders/{id} should return specific order"""
        # First create an order
        create_response = requests.post(
            f"{BASE_URL}/api/sauna/orders",
            json=test_order_data,
            headers={"Content-Type": "application/json"}
        )
        assert create_response.status_code == 200
        
        # Then get it
        response = requests.get(f"{BASE_URL}/api/sauna/orders/{test_order_data['id']}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("id") == test_order_data["id"], "Order ID should match"
        print(f"✓ GET /api/sauna/orders/{test_order_data['id']}: Found order")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/sauna/orders/{test_order_data['id']}")
    
    def test_update_order(self, test_order_data):
        """PUT /api/sauna/orders/{id} should update order"""
        # First create an order
        create_response = requests.post(
            f"{BASE_URL}/api/sauna/orders",
            json=test_order_data,
            headers={"Content-Type": "application/json"}
        )
        assert create_response.status_code == 200
        
        # Update it
        test_order_data["notes"] = "Updated test notes"
        test_order_data["total"] = 15000
        
        response = requests.put(
            f"{BASE_URL}/api/sauna/orders/{test_order_data['id']}",
            json=test_order_data,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("notes") == "Updated test notes", "Notes should be updated"
        assert data.get("total") == 15000, "Total should be updated"
        print(f"✓ PUT /api/sauna/orders/{test_order_data['id']}: Updated order")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/sauna/orders/{test_order_data['id']}")
    
    def test_delete_order(self, test_order_data):
        """DELETE /api/sauna/orders/{id} should delete order"""
        # First create an order
        create_response = requests.post(
            f"{BASE_URL}/api/sauna/orders",
            json=test_order_data,
            headers={"Content-Type": "application/json"}
        )
        assert create_response.status_code == 200
        
        # Delete it
        response = requests.delete(f"{BASE_URL}/api/sauna/orders/{test_order_data['id']}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify it's deleted
        get_response = requests.get(f"{BASE_URL}/api/sauna/orders/{test_order_data['id']}")
        assert get_response.status_code == 404, "Order should not exist after deletion"
        print(f"✓ DELETE /api/sauna/orders/{test_order_data['id']}: Order deleted")
    
    def test_get_nonexistent_order_returns_404(self):
        """GET /api/sauna/orders/{id} should return 404 for non-existent order"""
        response = requests.get(f"{BASE_URL}/api/sauna/orders/NONEXISTENT-ORDER-ID")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ GET /api/sauna/orders/NONEXISTENT: Returns 404")


class TestSaunaModelsAPI:
    """Tests for /api/sauna/models CRUD endpoints"""
    
    @pytest.fixture
    def test_model_data(self):
        """Generate test model data"""
        return {
            "id": f"TEST_model_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "name": "TEST Sauna Model",
            "basePrice": 10000,
            "foundationPrice": 100,
            "discount": 5,
            "imageUrl": "",
            "sortOrder": 999,
            "active": True
        }
    
    def test_create_model(self, test_model_data):
        """POST /api/sauna/models should create model"""
        response = requests.post(
            f"{BASE_URL}/api/sauna/models",
            json=test_model_data,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "model" in data or data.get("message") == "Model added successfully"
        print(f"✓ POST /api/sauna/models: Created model {test_model_data['id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/sauna/models/{test_model_data['id']}")
    
    def test_update_model(self, test_model_data):
        """PUT /api/sauna/models/{id} should update model"""
        # First create
        requests.post(
            f"{BASE_URL}/api/sauna/models",
            json=test_model_data,
            headers={"Content-Type": "application/json"}
        )
        
        # Update
        test_model_data["name"] = "TEST Updated Model Name"
        test_model_data["basePrice"] = 12000
        
        response = requests.put(
            f"{BASE_URL}/api/sauna/models/{test_model_data['id']}",
            json=test_model_data,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ PUT /api/sauna/models/{test_model_data['id']}: Updated model")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/sauna/models/{test_model_data['id']}")
    
    def test_delete_model(self, test_model_data):
        """DELETE /api/sauna/models/{id} should delete model"""
        # First create
        requests.post(
            f"{BASE_URL}/api/sauna/models",
            json=test_model_data,
            headers={"Content-Type": "application/json"}
        )
        
        # Delete
        response = requests.delete(f"{BASE_URL}/api/sauna/models/{test_model_data['id']}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ DELETE /api/sauna/models/{test_model_data['id']}: Deleted model")


class TestSaunaCategoriesAPI:
    """Tests for /api/sauna/categories CRUD endpoints"""
    
    @pytest.fixture
    def test_category_data(self):
        """Generate test category data"""
        return {
            "id": f"TEST_category_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "name": "TEST Category",
            "inputType": "radio",
            "sortOrder": 999,
            "options": []
        }
    
    def test_create_category(self, test_category_data):
        """POST /api/sauna/categories should create category"""
        response = requests.post(
            f"{BASE_URL}/api/sauna/categories",
            json=test_category_data,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ POST /api/sauna/categories: Created category {test_category_data['id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/sauna/categories/{test_category_data['id']}")
    
    def test_update_category(self, test_category_data):
        """PUT /api/sauna/categories/{id} should update category"""
        # First create
        requests.post(
            f"{BASE_URL}/api/sauna/categories",
            json=test_category_data,
            headers={"Content-Type": "application/json"}
        )
        
        # Update
        test_category_data["name"] = "TEST Updated Category"
        
        response = requests.put(
            f"{BASE_URL}/api/sauna/categories/{test_category_data['id']}",
            json=test_category_data,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ PUT /api/sauna/categories/{test_category_data['id']}: Updated category")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/sauna/categories/{test_category_data['id']}")
    
    def test_delete_category(self, test_category_data):
        """DELETE /api/sauna/categories/{id} should delete category"""
        # First create
        requests.post(
            f"{BASE_URL}/api/sauna/categories",
            json=test_category_data,
            headers={"Content-Type": "application/json"}
        )
        
        # Delete
        response = requests.delete(f"{BASE_URL}/api/sauna/categories/{test_category_data['id']}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ DELETE /api/sauna/categories/{test_category_data['id']}: Deleted category")


class TestSaunaPDFGeneration:
    """Tests for /api/sauna/generate-pdf endpoint"""
    
    def test_generate_pdf_returns_pdf(self):
        """POST /api/sauna/generate-pdf should return PDF file"""
        pdf_request = {
            "orderId": "TEST-PDF-001",
            "fullName": "Test Customer",
            "phoneNumber": "+48123456789",
            "email": "test@example.com",
            "fullAddress": "Test Address",
            "orderDate": datetime.now().strftime("%Y-%m-%d"),
            "selectedModel": "sauna_kwadro_beczka_235x200_cm",
            "modelName": "Sauna Kwadro-Beczka 235x200 cm",
            "basePrice": 14200,
            "selections": {},
            "quantities": {},
            "notes": "Test PDF generation",
            "total": 14200
        }
        
        response = requests.post(
            f"{BASE_URL}/api/sauna/generate-pdf",
            json=pdf_request,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert response.headers.get("content-type") == "application/pdf", "Response should be PDF"
        assert len(response.content) > 0, "PDF content should not be empty"
        print(f"✓ POST /api/sauna/generate-pdf: Generated PDF ({len(response.content)} bytes)")
    
    def test_generate_pdf_with_options(self):
        """POST /api/sauna/generate-pdf with selected options"""
        pdf_request = {
            "orderId": "TEST-PDF-002",
            "fullName": "Test Customer With Options",
            "phoneNumber": "+48123456789",
            "email": "test@example.com",
            "fullAddress": "Test Address",
            "orderDate": datetime.now().strftime("%Y-%m-%d"),
            "selectedModel": "sauna_kwadro_beczka_235x200_cm",
            "modelName": "Sauna Kwadro-Beczka 235x200 cm",
            "basePrice": 14200,
            "selections": {"kolor": "impregnacja_gratis"},
            "quantities": {},
            "selectedOptions": [
                {
                    "categoryId": "kolor",
                    "categoryName": "Kolor",
                    "optionId": "impregnacja_gratis",
                    "optionName": "Impregnacja zewnętrzna",
                    "price": 0,
                    "quantity": 1,
                    "totalPrice": 0
                }
            ],
            "notes": "Test PDF with options",
            "total": 14200
        }
        
        response = requests.post(
            f"{BASE_URL}/api/sauna/generate-pdf",
            json=pdf_request,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.headers.get("content-type") == "application/pdf"
        print(f"✓ POST /api/sauna/generate-pdf with options: Generated PDF ({len(response.content)} bytes)")


class TestLayoutVariantsAPI:
    """Tests for /api/faq/layout-variants endpoint (used by Layout Catalog)"""
    
    def test_get_layout_variants_returns_200(self):
        """GET /api/faq/layout-variants should return 200"""
        response = requests.get(f"{BASE_URL}/api/faq/layout-variants")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/faq/layout-variants: {len(data)} layout variants")
    
    def test_layout_variants_structure(self):
        """Verify layout variant structure"""
        response = requests.get(f"{BASE_URL}/api/faq/layout-variants")
        assert response.status_code == 200
        
        data = response.json()
        if data:
            variant = data[0]
            # Check for expected fields
            expected_fields = ["modelSize", "variantName"]
            for field in expected_fields:
                if field in variant:
                    print(f"✓ Layout variant has '{field}': {variant.get(field)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
