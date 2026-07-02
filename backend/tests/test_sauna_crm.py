"""
Test Sauna CRM API endpoints
- Settings: fields and stages configuration
- Leads: CRUD operations and stage changes
- Calendar: orders grouped by readyDate
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://alicor-spa-preview.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin"""
    response = requests.post(f"{API_URL}/auth/login", json={
        "username": "admin",
        "password": "admin123"
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("token")
    pytest.skip("Authentication failed - skipping tests")


@pytest.fixture
def auth_headers(auth_token):
    """Headers with authentication"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestCRMSettings:
    """CRM Settings endpoint tests"""
    
    def test_get_settings_returns_fields_and_stages(self, auth_headers):
        """GET /api/sauna-crm/settings returns settings with fields and stages arrays"""
        response = requests.get(f"{API_URL}/sauna-crm/settings", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify structure
        assert "fields" in data, "Response should contain 'fields' array"
        assert "stages" in data, "Response should contain 'stages' array"
        assert isinstance(data["fields"], list), "fields should be a list"
        assert isinstance(data["stages"], list), "stages should be a list"
        
        # Verify fields have expected structure
        if data["fields"]:
            field = data["fields"][0]
            assert "id" in field, "Field should have 'id'"
            assert "name" in field, "Field should have 'name'"
            assert "enabled" in field, "Field should have 'enabled'"
        
        # Verify stages have expected structure
        if data["stages"]:
            stage = data["stages"][0]
            assert "id" in stage, "Stage should have 'id'"
            assert "name" in stage, "Stage should have 'name'"
            assert "color" in stage, "Stage should have 'color'"


class TestCRMLeads:
    """CRM Leads CRUD tests"""
    
    @pytest.fixture
    def test_lead_id(self, auth_headers):
        """Create a test lead and return its ID, clean up after test"""
        unique_id = uuid.uuid4().hex[:8].upper()
        lead_data = {
            "id": f"TEST-{unique_id}",
            "stageId": "new",
            "clientName": f"Test Client {unique_id}",
            "phone": "+48123456789",
            "email": "test@example.com",
            "readyDate": "2026-03-25"
        }
        
        response = requests.post(f"{API_URL}/sauna-crm/leads", headers=auth_headers, json=lead_data)
        if response.status_code in [200, 201]:
            data = response.json()
            lead_id = data.get("lead", {}).get("id") or lead_data["id"]
            yield lead_id
            # Cleanup
            requests.delete(f"{API_URL}/sauna-crm/leads/{lead_id}", headers=auth_headers)
        else:
            pytest.skip(f"Failed to create test lead: {response.status_code} - {response.text}")
    
    def test_create_lead(self, auth_headers):
        """POST /api/sauna-crm/leads creates a new lead"""
        unique_id = uuid.uuid4().hex[:8].upper()
        lead_data = {
            "id": f"TEST-CREATE-{unique_id}",
            "stageId": "new",
            "clientName": f"Test Create {unique_id}",
            "phone": "+48111222333",
            "email": "create@test.com",
            "readyDate": "2026-03-20"
        }
        
        response = requests.post(f"{API_URL}/sauna-crm/leads", headers=auth_headers, json=lead_data)
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "lead" in data or "id" in data, "Response should contain lead data"
        lead = data.get("lead", data)
        assert lead.get("clientName") == lead_data["clientName"], "Client name should match"
        assert lead.get("stageId") == "new", "Stage should be 'new'"
        
        # Cleanup
        lead_id = lead.get("id")
        if lead_id:
            requests.delete(f"{API_URL}/sauna-crm/leads/{lead_id}", headers=auth_headers)
    
    def test_get_all_leads(self, auth_headers):
        """GET /api/sauna-crm/leads returns all leads"""
        response = requests.get(f"{API_URL}/sauna-crm/leads", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "leads" in data, "Response should contain 'leads' array"
        assert isinstance(data["leads"], list), "leads should be a list"
    
    def test_update_lead_clientname_and_readydate(self, auth_headers, test_lead_id):
        """PUT /api/sauna-crm/leads/{lead_id} updates clientName and readyDate"""
        update_data = {
            "clientName": "Updated Client Name",
            "readyDate": "2026-04-15"
        }
        
        response = requests.put(f"{API_URL}/sauna-crm/leads/{test_lead_id}", headers=auth_headers, json=update_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        updated = response.json()
        
        assert updated.get("clientName") == "Updated Client Name", "Client name should be updated"
        assert "2026-04-15" in updated.get("readyDate", ""), "Ready date should be updated"
        
        # Verify persistence with GET
        get_response = requests.get(f"{API_URL}/sauna-crm/leads/{test_lead_id}", headers=auth_headers)
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched.get("clientName") == "Updated Client Name"
    
    def test_change_lead_stage_and_record_history(self, auth_headers, test_lead_id):
        """PUT /api/sauna-crm/leads/{lead_id}/stage?stage_id=new changes stage and records history"""
        # First change to in_production
        response = requests.put(
            f"{API_URL}/sauna-crm/leads/{test_lead_id}/stage?stage_id=in_production", 
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        updated = response.json()
        
        assert updated.get("stageId") == "in_production", "Stage should be 'in_production'"
        
        # Check stage history
        history = updated.get("stageHistory", [])
        assert len(history) >= 1, "Stage history should have at least 1 entry"
        
        # Find the stage change entry
        stage_changes = [h for h in history if h.get("action") == "stage_changed" or h.get("toStage") == "in_production"]
        assert len(stage_changes) >= 1, "Should have stage change in history"
    
    def test_delete_lead(self, auth_headers):
        """DELETE /api/sauna-crm/leads/{lead_id} removes a lead"""
        # Create a lead to delete
        unique_id = uuid.uuid4().hex[:8].upper()
        lead_data = {
            "id": f"TEST-DELETE-{unique_id}",
            "stageId": "new",
            "clientName": f"Delete Test {unique_id}"
        }
        
        create_response = requests.post(f"{API_URL}/sauna-crm/leads", headers=auth_headers, json=lead_data)
        assert create_response.status_code in [200, 201]
        
        lead_id = create_response.json().get("lead", {}).get("id") or lead_data["id"]
        
        # Delete the lead
        delete_response = requests.delete(f"{API_URL}/sauna-crm/leads/{lead_id}", headers=auth_headers)
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        
        # Verify deletion - should return 404
        get_response = requests.get(f"{API_URL}/sauna-crm/leads/{lead_id}", headers=auth_headers)
        assert get_response.status_code == 404, "Deleted lead should return 404"


class TestCRMCalendar:
    """CRM Calendar endpoint tests"""
    
    def test_get_calendar_data_for_march_2026(self, auth_headers):
        """GET /api/sauna-crm/calendar?month=3&year=2026 returns orders grouped by readyDate"""
        response = requests.get(f"{API_URL}/sauna-crm/calendar?month=3&year=2026", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "month" in data, "Response should contain 'month'"
        assert "year" in data, "Response should contain 'year'"
        assert "byDate" in data, "Response should contain 'byDate'"
        
        assert data["month"] == 3, "Month should be 3"
        assert data["year"] == 2026, "Year should be 2026"
        assert isinstance(data["byDate"], dict), "byDate should be a dictionary"
    
    def test_calendar_data_structure(self, auth_headers):
        """Verify calendar data structure has proper order fields"""
        # Create a lead with readyDate in January 2026 for testing
        unique_id = uuid.uuid4().hex[:8].upper()
        lead_data = {
            "id": f"TEST-CAL-{unique_id}",
            "stageId": "new",
            "clientName": f"Calendar Test {unique_id}",
            "readyDate": "2026-01-15",
            "modelName": "Test Model",
            "phone": "+48999888777"
        }
        
        create_response = requests.post(f"{API_URL}/sauna-crm/leads", headers=auth_headers, json=lead_data)
        assert create_response.status_code in [200, 201]
        
        # Get calendar for January 2026
        cal_response = requests.get(f"{API_URL}/sauna-crm/calendar?month=1&year=2026", headers=auth_headers)
        assert cal_response.status_code == 200
        
        data = cal_response.json()
        by_date = data.get("byDate", {})
        
        # Check if our date has the lead
        if "2026-01-15" in by_date:
            orders = by_date["2026-01-15"]
            assert len(orders) >= 1, "Should have at least 1 order on this date"
            
            order = orders[0]
            # Verify order structure
            expected_fields = ["id", "clientName", "stageId", "readyDate"]
            for field in expected_fields:
                assert field in order, f"Order should have '{field}' field"
        
        # Cleanup
        lead_id = lead_data["id"]
        requests.delete(f"{API_URL}/sauna-crm/leads/{lead_id}", headers=auth_headers)


class TestCRMEdgeCases:
    """Edge cases and error handling"""
    
    def test_get_nonexistent_lead_returns_404(self, auth_headers):
        """GET /api/sauna-crm/leads/{invalid_id} returns 404"""
        response = requests.get(f"{API_URL}/sauna-crm/leads/NONEXISTENT-12345", headers=auth_headers)
        assert response.status_code == 404
    
    def test_delete_nonexistent_lead_returns_404(self, auth_headers):
        """DELETE /api/sauna-crm/leads/{invalid_id} returns 404"""
        response = requests.delete(f"{API_URL}/sauna-crm/leads/NONEXISTENT-99999", headers=auth_headers)
        assert response.status_code == 404


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
