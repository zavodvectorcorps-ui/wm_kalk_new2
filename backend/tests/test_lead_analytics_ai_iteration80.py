"""
Test Lead Analytics AI Endpoints - Iteration 80
Tests the 4 new AI recommendation endpoints:
- POST /api/lead-analytics/ai/department-summary
- POST /api/lead-analytics/ai/manager-analysis
- POST /api/lead-analytics/ai/common-errors
- POST /api/lead-analytics/ai/problem-lead-advice?lead_id=123
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestLeadAnalyticsAIEndpoints:
    """Test AI recommendation endpoints for Lead Analytics module"""
    
    def test_department_summary_returns_200_with_text(self):
        """POST /api/lead-analytics/ai/department-summary should return 200 with text field"""
        response = requests.post(f"{BASE_URL}/api/lead-analytics/ai/department-summary")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "text" in data, f"Response should contain 'text' field: {data}"
        assert isinstance(data["text"], str), f"'text' should be a string: {data}"
        # Since no leads are synced, it should return a 'no data' message
        print(f"Department summary response: {data['text'][:100]}...")
    
    def test_manager_analysis_returns_200(self):
        """POST /api/lead-analytics/ai/manager-analysis should return 200"""
        response = requests.post(f"{BASE_URL}/api/lead-analytics/ai/manager-analysis")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Should return either 'text' or 'analyses' field
        # When no managers exist, it returns {"analyses": []}
        assert "text" in data or "analyses" in data, f"Response should contain 'text' or 'analyses': {data}"
        print(f"Manager analysis response: {data}")
    
    def test_common_errors_returns_200_with_text(self):
        """POST /api/lead-analytics/ai/common-errors should return 200 with text field"""
        response = requests.post(f"{BASE_URL}/api/lead-analytics/ai/common-errors")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "text" in data, f"Response should contain 'text' field: {data}"
        assert isinstance(data["text"], str), f"'text' should be a string: {data}"
        # Since no problem leads exist, it should return a positive message
        print(f"Common errors response: {data['text'][:100]}...")
    
    def test_problem_lead_advice_returns_404_for_nonexistent_lead(self):
        """POST /api/lead-analytics/ai/problem-lead-advice?lead_id=999999 should return 404"""
        response = requests.post(f"{BASE_URL}/api/lead-analytics/ai/problem-lead-advice?lead_id=999999")
        
        assert response.status_code == 404, f"Expected 404 for non-existent lead, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data, f"404 response should contain 'detail' field: {data}"
        print(f"Problem lead advice 404 response: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
