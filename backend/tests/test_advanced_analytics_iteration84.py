"""
Test Advanced Manager Analytics Module (Iteration 84)
Tests for the new advanced analytics endpoints:
- GET /api/lead-analytics/advanced/dashboard
- GET /api/lead-analytics/advanced/sync-status
- POST /api/lead-analytics/advanced/sync
- POST /api/lead-analytics/advanced/ai/comparison

Tracks 3 specific managers: Vlada WM Group, Andrzej WM-sauna, Viyaleta WM-sauna
Pipeline: 8969514
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdvancedAnalyticsDashboard:
    """Tests for GET /api/lead-analytics/advanced/dashboard"""
    
    def test_dashboard_returns_200(self):
        """Dashboard endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/advanced/dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: Dashboard endpoint returns 200")
    
    def test_dashboard_response_structure(self):
        """Dashboard should return expected structure (empty when no sync)"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/advanced/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        # Should have these keys
        assert "managers" in data, "Response should have 'managers' key"
        assert "urgentActions" in data, "Response should have 'urgentActions' key"
        assert "totalActiveDeals" in data, "Response should have 'totalActiveDeals' key"
        assert "syncStatus" in data, "Response should have 'syncStatus' key"
        
        # Managers should be a list
        assert isinstance(data["managers"], list), "managers should be a list"
        assert isinstance(data["urgentActions"], list), "urgentActions should be a list"
        
        print(f"PASS: Dashboard response structure correct. syncStatus={data['syncStatus']}, managers={len(data['managers'])}")


class TestAdvancedAnalyticsSyncStatus:
    """Tests for GET /api/lead-analytics/advanced/sync-status"""
    
    def test_sync_status_returns_200(self):
        """Sync status endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/advanced/sync-status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: Sync status endpoint returns 200")
    
    def test_sync_status_response_structure(self):
        """Sync status should return status field"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/advanced/sync-status")
        assert response.status_code == 200
        data = response.json()
        
        # Should have status field
        assert "status" in data, "Response should have 'status' key"
        # Status should be one of: never, running, completed, error
        valid_statuses = ["never", "running", "completed", "error"]
        assert data["status"] in valid_statuses, f"Status should be one of {valid_statuses}, got {data['status']}"
        
        print(f"PASS: Sync status response correct. status={data['status']}")


class TestAdvancedAnalyticsSync:
    """Tests for POST /api/lead-analytics/advanced/sync"""
    
    def test_sync_returns_200(self):
        """Sync endpoint should return 200 and start background task"""
        response = requests.post(f"{BASE_URL}/api/lead-analytics/advanced/sync")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: Sync endpoint returns 200")
    
    def test_sync_response_structure(self):
        """Sync should return status and sync_id"""
        response = requests.post(f"{BASE_URL}/api/lead-analytics/advanced/sync")
        assert response.status_code == 200
        data = response.json()
        
        # Should have status and sync_id
        assert "status" in data, "Response should have 'status' key"
        assert "sync_id" in data, "Response should have 'sync_id' key"
        assert data["status"] == "started", f"Status should be 'started', got {data['status']}"
        assert data["sync_id"].startswith("adv_"), f"sync_id should start with 'adv_', got {data['sync_id']}"
        
        print(f"PASS: Sync response correct. sync_id={data['sync_id']}")
    
    def test_sync_with_date_params(self):
        """Sync should accept date_from and date_to params"""
        response = requests.post(
            f"{BASE_URL}/api/lead-analytics/advanced/sync",
            params={"date_from": "2024-01-01", "date_to": "2024-12-31"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["status"] == "started"
        print("PASS: Sync accepts date params")


class TestAdvancedAnalyticsAIComparison:
    """Tests for POST /api/lead-analytics/advanced/ai/comparison"""
    
    def test_ai_comparison_returns_200(self):
        """AI comparison endpoint should return 200"""
        response = requests.post(f"{BASE_URL}/api/lead-analytics/advanced/ai/comparison")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: AI comparison endpoint returns 200")
    
    def test_ai_comparison_response_structure(self):
        """AI comparison should return text field"""
        response = requests.post(f"{BASE_URL}/api/lead-analytics/advanced/ai/comparison")
        assert response.status_code == 200
        data = response.json()
        
        # Should have text field
        assert "text" in data, "Response should have 'text' key"
        assert isinstance(data["text"], str), "text should be a string"
        
        # With no data, should return no-data message
        if "Нет данных" in data["text"] or "синхронизацию" in data["text"]:
            print(f"PASS: AI comparison returns no-data message (expected): {data['text'][:100]}")
        else:
            print(f"PASS: AI comparison returns text: {data['text'][:100]}...")


class TestExistingLeadAnalyticsEndpoints:
    """Verify existing lead-analytics endpoints still work"""
    
    def test_summary_still_works(self):
        """GET /api/lead-analytics/summary should still work"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/summary")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /api/lead-analytics/summary still works")
    
    def test_managers_still_works(self):
        """GET /api/lead-analytics/managers should still work"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/managers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /api/lead-analytics/managers still works")
    
    def test_settings_still_works(self):
        """GET /api/lead-analytics/settings should still work"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /api/lead-analytics/settings still works")
    
    def test_sync_status_still_works(self):
        """GET /api/lead-analytics/sync-status should still work"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/sync-status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /api/lead-analytics/sync-status still works")
    
    def test_closed_lost_still_works(self):
        """GET /api/lead-analytics/closed-lost should still work"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/closed-lost")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /api/lead-analytics/closed-lost still works")
    
    def test_manager_events_analytics_still_works(self):
        """GET /api/lead-analytics/events/manager-stats should still work"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/events/manager-stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /api/lead-analytics/events/manager-stats still works")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
