"""
Test AI Closed/Lost Analysis Feature - Iteration 83
Tests the new POST /api/lead-analytics/ai/closed-lost-analysis endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAIClosedLostAnalysis:
    """Tests for the new AI closed/lost analysis endpoint"""
    
    def test_ai_closed_lost_analysis_endpoint_exists(self):
        """Test that the AI closed-lost-analysis endpoint exists and returns 200"""
        response = requests.post(f"{BASE_URL}/api/lead-analytics/ai/closed-lost-analysis")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "text" in data, "Response should contain 'text' field"
        print(f"PASS: AI closed-lost-analysis endpoint exists and returns text")
    
    def test_ai_closed_lost_analysis_empty_data_message(self):
        """Test that endpoint returns proper message when no closed deals exist"""
        response = requests.post(f"{BASE_URL}/api/lead-analytics/ai/closed-lost-analysis")
        assert response.status_code == 200
        data = response.json()
        # With no data, should return the empty message
        assert data["text"] == "Нет закрытых сделок для анализа.", f"Expected empty data message, got: {data['text']}"
        print(f"PASS: Empty data returns correct message: '{data['text']}'")
    
    def test_ai_closed_lost_analysis_with_date_from(self):
        """Test endpoint supports date_from query parameter"""
        response = requests.post(f"{BASE_URL}/api/lead-analytics/ai/closed-lost-analysis?date_from=2024-01-01")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "text" in data
        print(f"PASS: date_from parameter accepted")
    
    def test_ai_closed_lost_analysis_with_date_to(self):
        """Test endpoint supports date_to query parameter"""
        response = requests.post(f"{BASE_URL}/api/lead-analytics/ai/closed-lost-analysis?date_to=2024-12-31")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "text" in data
        print(f"PASS: date_to parameter accepted")
    
    def test_ai_closed_lost_analysis_with_date_range(self):
        """Test endpoint supports both date_from and date_to parameters"""
        response = requests.post(
            f"{BASE_URL}/api/lead-analytics/ai/closed-lost-analysis?date_from=2024-01-01&date_to=2024-12-31"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "text" in data
        print(f"PASS: date range parameters accepted")


class TestExistingEndpointsStillWork:
    """Verify all existing endpoints still work after adding new AI endpoint"""
    
    def test_closed_lost_endpoint(self):
        """Test GET /api/lead-analytics/closed-lost still works"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/closed-lost")
        assert response.status_code == 200
        data = response.json()
        assert "leads" in data
        assert "total" in data
        assert "byManager" in data
        print(f"PASS: closed-lost endpoint works")
    
    def test_summary_endpoint(self):
        """Test GET /api/lead-analytics/summary still works"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/summary")
        assert response.status_code == 200
        data = response.json()
        assert "totalLeads" in data
        assert "closedLost" in data
        assert "totalWithClosed" in data
        print(f"PASS: summary endpoint works")
    
    def test_problem_leads_endpoint(self):
        """Test GET /api/lead-analytics/problem-leads still works"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/problem-leads")
        assert response.status_code == 200
        data = response.json()
        assert "leads" in data
        assert "total" in data
        print(f"PASS: problem-leads endpoint works")
    
    def test_settings_endpoint(self):
        """Test GET /api/lead-analytics/settings still works"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/settings")
        assert response.status_code == 200
        data = response.json()
        assert "pipelineId" in data
        assert "closedLostStageIds" in data
        print(f"PASS: settings endpoint works")
    
    def test_managers_endpoint(self):
        """Test GET /api/lead-analytics/managers still works"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/managers")
        assert response.status_code == 200
        data = response.json()
        assert "managers" in data
        print(f"PASS: managers endpoint works")
    
    def test_sync_status_endpoint(self):
        """Test GET /api/lead-analytics/sync-status still works"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/sync-status")
        assert response.status_code == 200
        print(f"PASS: sync-status endpoint works")
    
    def test_pipelines_and_users_endpoint(self):
        """Test GET /api/lead-analytics/pipelines-and-users still works"""
        response = requests.get(f"{BASE_URL}/api/lead-analytics/pipelines-and-users")
        assert response.status_code == 200
        data = response.json()
        assert "pipelines" in data
        assert "users" in data
        print(f"PASS: pipelines-and-users endpoint works")


class TestOtherAIEndpoints:
    """Verify other AI endpoints still work"""
    
    def test_ai_department_summary(self):
        """Test POST /api/lead-analytics/ai/department-summary still works"""
        response = requests.post(f"{BASE_URL}/api/lead-analytics/ai/department-summary")
        assert response.status_code == 200
        data = response.json()
        assert "text" in data
        print(f"PASS: ai/department-summary endpoint works")
    
    def test_ai_manager_analysis(self):
        """Test POST /api/lead-analytics/ai/manager-analysis still works"""
        response = requests.post(f"{BASE_URL}/api/lead-analytics/ai/manager-analysis")
        assert response.status_code == 200
        data = response.json()
        # Returns analyses array when no data
        assert "analyses" in data or "text" in data
        print(f"PASS: ai/manager-analysis endpoint works")
    
    def test_ai_common_errors(self):
        """Test POST /api/lead-analytics/ai/common-errors still works"""
        response = requests.post(f"{BASE_URL}/api/lead-analytics/ai/common-errors")
        assert response.status_code == 200
        data = response.json()
        assert "text" in data
        print(f"PASS: ai/common-errors endpoint works")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
