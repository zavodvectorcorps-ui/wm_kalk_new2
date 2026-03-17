"""
Test cases for Dovoz (additional deliveries) and Warehouse page APIs.
Tests: Settings CRUD, Orders listing, Stats, amoCRM sync
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')

# Test credentials
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_token():
    """Get authentication token for admin user."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "token" in data, "No token in login response"
    return data["token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    """Return auth headers for API requests."""
    return {"Authorization": f"Bearer {admin_token}"}


# =============================================================================
# Dovoz Settings API Tests
# =============================================================================

class TestDovozSettings:
    """Test dovoz settings CRUD operations."""
    
    def test_get_dovoz_settings_returns_defaults(self, auth_headers):
        """GET /api/dovoz/settings returns default settings with sections_enabled and dovoz_config."""
        response = requests.get(f"{BASE_URL}/api/dovoz/settings", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify sections_enabled structure
        assert "sections_enabled" in data, "Missing sections_enabled in response"
        sections = data["sections_enabled"]
        assert "orders" in sections, "Missing orders in sections_enabled"
        assert "trips" in sections, "Missing trips in sections_enabled"
        assert "dovoz" in sections, "Missing dovoz in sections_enabled"
        
        # Verify dovoz_config structure
        assert "dovoz_config" in data, "Missing dovoz_config in response"
        config = data["dovoz_config"]
        assert "source_pipeline_id" in config, "Missing source_pipeline_id"
        assert "source_status_id" in config, "Missing source_status_id"
        assert "sent_status_id" in config, "Missing sent_status_id"
        assert "delivered_status_id" in config, "Missing delivered_status_id"
        
        print(f"Settings structure verified: sections={list(sections.keys())}, config={list(config.keys())}")
    
    def test_put_dovoz_settings_saves_toggles(self, auth_headers):
        """PUT /api/dovoz/settings saves sections_enabled toggles and dovoz_config IDs."""
        # First, get current settings
        get_response = requests.get(f"{BASE_URL}/api/dovoz/settings", headers=auth_headers)
        original_settings = get_response.json()
        
        # Update settings
        new_settings = {
            "sections_enabled": {
                "orders": False,
                "trips": False,
                "dovoz": True
            },
            "dovoz_config": {
                "source_pipeline_id": "TEST_123",
                "source_status_id": "TEST_456",
                "sent_status_id": "TEST_789",
                "delivered_status_id": "TEST_012"
            }
        }
        
        response = requests.put(
            f"{BASE_URL}/api/dovoz/settings",
            headers={**auth_headers, "Content-Type": "application/json"},
            json=new_settings
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert response.json().get("success") == True, "Expected success=True"
        
        # Verify settings were saved by GET
        verify_response = requests.get(f"{BASE_URL}/api/dovoz/settings", headers=auth_headers)
        assert verify_response.status_code == 200
        
        saved_data = verify_response.json()
        assert saved_data["sections_enabled"]["orders"] == False, "orders toggle not saved"
        assert saved_data["sections_enabled"]["trips"] == False, "trips toggle not saved"
        assert saved_data["sections_enabled"]["dovoz"] == True, "dovoz toggle not saved"
        assert saved_data["dovoz_config"]["source_pipeline_id"] == "TEST_123", "source_pipeline_id not saved"
        
        print(f"Settings saved and verified successfully")
        
        # Restore original settings
        restore_settings = {
            "sections_enabled": original_settings.get("sections_enabled", {"orders": True, "trips": True, "dovoz": True}),
            "dovoz_config": original_settings.get("dovoz_config", {
                "source_pipeline_id": "",
                "source_status_id": "",
                "sent_status_id": "",
                "delivered_status_id": ""
            })
        }
        requests.put(
            f"{BASE_URL}/api/dovoz/settings",
            headers={**auth_headers, "Content-Type": "application/json"},
            json=restore_settings
        )
        print("Original settings restored")


# =============================================================================
# Dovoz Orders API Tests
# =============================================================================

class TestDovozOrders:
    """Test dovoz orders listing and filtering."""
    
    def test_get_dovoz_orders_returns_grouped_list(self, auth_headers):
        """GET /api/dovoz/orders returns empty orders list with by_stage grouping."""
        response = requests.get(f"{BASE_URL}/api/dovoz/orders", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify orders list exists (may be empty)
        assert "orders" in data, "Missing orders in response"
        assert isinstance(data["orders"], list), "orders should be a list"
        
        # Verify by_stage grouping exists
        assert "by_stage" in data, "Missing by_stage in response"
        by_stage = data["by_stage"]
        assert "accepted" in by_stage, "Missing 'accepted' stage"
        assert "sent" in by_stage, "Missing 'sent' stage"
        assert "delivered" in by_stage, "Missing 'delivered' stage"
        
        # Verify total count
        assert "total" in data, "Missing total count"
        
        # Verify stages metadata
        assert "stages" in data, "Missing stages metadata"
        
        print(f"Dovoz orders response: total={data['total']}, stages={list(by_stage.keys())}")
    
    def test_get_dovoz_orders_with_search(self, auth_headers):
        """GET /api/dovoz/orders with search parameter filters results."""
        response = requests.get(
            f"{BASE_URL}/api/dovoz/orders",
            params={"search": "nonexistent_search_term_xyz"},
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "orders" in data
        # With a non-existent search term, we expect empty or filtered results
        print(f"Search filter test: returned {len(data['orders'])} orders")


# =============================================================================
# Dovoz Stats API Tests
# =============================================================================

class TestDovozStats:
    """Test dovoz statistics endpoint."""
    
    def test_get_dovoz_stats_returns_counts(self, auth_headers):
        """GET /api/dovoz/stats returns by_stage counts and total."""
        response = requests.get(f"{BASE_URL}/api/dovoz/stats", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify by_stage counts
        assert "by_stage" in data, "Missing by_stage in response"
        by_stage = data["by_stage"]
        assert "accepted" in by_stage, "Missing 'accepted' count"
        assert "sent" in by_stage, "Missing 'sent' count"
        assert "delivered" in by_stage, "Missing 'delivered' count"
        
        # Verify counts are integers
        assert isinstance(by_stage["accepted"], int), "accepted count should be int"
        assert isinstance(by_stage["sent"], int), "sent count should be int"
        assert isinstance(by_stage["delivered"], int), "delivered count should be int"
        
        # Verify total
        assert "total" in data, "Missing total in response"
        assert isinstance(data["total"], int), "total should be int"
        
        # Verify total equals sum of stages
        calculated_total = by_stage["accepted"] + by_stage["sent"] + by_stage["delivered"]
        assert data["total"] == calculated_total, f"Total mismatch: {data['total']} vs calculated {calculated_total}"
        
        print(f"Stats: accepted={by_stage['accepted']}, sent={by_stage['sent']}, delivered={by_stage['delivered']}, total={data['total']}")


# =============================================================================
# amoCRM Sync API Tests
# =============================================================================

class TestDovozAmoCRMSync:
    """Test amoCRM sync functionality."""
    
    def test_sync_from_amocrm_without_config_fails(self, auth_headers):
        """POST /api/dovoz/sync-from-amocrm fails with proper error when config not set."""
        # First ensure config is empty
        settings = {
            "sections_enabled": {"orders": True, "trips": True, "dovoz": True},
            "dovoz_config": {
                "source_pipeline_id": "",
                "source_status_id": "",
                "sent_status_id": "",
                "delivered_status_id": ""
            }
        }
        requests.put(
            f"{BASE_URL}/api/dovoz/settings",
            headers={**auth_headers, "Content-Type": "application/json"},
            json=settings
        )
        
        # Try to sync - should fail with config error
        response = requests.post(
            f"{BASE_URL}/api/dovoz/sync-from-amocrm",
            headers=auth_headers
        )
        
        # Expecting 400 error about missing config
        assert response.status_code == 400, f"Expected 400 (config error), got {response.status_code}: {response.text}"
        
        error_detail = response.json().get("detail", "")
        # Should mention missing pipeline_id and status_id
        assert "pipeline_id" in error_detail.lower() or "status_id" in error_detail.lower() or "не настроен" in error_detail.lower(), \
            f"Error should mention missing config: {error_detail}"
        
        print(f"Sync correctly fails without config: {error_detail}")


# =============================================================================
# Warehouse API Tests
# =============================================================================

class TestWarehouseOrders:
    """Test warehouse orders endpoints."""
    
    def test_get_warehouse_orders(self, auth_headers):
        """GET /api/warehouse/orders returns orders list."""
        response = requests.get(f"{BASE_URL}/api/warehouse/orders", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "orders" in data, "Missing orders in response"
        assert "total" in data, "Missing total in response"
        assert "statuses" in data, "Missing statuses in response"
        
        print(f"Warehouse orders: total={data['total']}")
    
    def test_get_warehouse_trips(self, auth_headers):
        """GET /api/warehouse/trips returns trips list."""
        response = requests.get(f"{BASE_URL}/api/warehouse/trips", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "trips" in data, "Missing trips in response"
        assert "total" in data, "Missing total in response"
        
        print(f"Warehouse trips: total={data['total']}")
    
    def test_get_warehouse_stats(self, auth_headers):
        """GET /api/warehouse/stats returns statistics."""
        response = requests.get(f"{BASE_URL}/api/warehouse/stats", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "byStatus" in data, "Missing byStatus in response"
        assert "bySection" in data, "Missing bySection in response"
        assert "total" in data, "Missing total in response"
        
        print(f"Warehouse stats: byStatus={data['byStatus']}, bySection={data['bySection']}, total={data['total']}")


# =============================================================================
# Authentication Tests
# =============================================================================

class TestAuthentication:
    """Test authentication requirements."""
    
    def test_dovoz_settings_requires_auth(self):
        """GET /api/dovoz/settings requires authentication."""
        response = requests.get(f"{BASE_URL}/api/dovoz/settings")
        
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"Auth required: {response.status_code}")
    
    def test_dovoz_orders_requires_auth(self):
        """GET /api/dovoz/orders requires authentication."""
        response = requests.get(f"{BASE_URL}/api/dovoz/orders")
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"Auth required: {response.status_code}")
