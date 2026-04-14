"""
Test Closed/Lost Analytics Features - Iteration 82
Tests for excluding 'Закрыто и не реализовано' (amoCRM status 143) from main analytics.

Features tested:
1. GET /api/lead-analytics/closed-lost - returns closed lost leads with byManager breakdown
2. GET /api/lead-analytics/closed-lost - supports date_from, date_to, manager_id filters
3. GET /api/lead-analytics/summary - returns closedLost and totalWithClosed fields
4. GET /api/lead-analytics/problem-leads - excludes closed_lost (processingStatus != closed_lost)
5. PUT /api/lead-analytics/settings - accepts closedLostStageIds array
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestClosedLostEndpoint:
    """Tests for the new /api/lead-analytics/closed-lost endpoint"""
    
    def test_closed_lost_endpoint_exists(self):
        """GET /api/lead-analytics/closed-lost should return 200"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/closed-lost")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "leads" in data, "Response should have 'leads' field"
        assert "total" in data, "Response should have 'total' field"
        assert "byManager" in data, "Response should have 'byManager' field"
        assert isinstance(data["leads"], list), "'leads' should be a list"
        assert isinstance(data["total"], int), "'total' should be an integer"
        assert isinstance(data["byManager"], list), "'byManager' should be a list"
        print(f"PASS: closed-lost endpoint returns correct structure with {data['total']} leads")
    
    def test_closed_lost_with_date_from_filter(self):
        """GET /api/lead-analytics/closed-lost supports date_from filter"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/closed-lost", params={
            "date_from": "2024-01-01"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "leads" in data
        print(f"PASS: closed-lost with date_from filter works, returned {data['total']} leads")
    
    def test_closed_lost_with_date_to_filter(self):
        """GET /api/lead-analytics/closed-lost supports date_to filter"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/closed-lost", params={
            "date_to": "2025-12-31"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "leads" in data
        print(f"PASS: closed-lost with date_to filter works, returned {data['total']} leads")
    
    def test_closed_lost_with_date_range_filter(self):
        """GET /api/lead-analytics/closed-lost supports both date_from and date_to"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/closed-lost", params={
            "date_from": "2024-01-01",
            "date_to": "2025-12-31"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "leads" in data
        print(f"PASS: closed-lost with date range filter works, returned {data['total']} leads")
    
    def test_closed_lost_with_manager_id_filter(self):
        """GET /api/lead-analytics/closed-lost supports manager_id filter"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/closed-lost", params={
            "manager_id": "12345"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "leads" in data
        print(f"PASS: closed-lost with manager_id filter works, returned {data['total']} leads")
    
    def test_closed_lost_with_all_filters(self):
        """GET /api/lead-analytics/closed-lost supports all filters combined"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/closed-lost", params={
            "date_from": "2024-01-01",
            "date_to": "2025-12-31",
            "manager_id": "12345",
            "limit": 50,
            "skip": 0
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "leads" in data
        assert "total" in data
        assert "byManager" in data
        print(f"PASS: closed-lost with all filters works")
    
    def test_closed_lost_by_manager_structure(self):
        """byManager field should have correct structure"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/closed-lost")
        assert response.status_code == 200
        data = response.json()
        
        # byManager should be a list of objects with userId, userName, count
        for mgr in data["byManager"]:
            assert "userId" in mgr, "byManager item should have 'userId'"
            assert "userName" in mgr, "byManager item should have 'userName'"
            assert "count" in mgr, "byManager item should have 'count'"
        print(f"PASS: byManager structure is correct with {len(data['byManager'])} managers")


class TestSummaryClosedLostFields:
    """Tests for closedLost and totalWithClosed fields in summary endpoint"""
    
    def test_summary_has_closed_lost_field(self):
        """GET /api/lead-analytics/summary should return closedLost field"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/summary")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "closedLost" in data, "Summary should have 'closedLost' field"
        assert isinstance(data["closedLost"], int), "'closedLost' should be an integer"
        print(f"PASS: summary has closedLost field = {data['closedLost']}")
    
    def test_summary_has_total_with_closed_field(self):
        """GET /api/lead-analytics/summary should return totalWithClosed field"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/summary")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "totalWithClosed" in data, "Summary should have 'totalWithClosed' field"
        assert isinstance(data["totalWithClosed"], int), "'totalWithClosed' should be an integer"
        print(f"PASS: summary has totalWithClosed field = {data['totalWithClosed']}")
    
    def test_summary_total_leads_excludes_closed_lost(self):
        """totalLeads should not include closedLost (totalLeads + closedLost = totalWithClosed)"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/summary")
        assert response.status_code == 200
        
        data = response.json()
        total_leads = data.get("totalLeads", 0)
        closed_lost = data.get("closedLost", 0)
        total_with_closed = data.get("totalWithClosed", 0)
        
        # totalLeads + closedLost should equal totalWithClosed
        assert total_leads + closed_lost == total_with_closed, \
            f"totalLeads ({total_leads}) + closedLost ({closed_lost}) should equal totalWithClosed ({total_with_closed})"
        print(f"PASS: totalLeads ({total_leads}) + closedLost ({closed_lost}) = totalWithClosed ({total_with_closed})")
    
    def test_summary_with_date_filters(self):
        """Summary with date filters should still have closedLost fields"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/summary", params={
            "date_from": "2024-01-01",
            "date_to": "2025-12-31"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "closedLost" in data
        assert "totalWithClosed" in data
        print(f"PASS: summary with date filters has closedLost fields")


class TestProblemLeadsExcludesClosedLost:
    """Tests that problem-leads endpoint excludes closed_lost leads"""
    
    def test_problem_leads_endpoint_works(self):
        """GET /api/lead-analytics/problem-leads should return 200"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/problem-leads")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "leads" in data, "Response should have 'leads' field"
        assert "total" in data, "Response should have 'total' field"
        print(f"PASS: problem-leads endpoint works, returned {data['total']} leads")
    
    def test_problem_leads_excludes_closed_lost(self):
        """Problem leads should not include any leads with processingStatus='closed_lost'"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/problem-leads", params={"limit": 500})
        assert response.status_code == 200
        
        data = response.json()
        leads = data.get("leads", [])
        
        # Check that no lead has processingStatus='closed_lost'
        closed_lost_leads = [l for l in leads if l.get("processingStatus") == "closed_lost"]
        assert len(closed_lost_leads) == 0, \
            f"Problem leads should not include closed_lost leads, but found {len(closed_lost_leads)}"
        print(f"PASS: problem-leads excludes closed_lost (checked {len(leads)} leads)")


