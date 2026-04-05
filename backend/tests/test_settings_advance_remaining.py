"""
Test CRM Settings - advanceFieldId and remainingFieldId persistence
Verifies the bug fix: these fields were being stripped by Pydantic before the fix.
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCRMSettingsAdvanceRemaining:
    """Test that advanceFieldId and remainingFieldId are saved and loaded correctly."""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Store original settings to restore after tests."""
        self.original_settings = None
        try:
            res = requests.get(f"{BASE_URL}/api/sauna-crm/settings", timeout=10)
            if res.status_code == 200:
                self.original_settings = res.json()
        except Exception as e:
            print(f"Warning: Could not fetch original settings: {e}")
        yield
        # Restore original settings after test
        if self.original_settings:
            try:
                requests.post(
                    f"{BASE_URL}/api/sauna-crm/settings",
                    json=self.original_settings,
                    timeout=10
                )
            except Exception as e:
                print(f"Warning: Could not restore settings: {e}")
    
    def test_get_settings_returns_advance_remaining_fields(self):
        """GET /api/sauna-crm/settings should return advanceFieldId and remainingFieldId."""
        res = requests.get(f"{BASE_URL}/api/sauna-crm/settings", timeout=10)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        
        data = res.json()
        # Fields should exist in response (even if empty)
        assert "advanceFieldId" in data, "advanceFieldId should be in settings response"
        assert "remainingFieldId" in data, "remainingFieldId should be in settings response"
        print(f"Current advanceFieldId: '{data.get('advanceFieldId')}'")
        print(f"Current remainingFieldId: '{data.get('remainingFieldId')}'")
    
    def test_save_settings_with_advance_field_id(self):
        """POST /api/sauna-crm/settings should save advanceFieldId correctly."""
        # First get current settings
        res = requests.get(f"{BASE_URL}/api/sauna-crm/settings", timeout=10)
        assert res.status_code == 200
        settings = res.json()
        
        # Set a test value for advanceFieldId
        test_advance_id = "TEST_ADVANCE_12345"
        settings["advanceFieldId"] = test_advance_id
        
        # Save settings
        save_res = requests.post(
            f"{BASE_URL}/api/sauna-crm/settings",
            json=settings,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        assert save_res.status_code == 200, f"Save failed: {save_res.status_code} - {save_res.text}"
        
        # Read back and verify
        verify_res = requests.get(f"{BASE_URL}/api/sauna-crm/settings", timeout=10)
        assert verify_res.status_code == 200
        
        verified_settings = verify_res.json()
        assert verified_settings.get("advanceFieldId") == test_advance_id, \
            f"advanceFieldId not persisted! Expected '{test_advance_id}', got '{verified_settings.get('advanceFieldId')}'"
        print(f"SUCCESS: advanceFieldId saved and retrieved correctly: {test_advance_id}")
    
    def test_save_settings_with_remaining_field_id(self):
        """POST /api/sauna-crm/settings should save remainingFieldId correctly."""
        # First get current settings
        res = requests.get(f"{BASE_URL}/api/sauna-crm/settings", timeout=10)
        assert res.status_code == 200
        settings = res.json()
        
        # Set a test value for remainingFieldId
        test_remaining_id = "TEST_REMAINING_67890"
        settings["remainingFieldId"] = test_remaining_id
        
        # Save settings
        save_res = requests.post(
            f"{BASE_URL}/api/sauna-crm/settings",
            json=settings,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        assert save_res.status_code == 200, f"Save failed: {save_res.status_code} - {save_res.text}"
        
        # Read back and verify
        verify_res = requests.get(f"{BASE_URL}/api/sauna-crm/settings", timeout=10)
        assert verify_res.status_code == 200
        
        verified_settings = verify_res.json()
        assert verified_settings.get("remainingFieldId") == test_remaining_id, \
            f"remainingFieldId not persisted! Expected '{test_remaining_id}', got '{verified_settings.get('remainingFieldId')}'"
        print(f"SUCCESS: remainingFieldId saved and retrieved correctly: {test_remaining_id}")
    
    def test_save_both_advance_and_remaining_fields(self):
        """POST /api/sauna-crm/settings should save both advanceFieldId and remainingFieldId together."""
        # First get current settings
        res = requests.get(f"{BASE_URL}/api/sauna-crm/settings", timeout=10)
        assert res.status_code == 200
        settings = res.json()
        
        # Set test values for both fields
        test_advance_id = "BOTH_ADVANCE_111"
        test_remaining_id = "BOTH_REMAINING_222"
        settings["advanceFieldId"] = test_advance_id
        settings["remainingFieldId"] = test_remaining_id
        
        # Save settings
        save_res = requests.post(
            f"{BASE_URL}/api/sauna-crm/settings",
            json=settings,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        assert save_res.status_code == 200, f"Save failed: {save_res.status_code} - {save_res.text}"
        
        # Read back and verify both fields
        verify_res = requests.get(f"{BASE_URL}/api/sauna-crm/settings", timeout=10)
        assert verify_res.status_code == 200
        
        verified_settings = verify_res.json()
        assert verified_settings.get("advanceFieldId") == test_advance_id, \
            f"advanceFieldId not persisted! Expected '{test_advance_id}', got '{verified_settings.get('advanceFieldId')}'"
        assert verified_settings.get("remainingFieldId") == test_remaining_id, \
            f"remainingFieldId not persisted! Expected '{test_remaining_id}', got '{verified_settings.get('remainingFieldId')}'"
        print(f"SUCCESS: Both fields saved and retrieved correctly:")
        print(f"  advanceFieldId: {test_advance_id}")
        print(f"  remainingFieldId: {test_remaining_id}")
    
    def test_settings_round_trip_preserves_other_fields(self):
        """Saving advanceFieldId/remainingFieldId should not affect other settings fields."""
        # Get current settings
        res = requests.get(f"{BASE_URL}/api/sauna-crm/settings", timeout=10)
        assert res.status_code == 200
        original = res.json()
        
        # Modify advance/remaining fields
        modified = original.copy()
        modified["advanceFieldId"] = "ROUNDTRIP_ADV"
        modified["remainingFieldId"] = "ROUNDTRIP_REM"
        
        # Save
        save_res = requests.post(
            f"{BASE_URL}/api/sauna-crm/settings",
            json=modified,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        assert save_res.status_code == 200
        
        # Verify other fields are preserved
        verify_res = requests.get(f"{BASE_URL}/api/sauna-crm/settings", timeout=10)
        assert verify_res.status_code == 200
        verified = verify_res.json()
        
        # Check that stages are preserved
        assert len(verified.get("stages", [])) == len(original.get("stages", [])), \
            "Stages count changed after save"
        
        # Check that fields config is preserved
        assert len(verified.get("fields", [])) == len(original.get("fields", [])), \
            "Fields config count changed after save"
        
        # Check other settings
        assert verified.get("autoSyncEnabled") == original.get("autoSyncEnabled"), \
            "autoSyncEnabled changed after save"
        
        print("SUCCESS: Round-trip preserves other settings fields")


class TestSyncStatusEndpoint:
    """Test sync status endpoint."""
    
    def test_sync_status_returns_idle_when_no_sync(self):
        """GET /api/sauna-crm/sync-status should return idle status when no sync is running."""
        res = requests.get(f"{BASE_URL}/api/sauna-crm/sync-status", timeout=10)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        
        data = res.json()
        # Should have status field
        assert "status" in data, "Response should have 'status' field"
        # When no sync is running, status should be 'idle' or 'completed'
        assert data["status"] in ["idle", "completed"], f"Unexpected status: {data['status']}"
        print(f"Sync status: {data}")


class TestSyncFromAmoCRMEndpoint:
    """Test sync-from-amocrm endpoint (non-blocking behavior)."""
    
    def test_sync_endpoint_returns_quickly(self):
        """POST /api/sauna-crm/sync-from-amocrm should return immediately (non-blocking)."""
        start_time = time.time()
        res = requests.post(f"{BASE_URL}/api/sauna-crm/sync-from-amocrm", timeout=10)
        elapsed = time.time() - start_time
        
        # Should return quickly (< 0.5s) regardless of success/failure
        assert elapsed < 0.5, f"Endpoint took too long: {elapsed:.2f}s (should be < 0.5s)"
        
        # Should return 202 (accepted) or 400 (amoCRM not configured)
        assert res.status_code in [200, 202, 400], f"Unexpected status: {res.status_code}"
        
        data = res.json()
        print(f"Sync response ({elapsed:.3f}s): {data}")
        
        if res.status_code == 400:
            # Expected when amoCRM is not configured
            assert "amoCRM" in data.get("detail", ""), "Should mention amoCRM in error"
        else:
            # Should indicate sync started
            assert data.get("status") in ["accepted", "already_running"], \
                f"Unexpected status: {data.get('status')}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
