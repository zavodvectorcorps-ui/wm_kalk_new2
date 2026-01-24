"""
Test amoCRM Widget Edit Order Flow - P0 Blocker Fix Verification
Tests the critical fix for:
1. amocrm_id preservation when editing orders
2. Change history tracking in orders
3. Widget displays change history section
4. Order loading for edit via URL with amocrm_id parameter
5. amoCRM data restoration from editingOrder
"""
import pytest
import requests
import os
import json
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://sauna-variant.preview.emergentagent.com').rstrip('/')

class TestAmoCRMWidgetEditFlow:
    """Test amoCRM widget edit order functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.test_amocrm_id = "TEST-AMO-12345"
        self.test_order_id = f"TEST-WIDGET-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        yield
        # Cleanup - delete test order
        try:
            self.session.delete(f"{BASE_URL}/api/orders/{self.test_order_id}")
        except:
            pass
    
    def test_01_create_order_with_amocrm_id(self):
        """Test creating an order with amocrm_id"""
        order_data = {
            "id": self.test_order_id,
            "fullName": "Test Widget Client",
            "phoneNumber": "+48111222333",
            "email": "widget@test.com",
            "fullAddress": "Widget Test Address 456",
            "orderDate": datetime.now().strftime("%Y-%m-%d"),
            "modelId": "model1",
            "modelName": "Test Model",
            "heaterType": "integrated",
            "total": 7500,
            "currency": "PLN",
            "currencySymbol": "zł",
            "amocrm_id": self.test_amocrm_id,
            "amocrm_link": f"https://test.amocrm.com/leads/detail/{self.test_amocrm_id}",
            "amocrm_name": "Widget Test Lead",
            "selectedOptions": [],
            "pdfGenerated": True,
            "createdBy": "test_agent"
        }
        
        response = self.session.post(f"{BASE_URL}/api/orders", json=order_data)
        assert response.status_code == 200, f"Failed to create order: {response.text}"
        
        data = response.json()
        assert data["id"] == self.test_order_id
        assert data["amocrm_id"] == self.test_amocrm_id
        assert data["amocrm_link"] == f"https://test.amocrm.com/leads/detail/{self.test_amocrm_id}"
        assert data["amocrm_name"] == "Widget Test Lead"
        print(f"✓ Order created with amocrm_id: {self.test_amocrm_id}")
    
    def test_02_get_order_preserves_amocrm_id(self):
        """Test that GET order returns amocrm_id correctly"""
        # First create the order
        self.test_01_create_order_with_amocrm_id()
        
        # Then fetch it
        response = self.session.get(f"{BASE_URL}/api/orders/{self.test_order_id}")
        assert response.status_code == 200, f"Failed to get order: {response.text}"
        
        data = response.json()
        assert data["amocrm_id"] == self.test_amocrm_id, "amocrm_id not preserved in GET"
        assert data["amocrm_link"] is not None, "amocrm_link should be present"
        print(f"✓ GET order preserves amocrm_id: {data['amocrm_id']}")
    
    def test_03_update_order_preserves_amocrm_id(self):
        """Test that updating order preserves amocrm_id and tracks changes"""
        # First create the order
        self.test_01_create_order_with_amocrm_id()
        
        # Get current order
        response = self.session.get(f"{BASE_URL}/api/orders/{self.test_order_id}")
        current_order = response.json()
        
        # Update order with new data but keep amocrm_id
        current_order["fullName"] = "Updated Widget Client"
        current_order["total"] = 8500
        current_order["updatedBy"] = "test_editor"
        
        response = self.session.put(f"{BASE_URL}/api/orders/{self.test_order_id}", json=current_order)
        assert response.status_code == 200, f"Failed to update order: {response.text}"
        
        updated = response.json()
        
        # Verify amocrm_id is preserved
        assert updated["amocrm_id"] == self.test_amocrm_id, "amocrm_id lost after update!"
        assert updated["fullName"] == "Updated Widget Client"
        assert updated["total"] == 8500
        
        # Verify change history is tracked
        assert "changeHistory" in updated, "changeHistory should be present"
        assert len(updated["changeHistory"]) > 0, "changeHistory should have entries"
        
        last_change = updated["changeHistory"][-1]
        assert "timestamp" in last_change
        assert "changes" in last_change
        assert "changedBy" in last_change
        
        print(f"✓ Update preserves amocrm_id: {updated['amocrm_id']}")
        print(f"✓ Change history tracked: {len(updated['changeHistory'])} entries")
    
    def test_04_widget_embed_shows_order_with_amocrm_id(self):
        """Test widget embed endpoint shows order found by amocrm_id"""
        # First create the order
        self.test_01_create_order_with_amocrm_id()
        
        # Get widget embed
        response = self.session.get(f"{BASE_URL}/api/widget/embed/light/{self.test_amocrm_id}")
        assert response.status_code == 200, f"Widget embed failed: {response.text}"
        
        html = response.text
        
        # Verify order is found and displayed
        assert self.test_order_id in html, "Order ID should be in widget HTML"
        assert "Редактировать заказ" in html, "Edit button should be present"
        assert f"amocrm_id={self.test_amocrm_id}" in html, "Edit URL should contain amocrm_id"
        assert "edit=true" in html, "Edit URL should have edit=true parameter"
        
        print(f"✓ Widget shows order with edit button")
        print(f"✓ Edit URL contains amocrm_id={self.test_amocrm_id}")
    
    def test_05_widget_shows_change_history(self):
        """Test widget displays change history section"""
        # First create and update the order to have change history
        self.test_03_update_order_preserves_amocrm_id()
        
        # Get widget embed
        response = self.session.get(f"{BASE_URL}/api/widget/embed/light/{self.test_amocrm_id}")
        assert response.status_code == 200
        
        html = response.text
        
        # Verify change history section is displayed
        assert "История изменений" in html, "Change history section should be displayed"
        
        print(f"✓ Widget displays change history section")
    
    def test_06_orders_list_endpoint_correct(self):
        """Test that /api/orders endpoint works (not /api/balia/orders)"""
        response = self.session.get(f"{BASE_URL}/api/orders")
        assert response.status_code == 200, f"GET /api/orders failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Orders should be a list"
        
        print(f"✓ /api/orders endpoint works correctly, returned {len(data)} orders")
    
    def test_07_find_order_by_amocrm_id_in_list(self):
        """Test finding order by amocrm_id in orders list"""
        # First create the order
        self.test_01_create_order_with_amocrm_id()
        
        # Get all orders
        response = self.session.get(f"{BASE_URL}/api/orders")
        assert response.status_code == 200
        
        orders = response.json()
        
        # Find order with our amocrm_id
        found_order = None
        for order in orders:
            if order.get("amocrm_id") == self.test_amocrm_id:
                found_order = order
                break
        
        assert found_order is not None, f"Order with amocrm_id={self.test_amocrm_id} not found in list"
        assert found_order["id"] == self.test_order_id
        
        print(f"✓ Order found by amocrm_id in orders list")
    
    def test_08_widget_delivery_status_endpoint(self):
        """Test widget delivery status endpoint"""
        # First create the order
        self.test_01_create_order_with_amocrm_id()
        
        response = self.session.get(f"{BASE_URL}/api/widget/delivery-status/{self.test_amocrm_id}")
        assert response.status_code == 200, f"Delivery status failed: {response.text}"
        
        data = response.json()
        assert data["found"] == True, "Order should be found"
        assert data["orderId"] == self.test_order_id
        assert data["section"] == "balia"
        
        print(f"✓ Delivery status endpoint works for amocrm_id")


class TestExistingTestOrder:
    """Test with the existing TEST-AMO-001 order"""
    
    def test_existing_order_in_widget(self):
        """Test that existing TEST-AMO-001 order shows in widget"""
        session = requests.Session()
        
        response = session.get(f"{BASE_URL}/api/widget/embed/light/12345678")
        assert response.status_code == 200
        
        html = response.text
        assert "TEST-AMO-001" in html, "TEST-AMO-001 should be in widget"
        assert "Редактировать заказ" in html, "Edit button should be present"
        
        print(f"✓ Existing TEST-AMO-001 order shows in widget with edit button")
    
    def test_existing_order_has_amocrm_id(self):
        """Test that existing order has amocrm_id preserved"""
        session = requests.Session()
        
        response = session.get(f"{BASE_URL}/api/orders/TEST-AMO-001")
        assert response.status_code == 200
        
        data = response.json()
        assert data["amocrm_id"] == "12345678", "amocrm_id should be 12345678"
        
        print(f"✓ Existing order has amocrm_id: {data['amocrm_id']}")


class TestSaunaOrdersEndpoint:
    """Test sauna orders endpoint for amocrm_id support"""
    
    def test_sauna_orders_endpoint(self):
        """Test /api/sauna/orders endpoint exists"""
        session = requests.Session()
        
        response = session.get(f"{BASE_URL}/api/sauna/orders")
        assert response.status_code == 200, f"GET /api/sauna/orders failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Sauna orders should be a list"
        
        print(f"✓ /api/sauna/orders endpoint works, returned {len(data)} orders")


class TestWidgetURLGeneration:
    """Test widget URL generation for edit flow"""
    
    def test_calculator_url_endpoint(self):
        """Test calculator URL generation endpoint"""
        session = requests.Session()
        
        response = session.get(f"{BASE_URL}/api/widget/calculator-url?lead_id=12345678&calculator=balia")
        assert response.status_code == 200
        
        data = response.json()
        assert "url" in data
        assert "12345678" in data["url"]
        
        print(f"✓ Calculator URL generated: {data['url']}")
    
    def test_embed_info_endpoint(self):
        """Test embed info endpoint"""
        session = requests.Session()
        
        response = session.get(f"{BASE_URL}/api/widget/embed-info")
        assert response.status_code == 200
        
        data = response.json()
        assert "base_url" in data
        assert "embed_url_template" in data
        
        print(f"✓ Embed info endpoint works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
