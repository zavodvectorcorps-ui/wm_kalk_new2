"""
Test suite for Sales API endpoints
Tests CRUD operations, manager settings, bonus calculation and filtering
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://sauna-sync.preview.emergentagent.com').rstrip('/')

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestSalesGetEndpoint:
    """Test GET /api/sales/ endpoint"""
    
    def test_get_sales_returns_list(self, api_client):
        """Test that GET /api/sales/ returns a list of sales"""
        response = api_client.get(f"{BASE_URL}/api/sales/")
        assert response.status_code == 200
        data = response.json()
        assert "sales" in data
        assert "count" in data
        assert "totals" in data
        assert isinstance(data["sales"], list)
        print(f"GET /api/sales/ - Returned {data['count']} sales")
    
    def test_get_sales_totals_structure(self, api_client):
        """Test that totals contain expected fields"""
        response = api_client.get(f"{BASE_URL}/api/sales/")
        assert response.status_code == 200
        data = response.json()
        totals = data["totals"]
        assert "total_amount" in totals
        assert "paid_amount" in totals
        assert "remaining" in totals
        print(f"Totals: total_amount={totals['total_amount']}, paid_amount={totals['paid_amount']}, remaining={totals['remaining']}")


class TestSalesFiltering:
    """Test filtering endpoints for sales"""
    
    def test_filter_by_manager(self, api_client):
        """Test filtering sales by manager name"""
        response = api_client.get(f"{BASE_URL}/api/sales/", params={"manager": "Marek"})
        assert response.status_code == 200
        data = response.json()
        # All returned sales should have manager containing 'Marek'
        for sale in data["sales"]:
            if sale.get("manager"):
                assert "Marek" in sale["manager"] or "marek" in sale["manager"].lower()
        print(f"Filter by manager 'Marek': {data['count']} results")
    
    def test_filter_by_status(self, api_client):
        """Test filtering sales by status"""
        response = api_client.get(f"{BASE_URL}/api/sales/", params={"status": "реализовано"})
        assert response.status_code == 200
        data = response.json()
        for sale in data["sales"]:
            if sale.get("status"):
                assert "реализовано" in sale["status"].lower()
        print(f"Filter by status 'реализовано': {data['count']} results")
    
    def test_filter_by_date_range(self, api_client):
        """Test filtering sales by date range"""
        response = api_client.get(f"{BASE_URL}/api/sales/", params={
            "start_date": "2026-01-01",
            "end_date": "2026-12-31"
        })
        assert response.status_code == 200
        data = response.json()
        assert "sales" in data
        print(f"Filter by date range 2026: {data['count']} results")


class TestSalesCRUD:
    """Test CRUD operations for sales"""
    
    def test_create_sale(self, api_client):
        """Test creating a new sale"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "product_name": f"TEST_Product_{unique_id}",
            "client_name": f"TEST_Client_{unique_id}",
            "manager": "TEST_Manager",
            "total_amount": 15000.0,
            "paid_amount": 5000.0,
            "status": "новый",
            "order_date": "2026-06-15"
        }
        response = api_client.post(f"{BASE_URL}/api/sales/", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "sale" in data
        sale = data["sale"]
        assert sale["product_name"] == payload["product_name"]
        assert sale["client_name"] == payload["client_name"]
        assert sale["total_amount"] == payload["total_amount"]
        print(f"Created sale with ID: {sale['id']}")
        
        # Verify by GET
        get_response = api_client.get(f"{BASE_URL}/api/sales/")
        assert get_response.status_code == 200
        all_sales = get_response.json()["sales"]
        found = any(s["id"] == sale["id"] for s in all_sales)
        assert found, "Created sale should be found in GET response"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/sales/{sale['id']}")
    
    def test_update_sale(self, api_client):
        """Test updating an existing sale"""
        # First create a sale
        unique_id = str(uuid.uuid4())[:8]
        create_payload = {
            "product_name": f"TEST_Update_{unique_id}",
            "client_name": f"TEST_UpdateClient_{unique_id}",
            "manager": "TEST_Manager",
            "total_amount": 10000.0,
            "status": "новый"
        }
        create_response = api_client.post(f"{BASE_URL}/api/sales/", json=create_payload)
        assert create_response.status_code == 200
        sale_id = create_response.json()["sale"]["id"]
        
        # Update the sale
        update_payload = {
            "total_amount": 12000.0,
            "status": "в процессе"
        }
        update_response = api_client.put(f"{BASE_URL}/api/sales/{sale_id}", json=update_payload)
        assert update_response.status_code == 200
        assert update_response.json()["success"] == True
        print(f"Updated sale {sale_id}")
        
        # Verify update by GET
        get_response = api_client.get(f"{BASE_URL}/api/sales/")
        all_sales = get_response.json()["sales"]
        updated_sale = next((s for s in all_sales if s["id"] == sale_id), None)
        assert updated_sale is not None
        assert updated_sale["total_amount"] == 12000.0
        assert updated_sale["status"] == "в процессе"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/sales/{sale_id}")
    
    def test_delete_sale(self, api_client):
        """Test deleting a sale"""
        # First create a sale
        unique_id = str(uuid.uuid4())[:8]
        create_payload = {
            "product_name": f"TEST_Delete_{unique_id}",
            "client_name": f"TEST_DeleteClient_{unique_id}",
            "manager": "TEST_Manager",
            "total_amount": 5000.0
        }
        create_response = api_client.post(f"{BASE_URL}/api/sales/", json=create_payload)
        assert create_response.status_code == 200
        sale_id = create_response.json()["sale"]["id"]
        
        # Delete the sale
        delete_response = api_client.delete(f"{BASE_URL}/api/sales/{sale_id}")
        assert delete_response.status_code == 200
        assert delete_response.json()["success"] == True
        print(f"Deleted sale {sale_id}")
        
        # Verify deletion by GET
        get_response = api_client.get(f"{BASE_URL}/api/sales/")
        all_sales = get_response.json()["sales"]
        found = any(s["id"] == sale_id for s in all_sales)
        assert not found, "Deleted sale should not be found in GET response"


class TestManagerSettings:
    """Test manager bonus settings endpoints"""
    
    def test_get_managers(self, api_client):
        """Test getting all manager settings"""
        response = api_client.get(f"{BASE_URL}/api/sales/managers/")
        assert response.status_code == 200
        data = response.json()
        assert "managers" in data
        assert isinstance(data["managers"], list)
        print(f"GET managers: {len(data['managers'])} managers configured")
    
    def test_create_manager_settings(self, api_client):
        """Test creating/updating manager bonus settings"""
        unique_name = f"TEST_Manager_{str(uuid.uuid4())[:6]}"
        payload = {
            "manager_name": unique_name,
            "bonus_percent": 8.5
        }
        # POST without trailing slash (FastAPI redirect loses body with trailing slash)
        response = api_client.post(f"{BASE_URL}/api/sales/managers", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["manager"] == unique_name
        assert data["bonus_percent"] == 8.5
        print(f"Created manager settings for {unique_name} with 8.5% bonus")
        
        # Verify by GET (GET works with trailing slash via redirect)
        get_response = api_client.get(f"{BASE_URL}/api/sales/managers/")
        managers = get_response.json()["managers"]
        found = any(m["manager_name"] == unique_name and m["bonus_percent"] == 8.5 for m in managers)
        assert found, "Created manager should be found with correct bonus percent"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/sales/managers/{unique_name}")
    
    def test_delete_manager_settings(self, api_client):
        """Test deleting manager settings"""
        # First create (POST without trailing slash)
        unique_name = f"TEST_DeleteMgr_{str(uuid.uuid4())[:6]}"
        api_client.post(f"{BASE_URL}/api/sales/managers", json={
            "manager_name": unique_name,
            "bonus_percent": 6.0
        })
        
        # Delete
        delete_response = api_client.delete(f"{BASE_URL}/api/sales/managers/{unique_name}")
        assert delete_response.status_code == 200
        print(f"Deleted manager settings for {unique_name}")
        
        # Verify deletion
        get_response = api_client.get(f"{BASE_URL}/api/sales/managers/")
        managers = get_response.json()["managers"]
        found = any(m["manager_name"] == unique_name for m in managers)
        assert not found, "Deleted manager should not be found"


class TestBonusCalculation:
    """Test bonus calculation endpoint"""
    
    def test_bonus_calculation(self, api_client):
        """Test calculating bonus for date range"""
        response = api_client.get(f"{BASE_URL}/api/sales/bonus-calculation/", params={
            "start_date": "2026-01-01",
            "end_date": "2026-12-31"
        })
        assert response.status_code == 200
        data = response.json()
        assert "period" in data
        assert "bonuses" in data
        assert "totals" in data
        assert data["period"]["start"] == "2026-01-01"
        assert data["period"]["end"] == "2026-12-31"
        print(f"Bonus calculation: total_sales={data['totals']['total_sales']}, total_bonus={data['totals']['total_bonus']}")
    
    def test_bonus_calculation_structure(self, api_client):
        """Test that bonus calculation returns correct structure"""
        response = api_client.get(f"{BASE_URL}/api/sales/bonus-calculation/", params={
            "start_date": "2026-01-01",
            "end_date": "2026-12-31"
        })
        assert response.status_code == 200
        data = response.json()
        
        # Check totals structure
        assert "total_sales" in data["totals"]
        assert "total_bonus" in data["totals"]
        
        # Check bonuses array structure
        for bonus in data["bonuses"]:
            assert "manager" in bonus
            assert "total_sales" in bonus
            assert "order_count" in bonus
            assert "bonus_percent" in bonus
            assert "bonus_amount" in bonus
            print(f"Manager: {bonus['manager']}, Sales: {bonus['total_sales']}, Bonus: {bonus['bonus_amount']}")
    
    def test_bonus_calculation_with_manager_filter(self, api_client):
        """Test bonus calculation filtered by specific manager"""
        response = api_client.get(f"{BASE_URL}/api/sales/bonus-calculation/", params={
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "manager": "Marek"
        })
        assert response.status_code == 200
        data = response.json()
        # Should only contain Marek's bonus
        for bonus in data["bonuses"]:
            assert "Marek" in bonus["manager"] or "marek" in bonus["manager"].lower()
        print(f"Marek's bonus: {data['totals']['total_bonus']}")