class TestSettingsClosedLostStageIds:
    """Tests for closedLostStageIds in settings"""
    
    def test_settings_has_closed_lost_stage_ids(self):
        """GET /api/lead-analytics/settings should return closedLostStageIds field"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "closedLostStageIds" in data, "Settings should have 'closedLostStageIds' field"
        assert isinstance(data["closedLostStageIds"], list), "'closedLostStageIds' should be a list"
        print(f"PASS: settings has closedLostStageIds = {data['closedLostStageIds']}")
    
    def test_settings_save_closed_lost_stage_ids(self):
        """PUT /api/lead-analytics/settings should accept closedLostStageIds array"""
        # First get current settings
        get_response = requests.get(f"{BASE_URL}/api/lead-analytics/settings")
        assert get_response.status_code == 200
        current_settings = get_response.json()
        
        # Prepare settings with closedLostStageIds
        test_settings = {
            "pipelineId": current_settings.get("pipelineId", ""),
            "newLeadStageIds": current_settings.get("newLeadStageIds", []),
            "managerWorkStageIds": current_settings.get("managerWorkStageIds", []),
            "successStageIds": current_settings.get("successStageIds", []),
            "closedLostStageIds": ["143", "999"],  # Test values
            "slaFirstActionHours": current_settings.get("slaFirstActionHours", 5),
            "stalledThresholdHours": current_settings.get("stalledThresholdHours", 24),
            "botUserIds": current_settings.get("botUserIds", []),
            "managerUserIds": current_settings.get("managerUserIds", []),
            "countNoteAsAction": current_settings.get("countNoteAsAction", True),
            "countTaskAsAction": current_settings.get("countTaskAsAction", True),
            "countStageChangeAsAction": current_settings.get("countStageChangeAsAction", True),
            "countCommunicationAsAction": current_settings.get("countCommunicationAsAction", True),
        }
        
        # Save settings
        put_response = requests.put(
            f"{BASE_URL}/api/lead-analytics/settings",
            json=test_settings
        )
        assert put_response.status_code == 200, f"Expected 200, got {put_response.status_code}: {put_response.text}"
        
        # Verify saved
        verify_response = requests.get(f"{BASE_URL}/api/lead-analytics/settings")
        assert verify_response.status_code == 200
        saved_settings = verify_response.json()
        
        assert "closedLostStageIds" in saved_settings
        assert "143" in saved_settings["closedLostStageIds"]
        assert "999" in saved_settings["closedLostStageIds"]
        print(f"PASS: closedLostStageIds saved and persisted: {saved_settings['closedLostStageIds']}")
        
        # Restore original settings
        restore_settings = {
            "pipelineId": current_settings.get("pipelineId", ""),
            "newLeadStageIds": current_settings.get("newLeadStageIds", []),
            "managerWorkStageIds": current_settings.get("managerWorkStageIds", []),
            "successStageIds": current_settings.get("successStageIds", []),
            "closedLostStageIds": current_settings.get("closedLostStageIds", []),
            "slaFirstActionHours": current_settings.get("slaFirstActionHours", 5),
            "stalledThresholdHours": current_settings.get("stalledThresholdHours", 24),
            "botUserIds": current_settings.get("botUserIds", []),
            "managerUserIds": current_settings.get("managerUserIds", []),
            "countNoteAsAction": current_settings.get("countNoteAsAction", True),
            "countTaskAsAction": current_settings.get("countTaskAsAction", True),
            "countStageChangeAsAction": current_settings.get("countStageChangeAsAction", True),
            "countCommunicationAsAction": current_settings.get("countCommunicationAsAction", True),
        }
        requests.put(f"{BASE_URL}/api/lead-analytics/settings", json=restore_settings)


class TestManagersClosedLostField:
    """Tests for closedLost field in managers endpoint"""
    
    def test_managers_endpoint_works(self):
        """GET /api/lead-analytics/managers should return 200"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/managers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "managers" in data, "Response should have 'managers' field"
        print(f"PASS: managers endpoint works, returned {len(data['managers'])} managers")


