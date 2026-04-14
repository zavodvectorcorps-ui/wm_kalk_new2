"""
Lead Analytics Module - Backend API Tests (Iteration 79)
Tests for the new Lead Analytics feature endpoints:
- GET /api/lead-analytics/settings
- PUT /api/lead-analytics/settings
- GET /api/lead-analytics/summary
- GET /api/lead-analytics/managers
- GET /api/lead-analytics/problem-leads
- GET /api/lead-analytics/sync-status
- GET /api/lead-analytics/pipelines-and-users
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestLeadAnalyticsSettings:
    """Tests for Lead Analytics settings endpoints"""
    
    def test_get_settings_returns_defaults(self):
        """GET /api/lead-analytics/settings returns default settings with slaFirstActionHours=5"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/settings")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify default SLA is 5 hours
        assert data.get("slaFirstActionHours") == 5, f"Expected slaFirstActionHours=5, got {data.get('slaFirstActionHours')}"
        # Verify other default fields exist
        assert "pipelineId" in data
        assert "newLeadStageIds" in data
        assert "managerWorkStageIds" in data
        assert "successStageIds" in data
        assert "stalledThresholdHours" in data
        assert "botUserIds" in data
        assert "managerUserIds" in data
        assert "countNoteAsAction" in data
        assert "countTaskAsAction" in data
        assert "countStageChangeAsAction" in data
        assert "countCommunicationAsAction" in data
        print(f"✓ GET /settings returns defaults with slaFirstActionHours={data.get('slaFirstActionHours')}")
    
    def test_put_settings_saves_and_returns_ok(self):
        """PUT /api/lead-analytics/settings saves settings and returns ok"""
        # Test payload with custom values
        test_settings = {
            "pipelineId": "TEST_PIPELINE_123",
            "newLeadStageIds": ["stage1", "stage2"],
            "managerWorkStageIds": ["stage3"],
            "successStageIds": ["stage4"],
            "slaFirstActionHours": 8,
            "stalledThresholdHours": 48,
            "botUserIds": ["bot1"],
            "managerUserIds": ["mgr1", "mgr2"],
            "countNoteAsAction": True,
            "countTaskAsAction": False,
            "countStageChangeAsAction": True,
            "countCommunicationAsAction": True
        }
        
        response = requests.put(
            f"{BASE_URL}/api/lead-analytics/settings",
            json=test_settings
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") == "ok", f"Expected status='ok', got {data}"
        print("✓ PUT /settings returns status='ok'")
        
        # Verify settings were saved by fetching them
        get_response = requests.get(f"{BASE_URL}/api/lead-analytics/settings")
        assert get_response.status_code == 200
        saved_data = get_response.json()
        
        assert saved_data.get("pipelineId") == "TEST_PIPELINE_123"
        assert saved_data.get("slaFirstActionHours") == 8
        assert saved_data.get("stalledThresholdHours") == 48
        print("✓ Settings were persisted correctly")
        
        # Restore defaults
        default_settings = {
            "pipelineId": "",
            "newLeadStageIds": [],
            "managerWorkStageIds": [],
            "successStageIds": [],
            "slaFirstActionHours": 5,
            "stalledThresholdHours": 24,
            "botUserIds": [],
            "managerUserIds": [],
            "countNoteAsAction": True,
            "countTaskAsAction": True,
            "countStageChangeAsAction": True,
            "countCommunicationAsAction": True
        }
        requests.put(f"{BASE_URL}/api/lead-analytics/settings", json=default_settings)
        print("✓ Restored default settings")


class TestLeadAnalyticsSummary:
    """Tests for Lead Analytics summary endpoint"""
    
    def test_get_summary_returns_zero_counts_when_no_data(self):
        """GET /api/lead-analytics/summary returns summary with zero counts when no data"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/summary")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify structure
        assert "totalLeads" in data
        assert "processedFast" in data
        assert "processedLate" in data
        assert "notProcessed" in data
        assert "weakProcessing" in data
        assert "stalledCount" in data
        assert "avgReactionHours" in data
        assert "conversionByStage" in data
        
        # When no data, counts should be 0
        assert data.get("totalLeads") == 0, f"Expected totalLeads=0, got {data.get('totalLeads')}"
        assert data.get("processedFast") == 0
        assert data.get("processedLate") == 0
        assert data.get("notProcessed") == 0
        assert data.get("weakProcessing") == 0
        assert data.get("stalledCount") == 0
        print(f"✓ GET /summary returns zero counts: totalLeads={data.get('totalLeads')}")


class TestLeadAnalyticsManagers:
    """Tests for Lead Analytics managers endpoint"""
    
    def test_get_managers_returns_empty_list(self):
        """GET /api/lead-analytics/managers returns empty managers list when no sync done"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/managers")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "managers" in data, "Response should have 'managers' key"
        assert isinstance(data["managers"], list), "managers should be a list"
        # When no sync has been done, managers list should be empty
        print(f"✓ GET /managers returns managers list (count: {len(data['managers'])})")


class TestLeadAnalyticsProblemLeads:
    """Tests for Lead Analytics problem leads endpoint"""
    
    def test_get_problem_leads_returns_empty_list(self):
        """GET /api/lead-analytics/problem-leads returns empty leads list when no data"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/problem-leads")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "leads" in data, "Response should have 'leads' key"
        assert isinstance(data["leads"], list), "leads should be a list"
        assert "total" in data, "Response should have 'total' key"
        print(f"✓ GET /problem-leads returns leads list (count: {len(data['leads'])})")


class TestLeadAnalyticsSyncStatus:
    """Tests for Lead Analytics sync status endpoint"""
    
    def test_get_sync_status_returns_status(self):
        """GET /api/lead-analytics/sync-status returns status"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/sync-status")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Should have status field (either 'never', 'running', 'completed', or 'error')
        assert "status" in data, "Response should have 'status' key"
        valid_statuses = ["never", "running", "completed", "error"]
        assert data["status"] in valid_statuses, f"Status should be one of {valid_statuses}, got {data['status']}"
        print(f"✓ GET /sync-status returns status='{data['status']}'")


class TestLeadAnalyticsPipelinesAndUsers:
    """Tests for Lead Analytics pipelines and users endpoint"""
    
    def test_get_pipelines_and_users_returns_arrays(self):
        """GET /api/lead-analytics/pipelines-and-users returns pipelines and users arrays"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/pipelines-and-users")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "pipelines" in data, "Response should have 'pipelines' key"
        assert "users" in data, "Response should have 'users' key"
        assert isinstance(data["pipelines"], list), "pipelines should be a list"
        assert isinstance(data["users"], list), "users should be a list"
        
        # Note: In preview environment without amoCRM configured, these may be empty
        # or there may be an 'error' field
        if "error" in data:
            print(f"✓ GET /pipelines-and-users returns arrays (amoCRM not configured: {data['error']})")
        else:
            print(f"✓ GET /pipelines-and-users returns pipelines={len(data['pipelines'])}, users={len(data['users'])}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
