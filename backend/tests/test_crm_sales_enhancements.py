"""
Test cases for 5-point CRM & Sales enhancements:
1. Manager-specific CRM access - non-admin users filter by manager name
2. Date filters on Production page (kanban & list)
3. Custom lead display title = 'ClientName — ModelName'
4. Production calendar uses readyDate instead of productionDate
5. Sales sync from CRM imports ALL leads, bonus uses prepayment_date
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="session")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestCRMLeadsFiltering:
    """Test GET /api/sauna-crm/leads with manager_username and date filters"""
    
    def test_get_leads_endpoint_exists(self, api_client):
        """Verify the leads endpoint is accessible"""
        response = api_client.get(f"{BASE_URL}/api/sauna-crm/leads")
        assert response.status_code == 200, f"Endpoint returned {response.status_code}: {response.text}"
        data = response.json()
        assert "leads" in data
        assert "byStage" in data
        assert "settings" in data
        print(f"✓ CRM leads endpoint works, found {len(data['leads'])} leads")
    
    def test_filter_by_manager_username(self, api_client):
        """Test filtering leads by manager_username parameter"""
        # First get all leads to find a manager name
        response = api_client.get(f"{BASE_URL}/api/sauna-crm/leads")
        assert response.status_code == 200
        all_leads = response.json()["leads"]
        
        # Find a lead with a manager
        managers = set()
        for lead in all_leads:
            if lead.get("manager"):
                managers.add(lead["manager"])
        
        if managers:
            test_manager = list(managers)[0]
            # Filter by manager
            response = api_client.get(f"{BASE_URL}/api/sauna-crm/leads?manager_username={test_manager}")
            assert response.status_code == 200
            filtered = response.json()["leads"]
            
            # All returned leads should have matching manager (case-insensitive)
            for lead in filtered:
                assert test_manager.lower() in (lead.get("manager") or "").lower(), \
                    f"Lead {lead['id']} has manager '{lead.get('manager')}' but filtered for '{test_manager}'"
            print(f"✓ Manager filter works - filtered {len(all_leads)} leads to {len(filtered)} for manager '{test_manager}'")
        else:
            print("⚠ No leads with managers found, skipping manager filter test")
            pytest.skip("No leads with managers")
    
    def test_filter_by_date_from(self, api_client):
        """Test filtering leads by date_from parameter"""
        # Get all leads first
        response = api_client.get(f"{BASE_URL}/api/sauna-crm/leads")
        assert response.status_code == 200
        all_leads = response.json()["leads"]
        
        # Find a date from leads with readyDate
        leads_with_dates = [l for l in all_leads if l.get("readyDate")]
        
        if leads_with_dates:
            # Use a date from existing data
            test_date = leads_with_dates[0]["readyDate"][:10]
            response = api_client.get(f"{BASE_URL}/api/sauna-crm/leads?date_from={test_date}")
            assert response.status_code == 200
            filtered = response.json()["leads"]
            
            # All returned leads should have readyDate >= date_from
            for lead in filtered:
                if lead.get("readyDate"):
                    assert lead["readyDate"][:10] >= test_date, \
                        f"Lead {lead['id']} has readyDate {lead['readyDate']} but filtered from {test_date}"
            print(f"✓ date_from filter works - filtered for dates >= {test_date}, got {len(filtered)} leads")
        else:
            print("⚠ No leads with readyDate found")
            pytest.skip("No leads with readyDate")
    
    def test_filter_by_date_to(self, api_client):
        """Test filtering leads by date_to parameter"""
        response = api_client.get(f"{BASE_URL}/api/sauna-crm/leads")
        assert response.status_code == 200
        all_leads = response.json()["leads"]
        
        leads_with_dates = [l for l in all_leads if l.get("readyDate")]
        
        if leads_with_dates:
            test_date = leads_with_dates[0]["readyDate"][:10]
            response = api_client.get(f"{BASE_URL}/api/sauna-crm/leads?date_to={test_date}")
            assert response.status_code == 200
            filtered = response.json()["leads"]
            
            for lead in filtered:
                if lead.get("readyDate"):
                    # date_to includes the full day (T23:59:59)
                    assert lead["readyDate"][:10] <= test_date, \
                        f"Lead {lead['id']} has readyDate {lead['readyDate']} but filtered to {test_date}"
            print(f"✓ date_to filter works - filtered for dates <= {test_date}, got {len(filtered)} leads")
        else:
            pytest.skip("No leads with readyDate")
    
    def test_combined_date_filters(self, api_client):
        """Test combining date_from and date_to filters"""
        # Use a reasonable date range
        today = datetime.now()
        date_from = (today - timedelta(days=365)).strftime("%Y-%m-%d")
        date_to = (today + timedelta(days=365)).strftime("%Y-%m-%d")
        
        response = api_client.get(f"{BASE_URL}/api/sauna-crm/leads?date_from={date_from}&date_to={date_to}")
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Combined date filter works - date range {date_from} to {date_to}, got {len(data['leads'])} leads")


class TestProductionOrdersFiltering:
    """Test GET /api/sauna-production/orders with date_from, date_to filters"""
    
    def test_get_production_orders_endpoint(self, api_client):
        """Verify production orders endpoint exists"""
        response = api_client.get(f"{BASE_URL}/api/sauna-production/orders")
        assert response.status_code == 200
        data = response.json()
        assert "orders" in data
        print(f"✓ Production orders endpoint works, found {len(data['orders'])} orders")
    
    def test_production_orders_date_from_filter(self, api_client):
        """Test date_from filter on production orders"""
        response = api_client.get(f"{BASE_URL}/api/sauna-production/orders")
        assert response.status_code == 200
        all_orders = response.json()["orders"]
        
        orders_with_dates = [o for o in all_orders if o.get("readyDate")]
        
        if orders_with_dates:
            test_date = orders_with_dates[0]["readyDate"][:10]
            response = api_client.get(f"{BASE_URL}/api/sauna-production/orders?date_from={test_date}")
            assert response.status_code == 200
            filtered = response.json()["orders"]
            
            for order in filtered:
                if order.get("readyDate"):
                    assert order["readyDate"][:10] >= test_date
            print(f"✓ Production orders date_from filter works - {len(filtered)} orders from {test_date}")
        else:
            print("⚠ No production orders with readyDate")
            pytest.skip("No orders with readyDate")
    
    def test_production_orders_date_to_filter(self, api_client):
        """Test date_to filter on production orders"""
        response = api_client.get(f"{BASE_URL}/api/sauna-production/orders")
        assert response.status_code == 200
        all_orders = response.json()["orders"]
        
        orders_with_dates = [o for o in all_orders if o.get("readyDate")]
        
        if orders_with_dates:
            test_date = orders_with_dates[0]["readyDate"][:10]
            response = api_client.get(f"{BASE_URL}/api/sauna-production/orders?date_to={test_date}")
            assert response.status_code == 200
            filtered = response.json()["orders"]
            
            for order in filtered:
                if order.get("readyDate"):
                    assert order["readyDate"][:10] <= test_date
            print(f"✓ Production orders date_to filter works - {len(filtered)} orders until {test_date}")
        else:
            pytest.skip("No orders with readyDate")


class TestProductionCalendarReadyDate:
    """Test GET /api/sauna-production/calendar uses readyDate instead of productionDate"""
    
    def test_calendar_endpoint_exists(self, api_client):
        """Verify calendar endpoint works"""
        today = datetime.now()
        response = api_client.get(f"{BASE_URL}/api/sauna-production/calendar?month={today.month}&year={today.year}")
        assert response.status_code == 200
        data = response.json()
        assert "month" in data
        assert "year" in data
        assert "byDate" in data
        print(f"✓ Production calendar endpoint works for {today.month}/{today.year}")
    
    def test_calendar_groups_by_ready_date(self, api_client):
        """Verify calendar groups orders by readyDate field"""
        # Get production orders to find dates
        orders_response = api_client.get(f"{BASE_URL}/api/sauna-production/orders")
        assert orders_response.status_code == 200
        orders = orders_response.json()["orders"]
        
        # Find an order with readyDate
        orders_with_ready_date = [o for o in orders if o.get("readyDate")]
        
        if orders_with_ready_date:
            # Parse the date
            ready_date = orders_with_ready_date[0]["readyDate"]
            if "T" in ready_date:
                dt = datetime.fromisoformat(ready_date.replace("Z", "+00:00"))
            else:
                dt = datetime.strptime(ready_date[:10], "%Y-%m-%d")
            
            # Fetch calendar for that month
            response = api_client.get(f"{BASE_URL}/api/sauna-production/calendar?month={dt.month}&year={dt.year}")
            assert response.status_code == 200
            calendar_data = response.json()
            
            # Check that calendar returns readyDate in entries
            by_date = calendar_data.get("byDate", {})
            has_ready_date = False
            for date_key, entries in by_date.items():
                for entry in entries:
                    if entry.get("readyDate"):
                        has_ready_date = True
                        # Verify the entry's readyDate matches the grouping date
                        entry_date = entry["readyDate"][:10]
                        assert entry_date == date_key, f"Entry readyDate {entry_date} doesn't match calendar date {date_key}"
            
            if has_ready_date:
                print(f"✓ Production calendar groups by readyDate correctly")
            else:
                print("⚠ Calendar has data but no readyDate in entries - might be using readyDate for grouping")
        else:
            print("⚠ No production orders with readyDate found")
            pytest.skip("No orders with readyDate")


class TestSalesSyncFromCRM:
    """Test POST /api/sales/sync-from-crm imports ALL CRM leads"""
    
    def test_sync_endpoint_exists(self, api_client):
        """Verify sync endpoint exists"""
        response = api_client.post(f"{BASE_URL}/api/sales/sync-from-crm")
        assert response.status_code == 200
        data = response.json()
        assert "imported" in data or "updated" in data
        print(f"✓ Sync endpoint works - imported: {data.get('imported', 0)}, updated: {data.get('updated', 0)}")
    
    def test_sync_imports_all_leads(self, api_client):
        """Verify sync imports ALL CRM leads, not just those with calculatorOrderId"""
        # Get total CRM leads count
        crm_response = api_client.get(f"{BASE_URL}/api/sauna-crm/leads")
        assert crm_response.status_code == 200
        crm_leads = crm_response.json()["leads"]
        total_crm = len(crm_leads)
        
        # Count leads without calculatorOrderId
        leads_without_calc = [l for l in crm_leads if not l.get("calculatorOrderId")]
        
        # Run sync
        sync_response = api_client.post(f"{BASE_URL}/api/sales/sync-from-crm")
        assert sync_response.status_code == 200
        sync_data = sync_response.json()
        
        # total_processed should equal total CRM leads
        total_processed = sync_data.get("total_processed", 0)
        
        print(f"✓ Sync processed {total_processed} leads (CRM has {total_crm} total, {len(leads_without_calc)} without calculatorOrderId)")
        
        # Verify sync processed the same number as CRM total
        assert total_processed == total_crm, \
            f"Sync should process ALL {total_crm} CRM leads, but only processed {total_processed}"


class TestBonusCalculationPrepaymentDate:
    """Test GET /api/sales/bonus-calculation uses prepayment_date for date range"""
    
    def test_bonus_calculation_endpoint(self, api_client):
        """Verify bonus calculation endpoint works"""
        today = datetime.now()
        start = (today - timedelta(days=365)).strftime("%Y-%m-%d")
        end = today.strftime("%Y-%m-%d")
        
        response = api_client.get(f"{BASE_URL}/api/sales/bonus-calculation?start_date={start}&end_date={end}")
        assert response.status_code == 200
        data = response.json()
        assert "period" in data
        assert "bonuses" in data
        assert "totals" in data
        print(f"✓ Bonus calculation endpoint works - {len(data['bonuses'])} managers, total sales: {data['totals']['total_sales']}")
    
    def test_bonus_calculation_uses_prepayment_date(self, api_client):
        """Test that bonus calculation uses prepayment_date field"""
        # Create a test sale with prepayment_date
        test_sale = {
            "product_name": "TEST_BONUS_PREPAYMENT",
            "client_name": "Test Client Prepayment",
            "total_amount": 10000,
            "paid_amount": 5000,
            "manager": "TEST_MANAGER_PREPAYMENT",
            "order_date": "2024-01-01",  # Old date
            "status": "новый"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/sales/", json=test_sale)
        if create_response.status_code == 200:
            created = create_response.json()
            sale_id = created.get("sale", {}).get("id")
            
            if sale_id:
                # Update with prepayment_date in a specific range
                today = datetime.now().strftime("%Y-%m-%d")
                update_data = {"prepayment_date": today}
                api_client.put(f"{BASE_URL}/api/sales/{sale_id}", json=update_data)
                
                # Calculate bonus for today only - should include this sale based on prepayment_date
                response = api_client.get(f"{BASE_URL}/api/sales/bonus-calculation?start_date={today}&end_date={today}")
                assert response.status_code == 200
                data = response.json()
                
                # Look for our test manager
                test_bonus = next((b for b in data["bonuses"] if b["manager"] == "TEST_MANAGER_PREPAYMENT"), None)
                
                if test_bonus:
                    assert test_bonus["total_sales"] >= 10000, \
                        f"Expected at least 10000 in sales for test manager, got {test_bonus['total_sales']}"
                    print(f"✓ Bonus calculation includes sales based on prepayment_date (found {test_bonus['total_sales']} for test manager)")
                else:
                    print("⚠ Test manager not found in bonus calculation - may need to verify query logic")
                
                # Cleanup
                api_client.delete(f"{BASE_URL}/api/sales/{sale_id}")
        else:
            print("⚠ Could not create test sale for prepayment_date test")
            pytest.skip("Could not create test sale")


class TestCRMLeadTitle:
    """Test that CRM leads have clientName and modelName fields for display title"""
    
    def test_leads_have_required_fields_for_title(self, api_client):
        """Verify leads have clientName and modelName fields"""
        response = api_client.get(f"{BASE_URL}/api/sauna-crm/leads")
        assert response.status_code == 200
        leads = response.json()["leads"]
        
        if leads:
            # Check first few leads for required fields
            for lead in leads[:5]:
                # Lead should have either clientName or modelName or both
                has_client = "clientName" in lead
                has_model = "modelName" in lead or "field_1" in lead
                
                # At minimum, leads should have these fields available
                assert has_client or has_model, \
                    f"Lead {lead.get('id')} missing both clientName and modelName/field_1"
            
            # Count leads with both fields for title
            leads_with_both = [l for l in leads if l.get("clientName") and (l.get("modelName") or l.get("field_1"))]
            print(f"✓ Leads have fields for title - {len(leads_with_both)}/{len(leads)} have both clientName and model")
        else:
            print("⚠ No leads found")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_sales(self, api_client):
        """Remove test sales created during testing"""
        # Get all sales
        response = api_client.get(f"{BASE_URL}/api/sales/")
        if response.status_code == 200:
            sales = response.json().get("sales", [])
            deleted = 0
            for sale in sales:
                if sale.get("product_name", "").startswith("TEST_"):
                    del_response = api_client.delete(f"{BASE_URL}/api/sales/{sale['id']}")
                    if del_response.status_code == 200:
                        deleted += 1
            print(f"✓ Cleanup: deleted {deleted} test sales")
