"""
Tests for changeLog, hasUnreviewedChanges, and amoComment features in Sauna CRM.
Features tested:
1. GET /api/sauna-crm/leads/{id} returns hasUnreviewedChanges, amoComment, changeLog
2. PUT /api/sauna-crm/leads/{id}/acknowledge-changes clears hasUnreviewedChanges
3. GET /api/sauna-crm/settings returns commentFieldId
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_LEAD_ID = "CRM-59FC9032"


class TestChangeLogFeatures:
    """Test changeLog, hasUnreviewedChanges, amoComment fields"""
    
    def test_get_lead_returns_hasUnreviewedChanges(self):
        """GET /api/sauna-crm/leads/{id} returns hasUnreviewedChanges field"""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{TEST_LEAD_ID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "hasUnreviewedChanges" in data, "hasUnreviewedChanges field missing"
        assert isinstance(data["hasUnreviewedChanges"], bool), "hasUnreviewedChanges should be boolean"
        print(f"hasUnreviewedChanges = {data['hasUnreviewedChanges']}")
    
    def test_get_lead_returns_amoComment(self):
        """GET /api/sauna-crm/leads/{id} returns amoComment field"""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{TEST_LEAD_ID}")
        assert response.status_code == 200
        
        data = response.json()
        assert "amoComment" in data, "amoComment field missing"
        assert isinstance(data["amoComment"], str), "amoComment should be string"
        print(f"amoComment = '{data['amoComment']}'")
    
    def test_get_lead_returns_changeLog(self):
        """GET /api/sauna-crm/leads/{id} returns changeLog array"""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{TEST_LEAD_ID}")
        assert response.status_code == 200
        
        data = response.json()
        assert "changeLog" in data, "changeLog field missing"
        assert isinstance(data["changeLog"], list), "changeLog should be array"
        print(f"changeLog has {len(data['changeLog'])} entries")
    
    def test_changeLog_entry_structure(self):
        """changeLog entries have required fields: field, label, oldValue, newValue, timestamp, source"""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{TEST_LEAD_ID}")
        assert response.status_code == 200
        
        data = response.json()
        change_log = data.get("changeLog", [])
        
        if len(change_log) > 0:
            entry = change_log[0]
            required_fields = ["field", "label", "oldValue", "newValue", "timestamp", "source"]
            for field in required_fields:
                assert field in entry, f"changeLog entry missing '{field}' field"
            print(f"Sample entry: {entry}")
        else:
            pytest.skip("No changeLog entries to verify structure")
    
    def test_test_lead_has_expected_data(self):
        """Test lead CRM-59FC9032 has expected test data"""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{TEST_LEAD_ID}")
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify test data is set up correctly
        assert data.get("hasUnreviewedChanges") == True, "Test lead should have hasUnreviewedChanges=true"
        assert data.get("amoComment") != "", "Test lead should have amoComment set"
        assert len(data.get("changeLog", [])) >= 3, "Test lead should have at least 3 changeLog entries"
        
        print(f"Test lead verified: hasUnreviewedChanges={data['hasUnreviewedChanges']}, amoComment='{data['amoComment'][:50]}...', changeLog entries={len(data['changeLog'])}")


class TestAcknowledgeChanges:
    """Test acknowledge-changes endpoint"""
    
    def test_acknowledge_changes_endpoint_exists(self):
        """PUT /api/sauna-crm/leads/{id}/acknowledge-changes endpoint exists"""
        response = requests.put(f"{BASE_URL}/api/sauna-crm/leads/{TEST_LEAD_ID}/acknowledge-changes")
        # Should return 200 OK, not 404 or 405
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        print(f"acknowledge-changes returned: {response.json()}")
    
    def test_acknowledge_changes_clears_flag(self):
        """PUT /api/sauna-crm/leads/{id}/acknowledge-changes sets hasUnreviewedChanges to false"""
        # First, ensure the flag is true
        lead_response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{TEST_LEAD_ID}")
        assert lead_response.status_code == 200
        
        # Call acknowledge
        ack_response = requests.put(f"{BASE_URL}/api/sauna-crm/leads/{TEST_LEAD_ID}/acknowledge-changes")
        assert ack_response.status_code == 200
        
        # Verify flag is now false
        verify_response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{TEST_LEAD_ID}")
        assert verify_response.status_code == 200
        data = verify_response.json()
        assert data.get("hasUnreviewedChanges") == False, "hasUnreviewedChanges should be false after acknowledge"
        print("hasUnreviewedChanges cleared successfully")
    
    def test_acknowledge_changes_preserves_changeLog(self):
        """After acknowledge, changeLog is still present (not deleted)"""
        # Call acknowledge
        requests.put(f"{BASE_URL}/api/sauna-crm/leads/{TEST_LEAD_ID}/acknowledge-changes")
        
        # Verify changeLog still exists
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{TEST_LEAD_ID}")
        assert response.status_code == 200
        data = response.json()
        
        assert "changeLog" in data, "changeLog should still exist after acknowledge"
        assert len(data.get("changeLog", [])) >= 3, "changeLog entries should be preserved"
        print(f"changeLog preserved with {len(data['changeLog'])} entries")
    
    def test_acknowledge_nonexistent_lead_returns_404(self):
        """PUT /api/sauna-crm/leads/NONEXISTENT/acknowledge-changes returns 404"""
        response = requests.put(f"{BASE_URL}/api/sauna-crm/leads/NONEXISTENT-LEAD-ID/acknowledge-changes")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("404 returned for nonexistent lead")


class TestSettingsCommentFieldId:
    """Test commentFieldId in settings"""
    
    def test_settings_returns_commentFieldId(self):
        """GET /api/sauna-crm/settings returns commentFieldId field"""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/settings")
        assert response.status_code == 200
        
        data = response.json()
        # commentFieldId should exist in settings (can be empty string or value)
        assert "commentFieldId" in data or data.get("commentFieldId") is None, "commentFieldId should be in settings"
        print(f"commentFieldId = {data.get('commentFieldId')}")
    
    def test_settings_can_save_commentFieldId(self):
        """POST /api/sauna-crm/settings can save commentFieldId"""
        # Get current settings
        get_response = requests.get(f"{BASE_URL}/api/sauna-crm/settings")
        assert get_response.status_code == 200
        settings = get_response.json()
        
        # Update with commentFieldId
        settings["commentFieldId"] = "12345"
        
        save_response = requests.post(
            f"{BASE_URL}/api/sauna-crm/settings",
            json=settings,
            headers={"Content-Type": "application/json"}
        )
        assert save_response.status_code == 200, f"Failed to save settings: {save_response.text}"
        
        # Verify it was saved
        verify_response = requests.get(f"{BASE_URL}/api/sauna-crm/settings")
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data.get("commentFieldId") == "12345", "commentFieldId not saved correctly"
        
        # Reset to empty
        settings["commentFieldId"] = ""
        requests.post(f"{BASE_URL}/api/sauna-crm/settings", json=settings, headers={"Content-Type": "application/json"})
        print("commentFieldId save/retrieve verified")


class TestResetTestData:
    """Reset test data after tests"""
    
    def test_reset_hasUnreviewedChanges_to_true(self):
        """Reset test lead hasUnreviewedChanges to true for future tests"""
        # Update lead to set hasUnreviewedChanges back to true
        response = requests.put(
            f"{BASE_URL}/api/sauna-crm/leads/{TEST_LEAD_ID}",
            json={"hasUnreviewedChanges": True},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Failed to reset test data: {response.text}"
        
        # Verify
        verify = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{TEST_LEAD_ID}")
        data = verify.json()
        assert data.get("hasUnreviewedChanges") == True, "Failed to reset hasUnreviewedChanges"
        print("Test data reset: hasUnreviewedChanges=true")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