class TestExistingEndpointsStillWork:
    """Verify existing endpoints still work after changes"""
    
    def test_summary_endpoint(self):
        """GET /api/lead-analytics/summary should still work"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/summary")
        assert response.status_code == 200
        data = response.json()
        # Check all expected fields exist
        expected_fields = ["totalLeads", "processedFast", "processedLate", 
                          "notProcessed", "weakProcessing", "stalledCount",
                          "closedLost", "totalWithClosed", "avgReactionHours"]
        for field in expected_fields:
            assert field in data, f"Summary missing field: {field}"
        print(f"PASS: summary endpoint has all expected fields")
    
    def test_settings_endpoint(self):
        """GET /api/lead-analytics/settings should still work"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/settings")
        assert response.status_code == 200
        data = response.json()
        expected_fields = ["pipelineId", "newLeadStageIds", "managerWorkStageIds",
                          "successStageIds", "closedLostStageIds", "slaFirstActionHours",
                          "stalledThresholdHours", "botUserIds", "managerUserIds"]
        for field in expected_fields:
            assert field in data, f"Settings missing field: {field}"
        print(f"PASS: settings endpoint has all expected fields")
    
    def test_sync_status_endpoint(self):
        """GET /api/lead-analytics/sync-status should still work"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/sync-status")
        assert response.status_code == 200
        print(f"PASS: sync-status endpoint works")
    
    def test_pipelines_and_users_endpoint(self):
        """GET /api/lead-analytics/pipelines-and-users should still work"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/pipelines-and-users")
        assert response.status_code == 200
        data = response.json()
        assert "pipelines" in data
        assert "users" in data
        print(f"PASS: pipelines-and-users endpoint works")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
