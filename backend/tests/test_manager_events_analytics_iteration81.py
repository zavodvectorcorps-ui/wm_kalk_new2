"""
Test Manager Events Analytics Module (Phase 3)
Tests for event-based manager performance tracking from amoCRM Analytics Events API.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestManagerEventsAnalyticsSettings:
    """Tests for event analytics settings endpoints"""
    
    def test_get_event_settings_returns_defaults(self):
        """GET /api/lead-analytics/events/settings returns default settings"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/events/settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify default fields exist
        assert "usefulEventTypes" in data, "Missing usefulEventTypes field"
        assert "slaFirstActionHours" in data, "Missing slaFirstActionHours field"
        assert "stalledThresholdHours" in data, "Missing stalledThresholdHours field"
        assert "weightReactionSpeed" in data, "Missing weightReactionSpeed field"
        assert "weightProcessingPercent" in data, "Missing weightProcessingPercent field"
        assert "weightEventActivity" in data, "Missing weightEventActivity field"
        assert "weightDealProgress" in data, "Missing weightDealProgress field"
        assert "weightProblemLeads" in data, "Missing weightProblemLeads field"
        
        # Verify default values
        assert isinstance(data["usefulEventTypes"], list), "usefulEventTypes should be a list"
        assert len(data["usefulEventTypes"]) > 0, "usefulEventTypes should have default values"
        assert data["slaFirstActionHours"] == 5, f"Default slaFirstActionHours should be 5, got {data['slaFirstActionHours']}"
        assert data["stalledThresholdHours"] == 24, f"Default stalledThresholdHours should be 24, got {data['stalledThresholdHours']}"
        
        print(f"Settings response: {data}")
    
    def test_save_event_settings(self):
        """PUT /api/lead-analytics/events/settings saves settings"""
        # Custom settings to save
        settings_payload = {
            "usefulEventTypes": ["lead_added", "lead_status_changed", "note_added"],
            "progressStageIds": ["123", "456"],
            "successStageIds": ["789"],
            "slaFirstActionHours": 8,
            "stalledThresholdHours": 48,
            "weightReactionSpeed": 30,
            "weightProcessingPercent": 20,
            "weightEventActivity": 25,
            "weightDealProgress": 15,
            "weightProblemLeads": 10
        }
        
        response = requests.put(
            f"{BASE_URL}/api/lead-analytics/events/settings",
            json=settings_payload
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") == "ok", f"Expected status 'ok', got {data}"
        
        # Verify settings were saved by fetching them
        get_response = requests.get(f"{BASE_URL}/api/lead-analytics/events/settings")
        assert get_response.status_code == 200
        
        saved_data = get_response.json()
        assert saved_data["slaFirstActionHours"] == 8, "slaFirstActionHours not saved correctly"
        assert saved_data["stalledThresholdHours"] == 48, "stalledThresholdHours not saved correctly"
        assert saved_data["weightReactionSpeed"] == 30, "weightReactionSpeed not saved correctly"
        
        print(f"Settings saved and verified: {saved_data}")
        
        # Restore defaults
        default_settings = {
            "usefulEventTypes": [
                "lead_added", "lead_status_changed", "entity_linked",
                "note_added", "task_added", "task_completed",
                "incoming_call", "outgoing_call", "incoming_chat_message", "outgoing_chat_message"
            ],
            "progressStageIds": [],
            "successStageIds": [],
            "slaFirstActionHours": 5,
            "stalledThresholdHours": 24,
            "weightReactionSpeed": 25,
            "weightProcessingPercent": 25,
            "weightEventActivity": 20,
            "weightDealProgress": 20,
            "weightProblemLeads": 10
        }
        requests.put(f"{BASE_URL}/api/lead-analytics/events/settings", json=default_settings)


class TestManagerEventsAnalyticsSyncStatus:
    """Tests for sync status endpoint"""
    
    def test_get_sync_status(self):
        """GET /api/lead-analytics/events/sync-status returns status"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/events/sync-status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Should have status field (either 'never', 'running', 'completed', or 'error')
        assert "status" in data, "Missing status field"
        assert data["status"] in ["never", "running", "completed", "error"], f"Unexpected status: {data['status']}"
        
        print(f"Sync status: {data}")


class TestManagerEventsAnalyticsManagerStats:
    """Tests for manager stats endpoint"""
    
    def test_get_manager_stats(self):
        """GET /api/lead-analytics/events/manager-stats returns managers list"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/events/manager-stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "managers" in data, "Missing managers field"
        assert isinstance(data["managers"], list), "managers should be a list"
        
        # sync_id can be None if no sync has been run
        assert "sync_id" in data, "Missing sync_id field"
        
        print(f"Manager stats: {len(data['managers'])} managers, sync_id: {data['sync_id']}")


class TestManagerEventsAnalyticsEventFeed:
    """Tests for event feed endpoint"""
    
    def test_get_event_feed_no_filters(self):
        """GET /api/lead-analytics/events/event-feed returns events list"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/events/event-feed")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "events" in data, "Missing events field"
        assert "total" in data, "Missing total field"
        assert isinstance(data["events"], list), "events should be a list"
        assert isinstance(data["total"], int), "total should be an integer"
        
        print(f"Event feed: {len(data['events'])} events, total: {data['total']}")
    
    def test_get_event_feed_with_filters(self):
        """GET /api/lead-analytics/events/event-feed with filters"""
        params = {
            "limit": 10,
            "skip": 0,
            "event_type": "lead_status_changed"
        }
        response = requests.get(f"{BASE_URL}/api/lead-analytics/events/event-feed", params=params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "events" in data, "Missing events field"
        assert "total" in data, "Missing total field"
        
        print(f"Filtered event feed: {len(data['events'])} events")


class TestManagerEventsAnalyticsManagerDetail:
    """Tests for manager detail endpoint"""
    
    def test_get_manager_detail_nonexistent(self):
        """GET /api/lead-analytics/events/manager-detail/{user_id} for non-existent user"""
        # Test with a non-existent user ID - should still return 200 with empty data
        response = requests.get(f"{BASE_URL}/api/lead-analytics/events/manager-detail/999999")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Should have expected fields even if empty
        assert "events" in data, "Missing events field"
        assert "totalEvents" in data, "Missing totalEvents field"
        assert "problemLeads" in data, "Missing problemLeads field"
        assert "noFirstAction" in data, "Missing noFirstAction field"
        assert "noProgress" in data, "Missing noProgress field"
        assert "longIdle" in data, "Missing longIdle field"
        
        print(f"Manager detail for non-existent user: {data}")
    
    def test_get_manager_detail_with_date_filters(self):
        """GET /api/lead-analytics/events/manager-detail/{user_id} with date filters"""
        params = {
            "date_from": "2024-01-01T00:00:00",
            "date_to": "2024-12-31T23:59:59"
        }
        response = requests.get(
            f"{BASE_URL}/api/lead-analytics/events/manager-detail/12345",
            params=params
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "events" in data, "Missing events field"
        
        print(f"Manager detail with date filters: {data}")


class TestManagerEventsAnalyticsSync:
    """Tests for sync endpoint (POST)"""
    
    def test_start_events_sync(self):
        """POST /api/lead-analytics/events/sync starts background sync"""
        # Note: This will start a background task but may fail if amoCRM is not configured
        # We just verify the endpoint responds correctly
        response = requests.post(f"{BASE_URL}/api/lead-analytics/events/sync")
        
        # Should return 200 with status 'started' or an error if amoCRM not configured
        assert response.status_code in [200, 400, 500], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "status" in data, "Missing status field"
            assert data["status"] == "started", f"Expected 'started', got {data['status']}"
            assert "sync_id" in data, "Missing sync_id field"
            print(f"Sync started: {data}")
        else:
            print(f"Sync not started (expected if amoCRM not configured): {response.text}")


class TestExistingLeadAnalyticsEndpoints:
    """Verify existing lead analytics endpoints still work"""
    
    def test_lead_analytics_settings(self):
        """GET /api/lead-analytics/settings still works"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("Lead analytics settings endpoint working")
    
    def test_lead_analytics_summary(self):
        """GET /api/lead-analytics/summary still works"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/summary")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("Lead analytics summary endpoint working")
    
    def test_lead_analytics_managers(self):
        """GET /api/lead-analytics/managers still works"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/managers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("Lead analytics managers endpoint working")
    
    def test_lead_analytics_problem_leads(self):
        """GET /api/lead-analytics/problem-leads still works"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/problem-leads")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("Lead analytics problem-leads endpoint working")
    
    def test_lead_analytics_sync_status(self):
        """GET /api/lead-analytics/sync-status still works"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/sync-status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("Lead analytics sync-status endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
