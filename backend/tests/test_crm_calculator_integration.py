"""Tests for CRM-Calculator Integration Feature
Tests the connection between CRM leads and calculator orders for tech spec generation.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCRMCalculatorIntegration:
    """Test CRM Calculator Integration endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "admin", "password": "admin123"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_get_linked_calculator_order_with_linked_lead(self):
        """Test GET /api/sauna-crm/leads/{lead_id}/calculator-order with linked order"""
        # CRM-TEST-001 has a linked calculator order WMS-20-02-2026-104724
        response = requests.get(
            f"{BASE_URL}/api/sauna-crm/leads/CRM-TEST-001/calculator-order",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify linked status
        assert data.get("linked") == True
        assert data.get("order") is not None
        
        # Verify order data structure
        order = data["order"]
        assert "id" in order
        assert "modelName" in order
        assert order["id"] == "WMS-20-02-2026-104724"
        assert "fullName" in order
        assert "phoneNumber" in order
    
    def test_get_linked_calculator_order_without_linked_order(self):
        """Test GET /api/sauna-crm/leads/{lead_id}/calculator-order without linked order"""
        # CRM-942B9B7B does not have a linked order
        response = requests.get(
            f"{BASE_URL}/api/sauna-crm/leads/CRM-942B9B7B/calculator-order",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("linked") == False
        assert data.get("order") is None
    
    def test_get_linked_calculator_order_nonexistent_lead(self):
        """Test GET /api/sauna-crm/leads/{lead_id}/calculator-order with nonexistent lead"""
        response = requests.get(
            f"{BASE_URL}/api/sauna-crm/leads/NONEXISTENT-LEAD/calculator-order",
            headers=self.headers
        )
        assert response.status_code == 404
    
    def test_link_calculator_order_success(self):
        """Test POST /api/sauna-crm/leads/{lead_id}/link-calculator-order"""
        # First unlink CRM-59FC9032 if needed
        lead_response = requests.get(
            f"{BASE_URL}/api/sauna-crm/leads/CRM-59FC9032",
            headers=self.headers
        )
        
        if lead_response.status_code == 200:
            # Link a sauna order to this lead
            response = requests.post(
                f"{BASE_URL}/api/sauna-crm/leads/CRM-59FC9032/link-calculator-order",
                headers=self.headers,
                json={"orderId": "WMS-20-02-2026-105210"}
            )
            assert response.status_code == 200
            data = response.json()
            
            assert data.get("status") == "ok"
            assert data.get("order") is not None
            assert data["order"]["id"] == "WMS-20-02-2026-105210"
            
            # Verify the lead was updated
            assert data.get("lead") is not None
            assert data["lead"]["calculatorOrderId"] == "WMS-20-02-2026-105210"
    
    def test_link_calculator_order_missing_order_id(self):
        """Test POST /api/sauna-crm/leads/{lead_id}/link-calculator-order without orderId"""
        response = requests.post(
            f"{BASE_URL}/api/sauna-crm/leads/CRM-TEST-001/link-calculator-order",
            headers=self.headers,
            json={}
        )
        assert response.status_code == 400
        data = response.json()
        assert "orderid" in data.get("detail", "").lower()
    
    def test_link_calculator_order_nonexistent_order(self):
        """Test POST /api/sauna-crm/leads/{lead_id}/link-calculator-order with nonexistent order"""
        response = requests.post(
            f"{BASE_URL}/api/sauna-crm/leads/CRM-TEST-001/link-calculator-order",
            headers=self.headers,
            json={"orderId": "NONEXISTENT-ORDER-ID"}
        )
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data.get("detail", "").lower()
    
    def test_link_calculator_order_nonexistent_lead(self):
        """Test POST /api/sauna-crm/leads/{lead_id}/link-calculator-order with nonexistent lead"""
        response = requests.post(
            f"{BASE_URL}/api/sauna-crm/leads/NONEXISTENT-LEAD/link-calculator-order",
            headers=self.headers,
            json={"orderId": "WMS-20-02-2026-104724"}
        )
        assert response.status_code == 404
    
    def test_open_calculator_returns_data(self):
        """Test POST /api/sauna-crm/leads/{lead_id}/open-calculator"""
        response = requests.post(
            f"{BASE_URL}/api/sauna-crm/leads/CRM-TEST-001/open-calculator",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "calculatorData" in data
        calc_data = data["calculatorData"]
        assert "crmLeadId" in calc_data
        assert calc_data["crmLeadId"] == "CRM-TEST-001"
    
    def test_order_data_has_required_fields_for_tech_spec(self):
        """Verify linked order has fields needed by TechSpecModal"""
        response = requests.get(
            f"{BASE_URL}/api/sauna-crm/leads/CRM-TEST-001/calculator-order",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        order = data.get("order")
        
        # Fields required by TechSpecModal
        required_fields = ["id", "fullName", "phoneNumber", "modelName"]
        for field in required_fields:
            assert field in order, f"Missing required field: {field}"
        
        # Optional but expected fields
        expected_fields = ["selectedModel", "selectedOptions", "total", "orderDate"]
        for field in expected_fields:
            assert field in order, f"Missing expected field: {field}"


class TestTechSpecAPI:
    """Test tech spec related endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "admin", "password": "admin123"}
        )
        assert response.status_code == 200
        self.token = response.json().get("token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_get_tech_spec_categories(self):
        """Test GET /api/tech-spec/categories"""
        response = requests.get(
            f"{BASE_URL}/api/tech-spec/categories",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "categories" in data
        assert "masterCategories" in data
        
        # Verify categories structure
        if data["categories"]:
            cat = data["categories"][0]
            assert "id" in cat
            assert "name" in cat
