"""
Test suite for POST /api/sauna-crm/leads/{id}/sync-from-amocrm endpoint
Bug fix: Per-lead sync button to fetch latest data from amoCRM for a specific lead
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSyncSingleLeadFromAmoCRM:
    """Tests for the new sync-from-amocrm endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with auth"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login as admin
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        if login_resp.status_code == 200:
            token = login_resp.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_sync_endpoint_returns_404_for_nonexistent_lead(self):
        """POST /api/sauna-crm/leads/{id}/sync-from-amocrm returns 404 for non-existent lead"""
        response = self.session.post(f"{BASE_URL}/api/sauna-crm/leads/NONEXISTENT-LEAD-ID/sync-from-amocrm")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        data = response.json()
        assert "not found" in data.get("detail", "").lower() or "Lead not found" in data.get("detail", "")
        print(f"PASS: 404 returned for non-existent lead")
    
    def test_sync_endpoint_returns_400_for_lead_without_amocrm_id(self):
        """POST /api/sauna-crm/leads/{id}/sync-from-amocrm returns 400 for lead without amocrm_id"""
        # First, create a lead without amocrm_id
        create_resp = self.session.post(f"{BASE_URL}/api/sauna-crm/leads", json={
            "stageId": "invoice_sent",
            "clientName": "TEST_NoAmo_Client",
            "phone": "+48111222333"
        })
        assert create_resp.status_code == 200, f"Failed to create test lead: {create_resp.text}"
        lead_id = create_resp.json().get("lead", {}).get("id")
        assert lead_id, "No lead ID returned"
        
        try:
            # Try to sync - should return 400
            response = self.session.post(f"{BASE_URL}/api/sauna-crm/leads/{lead_id}/sync-from-amocrm")
            assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
            data = response.json()
            assert "не привязан" in data.get("detail", "").lower() or "amocrm" in data.get("detail", "").lower()
            print(f"PASS: 400 returned for lead without amocrm_id")
        finally:
            # Cleanup
            self.session.delete(f"{BASE_URL}/api/sauna-crm/leads/{lead_id}")
    
    def test_sync_endpoint_returns_400_when_amocrm_not_configured(self):
        """POST /api/sauna-crm/leads/{id}/sync-from-amocrm returns 400 when amoCRM credentials not configured"""
        # Use the test lead that has amocrm_id
        test_lead_id = "CRM-59FC9032"
        
        # First verify the lead exists and has amocrm_id
        lead_resp = self.session.get(f"{BASE_URL}/api/sauna-crm/leads/{test_lead_id}")
        if lead_resp.status_code != 200:
            pytest.skip(f"Test lead {test_lead_id} not found")
        
        lead_data = lead_resp.json()
        if not lead_data.get("amocrm_id"):
            pytest.skip(f"Test lead {test_lead_id} has no amocrm_id")
        
        # Try to sync - should return 400 because amoCRM is not configured in test env
        response = self.session.post(f"{BASE_URL}/api/sauna-crm/leads/{test_lead_id}/sync-from-amocrm")
        
        # In test env, amoCRM is not configured, so we expect 400 with "amoCRM не настроен"
        # OR 502 if it tries to connect and fails
        assert response.status_code in [400, 502], f"Expected 400 or 502, got {response.status_code}: {response.text}"
        data = response.json()
        detail = data.get("detail", "")
        # Should mention amoCRM not configured or connection error
        assert "amocrm" in detail.lower() or "не настроен" in detail.lower() or "ошибку" in detail.lower()
        print(f"PASS: Proper error returned when amoCRM not configured: {response.status_code} - {detail}")
    
    def test_sync_endpoint_exists_and_accepts_post(self):
        """Verify the endpoint exists and accepts POST method"""
        # Use test lead
        test_lead_id = "CRM-59FC9032"
        
        # Verify endpoint exists (not 405 Method Not Allowed)
        response = self.session.post(f"{BASE_URL}/api/sauna-crm/leads/{test_lead_id}/sync-from-amocrm")
        
        # Should NOT be 405 (method not allowed) or 404 (endpoint not found)
        assert response.status_code != 405, "Endpoint does not accept POST method"
        # 404 for lead not found is different from 404 for endpoint not found
        if response.status_code == 404:
            data = response.json()
            assert "Lead not found" in data.get("detail", ""), "Endpoint not found (not lead not found)"
        
        print(f"PASS: Endpoint exists and accepts POST, returned {response.status_code}")


