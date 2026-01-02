"""
Test Web Orders API - Public calculator and admin web orders management
Tests for:
1. GET /api/public/prices - public API for prices (no auth)
2. POST /api/public/web-order - create order without auth
3. GET /api/web-orders - get list of web orders
4. PUT /api/web-orders/{id} - update web order status
5. DELETE /api/web-orders/{id} - delete web order
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPublicPricesAPI:
    """Test public prices endpoint - no auth required"""
    
    def test_get_public_prices_returns_200(self):
        """GET /api/public/prices should return 200"""
        response = requests.get(f"{BASE_URL}/api/public/prices")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ GET /api/public/prices returns 200")
    
    def test_public_prices_has_models(self):
        """Public prices should contain models array"""
        response = requests.get(f"{BASE_URL}/api/public/prices")
        assert response.status_code == 200
        data = response.json()
        assert 'models' in data, "Response should contain 'models' key"
        assert isinstance(data['models'], list), "models should be a list"
        print(f"✓ Public prices contains {len(data['models'])} models")
    
    def test_public_prices_has_categories(self):
        """Public prices should contain categories array"""
        response = requests.get(f"{BASE_URL}/api/public/prices")
        assert response.status_code == 200
        data = response.json()
        assert 'categories' in data, "Response should contain 'categories' key"
        assert isinstance(data['categories'], list), "categories should be a list"
        print(f"✓ Public prices contains {len(data['categories'])} categories")


class TestPublicWebOrderAPI:
    """Test public web order creation - no auth required"""
    
    def test_create_web_order_success(self):
        """POST /api/public/web-order should create order and return success"""
        order_data = {
            "customerName": "TEST_Jan Kowalski",
            "customerPhone": "+48 123 456 789",
            "customerComment": "Test order from pytest",
            "modelId": "model_1",
            "modelName": "Test Model",
            "modelPrice": 5000,
            "heaterVariantType": "external",
            "selections": {},
            "selectedOptions": [],
            "subtotal": 5000,
            "total": 5000,
            "currency": "zł"
        }
        
        response = requests.post(f"{BASE_URL}/api/public/web-order", json=order_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get('success') == True, "Response should have success=True"
        assert 'orderId' in data, "Response should contain orderId"
        assert data['orderId'].startswith('WEB-'), f"Order ID should start with WEB-, got {data['orderId']}"
        print(f"✓ Created web order: {data['orderId']}")
        
        # Store order ID for cleanup
        return data['orderId']
    
    def test_create_web_order_with_options(self):
        """POST /api/public/web-order with selected options"""
        order_data = {
            "customerName": "TEST_Anna Nowak",
            "customerPhone": "+48 987 654 321",
            "customerComment": "Order with options",
            "modelId": "model_2",
            "modelName": "Premium Model",
            "modelPrice": 8000,
            "heaterVariantType": "integrated",
            "selections": {
                "wood_type": "oak",
                "color": "natural"
            },
            "selectedOptions": [
                {"id": "opt1", "name": "LED Lights", "price": 500, "categoryId": "lighting", "categoryName": "Oświetlenie"},
                {"id": "opt2", "name": "Cover", "price": 300, "categoryId": "accessories", "categoryName": "Akcesoria"}
            ],
            "subtotal": 8800,
            "total": 8800,
            "currency": "zł"
        }
        
        response = requests.post(f"{BASE_URL}/api/public/web-order", json=order_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get('success') == True
        print(f"✓ Created web order with options: {data['orderId']}")
        return data['orderId']
    
    def test_create_web_order_missing_required_fields(self):
        """POST /api/public/web-order should fail without required fields"""
        # Missing customerName and customerPhone
        order_data = {
            "modelId": "model_1",
            "total": 5000
        }
        
        response = requests.post(f"{BASE_URL}/api/public/web-order", json=order_data)
        # Should return 422 validation error
        assert response.status_code == 422, f"Expected 422 for missing fields, got {response.status_code}"
        print("✓ Validation error returned for missing required fields")


class TestWebOrdersAdminAPI:
    """Test web orders admin endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create a test order before each test"""
        order_data = {
            "customerName": f"TEST_Fixture_{uuid.uuid4().hex[:8]}",
            "customerPhone": "+48 111 222 333",
            "customerComment": "Fixture order",
            "modelId": "model_test",
            "modelName": "Fixture Model",
            "modelPrice": 3000,
            "total": 3000,
            "currency": "zł"
        }
        response = requests.post(f"{BASE_URL}/api/public/web-order", json=order_data)
        if response.status_code == 200:
            self.test_order_id = response.json().get('orderId')
        else:
            self.test_order_id = None
        yield
        # Cleanup - delete test order
        if self.test_order_id:
            requests.delete(f"{BASE_URL}/api/web-orders/{self.test_order_id}")
    
    def test_get_web_orders_list(self):
        """GET /api/web-orders should return list of orders"""
        response = requests.get(f"{BASE_URL}/api/web-orders")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/web-orders returns {len(data)} orders")
    
    def test_get_web_orders_contains_test_order(self):
        """GET /api/web-orders should contain the created test order"""
        response = requests.get(f"{BASE_URL}/api/web-orders")
        assert response.status_code == 200
        
        data = response.json()
        order_ids = [o.get('id') for o in data]
        assert self.test_order_id in order_ids, f"Test order {self.test_order_id} not found in list"
        print(f"✓ Test order {self.test_order_id} found in web orders list")
    
    def test_get_single_web_order(self):
        """GET /api/web-orders/{id} should return single order"""
        response = requests.get(f"{BASE_URL}/api/web-orders/{self.test_order_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get('id') == self.test_order_id
        assert 'customerName' in data
        assert 'customerPhone' in data
        assert 'status' in data
        print(f"✓ GET /api/web-orders/{self.test_order_id} returns order details")
    
    def test_get_nonexistent_web_order(self):
        """GET /api/web-orders/{id} should return 404 for nonexistent order"""
        response = requests.get(f"{BASE_URL}/api/web-orders/NONEXISTENT-ORDER-ID")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ GET nonexistent order returns 404")
    
    def test_update_web_order_status(self):
        """PUT /api/web-orders/{id} should update order status"""
        # Update status to 'processing'
        response = requests.put(
            f"{BASE_URL}/api/web-orders/{self.test_order_id}",
            json={"status": "processing"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get('status') == 'processing', f"Expected status 'processing', got {data.get('status')}"
        print(f"✓ Updated order status to 'processing'")
        
        # Verify with GET
        verify_response = requests.get(f"{BASE_URL}/api/web-orders/{self.test_order_id}")
        assert verify_response.status_code == 200
        assert verify_response.json().get('status') == 'processing'
        print("✓ Status change verified with GET")
    
    def test_update_web_order_notes(self):
        """PUT /api/web-orders/{id} should update manager notes"""
        notes = "Manager notes: Customer called, confirmed order"
        response = requests.put(
            f"{BASE_URL}/api/web-orders/{self.test_order_id}",
            json={"notes": notes}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get('notes') == notes
        print("✓ Updated order notes")
    
    def test_update_nonexistent_web_order(self):
        """PUT /api/web-orders/{id} should return 404 for nonexistent order"""
        response = requests.put(
            f"{BASE_URL}/api/web-orders/NONEXISTENT-ORDER-ID",
            json={"status": "completed"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ PUT nonexistent order returns 404")
    
    def test_delete_web_order(self):
        """DELETE /api/web-orders/{id} should delete order"""
        # Create a separate order for deletion test
        order_data = {
            "customerName": "TEST_ToDelete",
            "customerPhone": "+48 000 000 000",
            "total": 1000,
            "currency": "zł"
        }
        create_response = requests.post(f"{BASE_URL}/api/public/web-order", json=order_data)
        assert create_response.status_code == 200
        delete_order_id = create_response.json().get('orderId')
        
        # Delete the order
        response = requests.delete(f"{BASE_URL}/api/web-orders/{delete_order_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ Deleted order {delete_order_id}")
        
        # Verify deletion
        verify_response = requests.get(f"{BASE_URL}/api/web-orders/{delete_order_id}")
        assert verify_response.status_code == 404, "Deleted order should return 404"
        print("✓ Deletion verified - order not found")
    
    def test_delete_nonexistent_web_order(self):
        """DELETE /api/web-orders/{id} should return 404 for nonexistent order"""
        response = requests.delete(f"{BASE_URL}/api/web-orders/NONEXISTENT-ORDER-ID")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ DELETE nonexistent order returns 404")


class TestNewOrdersCount:
    """Test new orders count endpoint for notifications"""
    
    def test_get_new_orders_count(self):
        """GET /api/web-orders/new-count should return count of new orders"""
        response = requests.get(f"{BASE_URL}/api/web-orders/new-count")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert 'count' in data, "Response should contain 'count' key"
        assert isinstance(data['count'], int), "count should be an integer"
        print(f"✓ New orders count: {data['count']}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_orders(self):
        """Delete all TEST_ prefixed orders"""
        response = requests.get(f"{BASE_URL}/api/web-orders")
        if response.status_code == 200:
            orders = response.json()
            deleted = 0
            for order in orders:
                if order.get('customerName', '').startswith('TEST_'):
                    del_response = requests.delete(f"{BASE_URL}/api/web-orders/{order['id']}")
                    if del_response.status_code == 200:
                        deleted += 1
            print(f"✓ Cleaned up {deleted} test orders")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
