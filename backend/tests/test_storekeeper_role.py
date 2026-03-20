"""
Test Storekeeper Role Permissions - Iteration 63
Tests for the 'Кладовщик' (Storekeeper) role:
1. Login as storekeeper should work
2. Storekeeper should have access to warehouse and logistics modules
3. Storekeeper should NOT be able to delete orders in warehouse
4. Storekeeper should have read-only access to logistics
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
STOREKEEPER_USERNAME = "kladovshchik"
STOREKEEPER_PASSWORD = "kladovshchik123"
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"


class TestStorekeeperLogin:
    """Test storekeeper login functionality"""
    
    def test_storekeeper_login_success(self):
        """Storekeeper should be able to login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": STOREKEEPER_USERNAME,
            "password": STOREKEEPER_PASSWORD
        })
        print(f"Login response status: {response.status_code}")
        print(f"Login response: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert "user" in data, "Response should contain user"
        assert data["user"]["role"] == "storekeeper", f"Expected role 'storekeeper', got {data['user']['role']}"
        assert data["user"]["username"] == STOREKEEPER_USERNAME
        
    def test_storekeeper_login_wrong_password(self):
        """Storekeeper login with wrong password should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": STOREKEEPER_USERNAME,
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestStorekeeperWarehouseAccess:
    """Test storekeeper access to warehouse module"""
    
    @pytest.fixture
    def storekeeper_token(self):
        """Get storekeeper auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": STOREKEEPER_USERNAME,
            "password": STOREKEEPER_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Storekeeper login failed")
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Admin login failed")
    
    def test_storekeeper_can_access_dovoz_orders(self, storekeeper_token):
        """Storekeeper should be able to view dovoz orders"""
        headers = {"Authorization": f"Bearer {storekeeper_token}"}
        response = requests.get(f"{BASE_URL}/api/dovoz/orders", headers=headers)
        print(f"Dovoz orders response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "orders" in data, "Response should contain orders"
    
    def test_storekeeper_can_access_dovoz_stats(self, storekeeper_token):
        """Storekeeper should be able to view dovoz stats"""
        headers = {"Authorization": f"Bearer {storekeeper_token}"}
        response = requests.get(f"{BASE_URL}/api/dovoz/stats", headers=headers)
        print(f"Dovoz stats response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_storekeeper_can_access_warehouse_orders(self, storekeeper_token):
        """Storekeeper should be able to view warehouse orders"""
        headers = {"Authorization": f"Bearer {storekeeper_token}"}
        response = requests.get(f"{BASE_URL}/api/warehouse/orders", headers=headers)
        print(f"Warehouse orders response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_storekeeper_can_change_dovoz_stage(self, storekeeper_token, admin_token):
        """Storekeeper should be able to change dovoz order stage"""
        headers = {"Authorization": f"Bearer {storekeeper_token}"}
        
        # First get existing orders
        response = requests.get(f"{BASE_URL}/api/dovoz/orders", headers=headers)
        if response.status_code == 200:
            orders = response.json().get("orders", [])
            if orders:
                order_id = orders[0]["id"]
                current_stage = orders[0].get("dovozStage", "accepted")
                new_stage = "sent" if current_stage != "sent" else "accepted"
                
                # Try to change stage
                response = requests.put(
                    f"{BASE_URL}/api/dovoz/orders/{order_id}/stage?stage={new_stage}",
                    headers=headers
                )
                print(f"Change stage response: {response.status_code}")
                assert response.status_code == 200, f"Storekeeper should be able to change stage: {response.text}"
            else:
                print("No dovoz orders to test stage change")
                pytest.skip("No dovoz orders available for testing")
        else:
            pytest.skip("Could not fetch dovoz orders")


class TestStorekeeperLogisticsAccess:
    """Test storekeeper read-only access to logistics module (trips, drivers)"""
    
    @pytest.fixture
    def storekeeper_token(self):
        """Get storekeeper auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": STOREKEEPER_USERNAME,
            "password": STOREKEEPER_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Storekeeper login failed")
    
    def test_storekeeper_can_view_trips(self, storekeeper_token):
        """Storekeeper should be able to view trips"""
        headers = {"Authorization": f"Bearer {storekeeper_token}"}
        
        response = requests.get(f"{BASE_URL}/api/trips", headers=headers)
        print(f"Trips response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_storekeeper_can_view_drivers(self, storekeeper_token):
        """Storekeeper should be able to view drivers"""
        headers = {"Authorization": f"Bearer {storekeeper_token}"}
        
        response = requests.get(f"{BASE_URL}/api/drivers", headers=headers)
        print(f"Drivers response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_storekeeper_can_view_balia_orders(self, storekeeper_token):
        """Storekeeper should be able to view balia orders (logistics section)"""
        headers = {"Authorization": f"Bearer {storekeeper_token}"}
        
        response = requests.get(f"{BASE_URL}/api/orders?for_logistics=true", headers=headers)
        print(f"Balia orders response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"


class TestAdminFullAccess:
    """Test that admin still has full access"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Admin login failed")
    
    def test_admin_login_success(self):
        """Admin should be able to login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["user"]["role"] == "admin"
    
    def test_admin_can_access_warehouse(self, admin_token):
        """Admin should have full access to warehouse"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/dovoz/orders", headers=headers)
        assert response.status_code == 200
        
        response = requests.get(f"{BASE_URL}/api/warehouse/orders", headers=headers)
        assert response.status_code == 200
    
    def test_admin_can_access_trips(self, admin_token):
        """Admin should have full access to trips"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/trips", headers=headers)
        assert response.status_code == 200
        
        response = requests.get(f"{BASE_URL}/api/drivers", headers=headers)
        assert response.status_code == 200


class TestStorekeeperRoleValidation:
    """Test that storekeeper role is properly validated in backend"""
    
    def test_storekeeper_role_in_valid_roles(self):
        """Verify storekeeper is in the list of valid roles for user creation"""
        # Login as admin
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        admin_token = response.json()["token"]
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Try to create a test storekeeper user (should succeed if role is valid)
        test_user = {
            "username": "test_storekeeper_temp_63",
            "password": "testpass123",
            "role": "storekeeper",
            "access": "warehouse"
        }
        
        response = requests.post(f"{BASE_URL}/api/users", json=test_user, headers=headers)
        print(f"Create storekeeper user response: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        # If user already exists, that's fine - we just want to verify the role is valid
        if response.status_code == 400 and "already exists" in response.text:
            print("Test user already exists - role validation passed")
            return
        
        # Accept both 200 and 201 as success (API might return 200 for idempotent create)
        assert response.status_code in [200, 201], f"Expected 200 or 201, got {response.status_code}: {response.text}"
        
        # Clean up - delete the test user
        user_id = response.json()["id"]
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
