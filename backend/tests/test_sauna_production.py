"""
Tests for Sauna Production module
Tests the production board endpoints for sauna orders
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://sauna-logistics-mgmt.preview.emergentagent.com')

# Test data reference from iteration_58:
# - CRM-TEST-001: Тестовый клиент - already pushed to production (inProduction=true, productionStageId='accepted')
# - CRM-942B9B7B: Anna Kowalska - NOT in production
# - CRM-59FC9032: Jan Testowy - NOT in production


class TestProductionSettings:
    """Test /api/sauna-production/settings endpoint"""

    def test_get_production_settings_returns_4_stages(self):
        """GET /api/sauna-production/settings should return 4 production stages"""
        response = requests.get(f"{BASE_URL}/api/sauna-production/settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "stages" in data, "Response should contain 'stages' field"
        stages = data["stages"]
        assert len(stages) == 4, f"Expected 4 production stages, got {len(stages)}"
        
        # Verify stage IDs and names
        stage_ids = [s["id"] for s in stages]
        expected_ids = ["accepted", "in_production", "ready", "shipped"]
        assert stage_ids == expected_ids, f"Expected stage IDs {expected_ids}, got {stage_ids}"
        
        # Verify Russian names
        stage_names = [s["name"] for s in stages]
        expected_names = ["Заказ принят", "В производстве", "Готов", "Отгружен"]
        assert stage_names == expected_names, f"Expected stage names {expected_names}, got {stage_names}"
        
        print(f"✓ GET /api/sauna-production/settings returns 4 stages: {stage_ids}")


class TestProductionOrders:
    """Test /api/sauna-production/orders endpoints"""

    def test_get_production_orders_returns_only_in_production(self):
        """GET /api/sauna-production/orders should return only orders with inProduction=true"""
        response = requests.get(f"{BASE_URL}/api/sauna-production/orders")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "orders" in data, "Response should contain 'orders' field"
        orders = data["orders"]
        
        # Verify all returned orders have inProduction=true
        for order in orders:
            assert order.get("inProduction") == True, f"Order {order.get('id')} should have inProduction=true"
        
        print(f"✓ GET /api/sauna-production/orders returns {len(orders)} orders (all with inProduction=true)")
        
        # Check if CRM-TEST-001 is in the list (it was pushed to production)
        order_ids = [o.get("id") for o in orders]
        if "CRM-TEST-001" in order_ids:
            print(f"✓ CRM-TEST-001 is in production orders as expected")

    def test_get_single_production_order(self):
        """GET /api/sauna-production/orders/{id} should return order details"""
        # First get all production orders
        response = requests.get(f"{BASE_URL}/api/sauna-production/orders")
        orders = response.json().get("orders", [])
        
        if not orders:
            pytest.skip("No production orders to test")
        
        order_id = orders[0]["id"]
        response = requests.get(f"{BASE_URL}/api/sauna-production/orders/{order_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        order = response.json()
        assert order.get("id") == order_id
        assert order.get("inProduction") == True
        print(f"✓ GET /api/sauna-production/orders/{order_id} returns order with inProduction=true")

    def test_get_nonexistent_production_order_returns_404(self):
        """GET /api/sauna-production/orders/nonexistent should return 404"""
        response = requests.get(f"{BASE_URL}/api/sauna-production/orders/NONEXISTENT-ORDER-ID")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ GET /api/sauna-production/orders/NONEXISTENT returns 404")


class TestProductionStageChange:
    """Test /api/sauna-production/orders/{id}/stage endpoint"""

    def test_change_production_stage(self):
        """PUT /api/sauna-production/orders/{id}/stage?stage_id=X should change stage"""
        # First get a production order
        response = requests.get(f"{BASE_URL}/api/sauna-production/orders")
        orders = response.json().get("orders", [])
        
        if not orders:
            pytest.skip("No production orders to test")
        
        order = orders[0]
        order_id = order["id"]
        current_stage = order.get("productionStageId", "accepted")
        
        # Get available stages
        settings = requests.get(f"{BASE_URL}/api/sauna-production/settings").json()
        stages = settings.get("stages", [])
        
        # Find a different stage to change to
        new_stage = None
        for s in stages:
            if s["id"] != current_stage:
                new_stage = s["id"]
                break
        
        if not new_stage:
            pytest.skip("No alternative stage available")
        
        # Change stage
        response = requests.put(f"{BASE_URL}/api/sauna-production/orders/{order_id}/stage?stage_id={new_stage}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        updated = response.json()
        assert updated.get("productionStageId") == new_stage, f"Stage should be {new_stage}"
        assert "productionHistory" in updated, "Should have productionHistory"
        
        # Verify history entry
        history = updated.get("productionHistory", [])
        latest = history[-1] if history else {}
        assert latest.get("toStage") == new_stage, "History should show new stage"
        
        print(f"✓ PUT /api/sauna-production/orders/{order_id}/stage changed stage from {current_stage} to {new_stage}")
        
        # Restore original stage
        requests.put(f"{BASE_URL}/api/sauna-production/orders/{order_id}/stage?stage_id={current_stage}")


class TestProductionCalendar:
    """Test /api/sauna-production/calendar endpoint"""

    def test_get_production_calendar(self):
        """GET /api/sauna-production/calendar?month=X&year=Y should return calendar data"""
        import datetime
        now = datetime.datetime.now()
        month = now.month
        year = now.year
        
        response = requests.get(f"{BASE_URL}/api/sauna-production/calendar?month={month}&year={year}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "month" in data, "Response should contain 'month'"
        assert "year" in data, "Response should contain 'year'"
        assert "byDate" in data, "Response should contain 'byDate'"
        assert "totalOrders" in data, "Response should contain 'totalOrders'"
        
        assert data["month"] == month
        assert data["year"] == year
        
        print(f"✓ GET /api/sauna-production/calendar returns data for {month}/{year} with {data['totalOrders']} orders")


class TestCRMToProduction:
    """Test /api/sauna-crm/leads/{id}/to-production endpoint"""

    def test_push_to_production(self):
        """POST /api/sauna-crm/leads/{id}/to-production should mark lead as inProduction"""
        # First get all CRM leads
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads")
        assert response.status_code == 200
        
        leads = response.json().get("leads", [])
        
        # Find a lead that is NOT in production yet
        lead_to_push = None
        for lead in leads:
            if not lead.get("inProduction"):
                lead_to_push = lead
                break
        
        if not lead_to_push:
            # All leads are already in production, skip this test
            pytest.skip("All leads are already in production")
        
        lead_id = lead_to_push["id"]
        
        # Push to production
        response = requests.post(f"{BASE_URL}/api/sauna-crm/leads/{lead_id}/to-production")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") == "ok"
        
        lead = data.get("lead")
        assert lead.get("inProduction") == True, "Lead should be marked as inProduction"
        assert lead.get("productionStageId") == "accepted", "Default stage should be 'accepted'"
        assert "productionPushedAt" in lead, "Should have productionPushedAt timestamp"
        assert "productionHistory" in lead, "Should have productionHistory"
        
        print(f"✓ POST /api/sauna-crm/leads/{lead_id}/to-production marked lead as inProduction")
        
        # Verify it appears in production orders
        prod_orders = requests.get(f"{BASE_URL}/api/sauna-production/orders").json().get("orders", [])
        prod_order_ids = [o.get("id") for o in prod_orders]
        assert lead_id in prod_order_ids, f"Lead {lead_id} should now appear in production orders"
        print(f"✓ Lead {lead_id} now appears in production orders")

    def test_push_already_in_production_returns_error(self):
        """POST /api/sauna-crm/leads/{id}/to-production for already-in-production lead should return 400"""
        # First get a lead that IS in production
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads")
        leads = response.json().get("leads", [])
        
        lead_in_production = None
        for lead in leads:
            if lead.get("inProduction"):
                lead_in_production = lead
                break
        
        if not lead_in_production:
            pytest.skip("No leads in production to test")
        
        lead_id = lead_in_production["id"]
        
        # Try to push again
        response = requests.post(f"{BASE_URL}/api/sauna-crm/leads/{lead_id}/to-production")
        assert response.status_code == 400, f"Expected 400 for already-in-production, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Should have error detail"
        assert "уже в производстве" in data.get("detail", "").lower() or "already" in data.get("detail", "").lower()
        
        print(f"✓ POST /api/sauna-crm/leads/{lead_id}/to-production returns 400 (already in production)")


class TestCRMLeadProduction:
    """Test CRM lead with production status"""

    def test_crm_lead_shows_production_status(self):
        """GET /api/sauna-crm/leads/{id} for in-production lead should show production fields"""
        # Get a lead that's in production
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads")
        leads = response.json().get("leads", [])
        
        lead_in_production = None
        for lead in leads:
            if lead.get("inProduction"):
                lead_in_production = lead
                break
        
        if not lead_in_production:
            pytest.skip("No leads in production to test")
        
        lead_id = lead_in_production["id"]
        
        # Get single lead
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{lead_id}")
        assert response.status_code == 200
        
        lead = response.json()
        assert lead.get("inProduction") == True
        assert "productionStageId" in lead
        assert "productionPushedAt" in lead or "productionHistory" in lead
        
        print(f"✓ GET /api/sauna-crm/leads/{lead_id} shows production status fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
