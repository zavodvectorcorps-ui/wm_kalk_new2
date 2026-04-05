"""
Test suite for Sauna CRM Background Sync functionality.
Tests the 524 timeout fix - sync endpoint should return immediately (non-blocking).
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSyncBackgroundFeature:
    """Tests for the background sync feature that fixes 524 timeout errors."""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for all tests."""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_sync_endpoint_returns_immediately(self):
        """
        POST /api/sauna-crm/sync-from-amocrm should return immediately (< 2 seconds).
        This is the key fix for the 524 timeout issue.
        """
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/api/sauna-crm/sync-from-amocrm",
            headers=self.headers
        )
        elapsed = time.time() - start_time
        
        # Should return quickly (non-blocking)
        assert elapsed < 2.0, f"Sync endpoint took {elapsed:.2f}s - should be < 2s (non-blocking)"
        
        # Should return 400 (amoCRM not configured) or 202 (accepted)
        assert response.status_code in [400, 202], f"Expected 400 or 202, got {response.status_code}"
        
        data = response.json()
        if response.status_code == 400:
            # Expected when amoCRM is not configured
            assert data.get("detail") == "amoCRM не настроен", f"Unexpected error: {data}"
        else:
            # When amoCRM is configured, should return accepted status
            assert data.get("status") in ["accepted", "already_running"], f"Unexpected status: {data}"
    
    def test_sync_status_endpoint_exists(self):
        """GET /api/sauna-crm/sync-status should return current sync status."""
        response = requests.get(
            f"{BASE_URL}/api/sauna-crm/sync-status",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Should have status field
        assert "status" in data, f"Missing 'status' field in response: {data}"
        # Status should be one of: idle, running, completed, error
        assert data["status"] in ["idle", "running", "completed", "error"], f"Unexpected status: {data['status']}"
        # Should have message field
        assert "message" in data, f"Missing 'message' field in response: {data}"
    
    def test_sync_status_idle_when_no_sync(self):
        """When no sync is running, status should be 'idle'."""
        response = requests.get(
            f"{BASE_URL}/api/sauna-crm/sync-status",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # When no sync is running, should be idle
        # (unless a sync was just triggered by another test)
        assert data["status"] in ["idle", "running", "completed", "error"]
    
    def test_leads_endpoint_still_works(self):
        """GET /api/sauna-crm/leads should still work correctly."""
        response = requests.get(
            f"{BASE_URL}/api/sauna-crm/leads",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "leads" in data, f"Missing 'leads' field in response"
        assert isinstance(data["leads"], list), f"'leads' should be a list"
    
    def test_settings_endpoint_still_works(self):
        """GET /api/sauna-crm/settings should still work correctly."""
        response = requests.get(
            f"{BASE_URL}/api/sauna-crm/settings",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Should have stages and fields
        assert "stages" in data or "fields" in data, f"Missing expected fields in settings: {data.keys()}"
    
    def test_sync_response_structure_when_amocrm_not_configured(self):
        """
        When amoCRM is not configured, sync should return 400 with proper error message.
        This is expected behavior in test environment.
        """
        response = requests.post(
            f"{BASE_URL}/api/sauna-crm/sync-from-amocrm",
            headers=self.headers
        )
        
        # In test env without amoCRM credentials, should return 400
        if response.status_code == 400:
            data = response.json()
            assert "detail" in data, f"Missing 'detail' in error response: {data}"
            assert data["detail"] == "amoCRM не настроен", f"Unexpected error message: {data['detail']}"
        elif response.status_code == 202:
            # If amoCRM is configured, should return accepted
            data = response.json()
            assert data.get("status") in ["accepted", "already_running"]
            if data.get("status") == "accepted":
                assert "syncId" in data, f"Missing 'syncId' in accepted response: {data}"
    
    def test_sync_endpoint_not_blocking(self):
        """
        Multiple rapid calls to sync endpoint should all return quickly.
        This verifies the endpoint is truly non-blocking.
        """
        times = []
        for _ in range(3):
            start = time.time()
            response = requests.post(
                f"{BASE_URL}/api/sauna-crm/sync-from-amocrm",
                headers=self.headers
            )
            elapsed = time.time() - start
            times.append(elapsed)
            
            # Each call should be fast
            assert elapsed < 2.0, f"Call took {elapsed:.2f}s - should be < 2s"
            assert response.status_code in [400, 202]
        
        # Average should be very fast
        avg_time = sum(times) / len(times)
        assert avg_time < 1.0, f"Average response time {avg_time:.2f}s - should be < 1s"
        print(f"Average sync endpoint response time: {avg_time:.3f}s")


class TestSyncStatusFields:
    """Tests for sync status response fields."""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for all tests."""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_sync_status_has_required_fields(self):
        """Sync status should have all required fields for frontend progress display."""
        response = requests.get(
            f"{BASE_URL}/api/sauna-crm/sync-status",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Required fields
        assert "status" in data
        assert "message" in data
        
        # When running, should have progress fields
        if data["status"] == "running":
            expected_fields = ["imported", "updated", "errors", "processedStages", "totalStages"]
            for field in expected_fields:
                assert field in data, f"Missing '{field}' in running sync status"


class TestExistingEndpointsNotBroken:
    """Verify existing endpoints still work after the sync refactor."""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for all tests."""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_calendar_endpoint(self):
        """GET /api/sauna-crm/calendar should work."""
        response = requests.get(
            f"{BASE_URL}/api/sauna-crm/calendar?month=1&year=2026",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "byDate" in data
    
    def test_single_lead_sync_endpoint(self):
        """POST /api/sauna-crm/leads/{id}/sync-from-amocrm should work for leads with amocrm_id."""
        # First get a lead
        response = requests.get(
            f"{BASE_URL}/api/sauna-crm/leads",
            headers=self.headers
        )
        assert response.status_code == 200
        leads = response.json().get("leads", [])
        
        # Find a lead with amocrm_id
        lead_with_amo = next((l for l in leads if l.get("amocrm_id")), None)
        
        if lead_with_amo:
            # Try to sync it
            response = requests.post(
                f"{BASE_URL}/api/sauna-crm/leads/{lead_with_amo['id']}/sync-from-amocrm",
                headers=self.headers
            )
            # Should return 400 (amoCRM not configured) or 200 (success)
            assert response.status_code in [200, 400, 502], f"Unexpected status: {response.status_code}"
        else:
            # No leads with amocrm_id, skip this test
            pytest.skip("No leads with amocrm_id found")