class TestRegressionPreviousFeatures:
    """Regression tests for previous features: changeLog, hasUnreviewedChanges, amoComment, acknowledge"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with auth"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        if login_resp.status_code == 200:
            token = login_resp.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_lead_has_changelog_field(self):
        """GET /api/sauna-crm/leads/{id} returns changeLog array"""
        test_lead_id = "CRM-59FC9032"
        response = self.session.get(f"{BASE_URL}/api/sauna-crm/leads/{test_lead_id}")
        if response.status_code != 200:
            pytest.skip(f"Test lead {test_lead_id} not found")
        
        data = response.json()
        assert "changeLog" in data, "changeLog field missing from lead response"
        assert isinstance(data["changeLog"], list), "changeLog should be a list"
        print(f"PASS: changeLog field present with {len(data['changeLog'])} entries")
    
    def test_lead_has_hasUnreviewedChanges_field(self):
        """GET /api/sauna-crm/leads/{id} returns hasUnreviewedChanges boolean"""
        test_lead_id = "CRM-59FC9032"
        response = self.session.get(f"{BASE_URL}/api/sauna-crm/leads/{test_lead_id}")
        if response.status_code != 200:
            pytest.skip(f"Test lead {test_lead_id} not found")
        
        data = response.json()
        assert "hasUnreviewedChanges" in data, "hasUnreviewedChanges field missing"
        assert isinstance(data["hasUnreviewedChanges"], bool), "hasUnreviewedChanges should be boolean"
        print(f"PASS: hasUnreviewedChanges field present: {data['hasUnreviewedChanges']}")
    
    def test_lead_has_amoComment_field(self):
        """GET /api/sauna-crm/leads/{id} returns amoComment string"""
        test_lead_id = "CRM-59FC9032"
        response = self.session.get(f"{BASE_URL}/api/sauna-crm/leads/{test_lead_id}")
        if response.status_code != 200:
            pytest.skip(f"Test lead {test_lead_id} not found")
        
        data = response.json()
        assert "amoComment" in data, "amoComment field missing"
        print(f"PASS: amoComment field present: '{data.get('amoComment', '')[:50]}...'")
    
    def test_acknowledge_changes_endpoint_works(self):
        """PUT /api/sauna-crm/leads/{id}/acknowledge-changes sets hasUnreviewedChanges to false"""
        test_lead_id = "CRM-59FC9032"
        
        # First set hasUnreviewedChanges to true
        self.session.put(f"{BASE_URL}/api/sauna-crm/leads/{test_lead_id}", json={
            "hasUnreviewedChanges": True
        })
        
        # Call acknowledge endpoint
        response = self.session.put(f"{BASE_URL}/api/sauna-crm/leads/{test_lead_id}/acknowledge-changes")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify it was set to false
        lead_resp = self.session.get(f"{BASE_URL}/api/sauna-crm/leads/{test_lead_id}")
        lead_data = lead_resp.json()
        assert lead_data.get("hasUnreviewedChanges") == False, "hasUnreviewedChanges should be False after acknowledge"
        
        # Reset for other tests
        self.session.put(f"{BASE_URL}/api/sauna-crm/leads/{test_lead_id}", json={
            "hasUnreviewedChanges": True
        })
        print(f"PASS: acknowledge-changes endpoint works correctly")
    
    def test_settings_has_collapsed_stages(self):
        """GET /api/sauna-crm/settings returns stages with collapsed field"""
        response = self.session.get(f"{BASE_URL}/api/sauna-crm/settings")
        assert response.status_code == 200
        
        data = response.json()
        stages = data.get("stages", [])
        assert len(stages) > 0, "No stages in settings"
        
        # Check that at least one stage has collapsed field
        has_collapsed = any("collapsed" in s for s in stages)
        assert has_collapsed, "No stage has 'collapsed' field"
        
        # Check that 'completed' stage is collapsed by default
        completed_stage = next((s for s in stages if s.get("id") == "completed"), None)
        if completed_stage:
            assert completed_stage.get("collapsed") == True, "completed stage should be collapsed by default"
        
        print(f"PASS: Settings has stages with collapsed field")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
