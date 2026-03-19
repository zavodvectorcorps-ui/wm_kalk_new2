"""
Tests for order assignment feature - reassign responsible user (createdBy) for orders
Tests both sauna and balia order assignment endpoints
"""
import pytest
import requests
import os
from datetime import datetime

# Use environment variable for API URL
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://configurator-pdf-gen.preview.emergentagent.com')


class TestOrderAssignment:
    """Test suite for order assignment (createdBy) functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "admin", "password": "admin123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
    # ============ GET /api/users tests ============
    
    def test_get_users_for_dropdown(self):
        """Test GET /api/users returns user list for dropdown population"""
        response = self.session.get(f"{BASE_URL}/api/users")
        
        assert response.status_code == 200
        users = response.json()
        
        # Verify it's a list
        assert isinstance(users, list)
        assert len(users) > 0
        
        # Verify user structure has required fields
        first_user = users[0]
        assert "username" in first_user
        assert "role" in first_user
        assert "id" in first_user
        
        # Verify we have admin or employee users (these are shown in dropdown)
        admin_or_employees = [u for u in users if u.get("role") in ["admin", "employee"]]
        assert len(admin_or_employees) > 0, "Should have admin or employee users for assignment"
        
        print(f"SUCCESS: GET /api/users returned {len(users)} users, {len(admin_or_employees)} are admin/employee")
    
    # ============ PATCH /api/sauna/orders/{id}/assign tests ============
    
    def test_sauna_order_assign_success(self):
        """Test successful assignment of sauna order to new user"""
        # First get a sauna order
        orders_response = self.session.get(f"{BASE_URL}/api/sauna/orders")
        assert orders_response.status_code == 200
        orders = orders_response.json()
        
        if len(orders) == 0:
            pytest.skip("No sauna orders available for testing")
        
        order = orders[0]
        order_id = order["id"]
        original_created_by = order.get("createdBy", "")
        
        # Get a different user to assign
        users_response = self.session.get(f"{BASE_URL}/api/users")
        users = users_response.json()
        admin_employees = [u for u in users if u.get("role") in ["admin", "employee"]]
        
        if len(admin_employees) < 2:
            pytest.skip("Need at least 2 users for assignment testing")
        
        # Pick a different user
        new_user = next((u for u in admin_employees if u["username"] != original_created_by), admin_employees[0])
        
        # Assign the order
        response = self.session.patch(
            f"{BASE_URL}/api/sauna/orders/{order_id}/assign",
            json={"createdBy": new_user["username"], "assignedBy": "admin"}
        )
        
        assert response.status_code == 200
        updated_order = response.json()
        
        # Verify createdBy was updated
        assert updated_order["createdBy"] == new_user["username"]
        
        # Verify changeHistory was updated
        change_history = updated_order.get("changeHistory", [])
        assert len(change_history) > 0
        
        last_change = change_history[-1]
        assert last_change.get("changedBy") == "admin"
        assert any(c.get("field") == "createdBy" for c in last_change.get("changes", []))
        
        print(f"SUCCESS: Sauna order {order_id} reassigned to {new_user['username']}")
    
    def test_sauna_order_assign_missing_created_by(self):
        """Test PATCH /api/sauna/orders/{id}/assign with missing createdBy returns 400"""
        # Get an order ID
        orders_response = self.session.get(f"{BASE_URL}/api/sauna/orders")
        orders = orders_response.json()
        
        if len(orders) == 0:
            pytest.skip("No sauna orders available for testing")
        
        order_id = orders[0]["id"]
        
        response = self.session.patch(
            f"{BASE_URL}/api/sauna/orders/{order_id}/assign",
            json={"assignedBy": "admin"}  # Missing createdBy
        )
        
        assert response.status_code == 400
        assert "createdBy is required" in response.json().get("detail", "")
        print("SUCCESS: Missing createdBy returns 400 error")
    
    def test_sauna_order_assign_invalid_order_id(self):
        """Test PATCH /api/sauna/orders/{id}/assign with invalid order ID returns 404"""
        response = self.session.patch(
            f"{BASE_URL}/api/sauna/orders/INVALID-ORDER-12345/assign",
            json={"createdBy": "sauna", "assignedBy": "admin"}
        )
        
        assert response.status_code == 404
        assert "not found" in response.json().get("detail", "").lower()
        print("SUCCESS: Invalid order ID returns 404")
    
    # ============ PATCH /api/orders/{id}/assign tests (Balia) ============
    
    def test_balia_order_assign_success(self):
        """Test successful assignment of balia order to new user"""
        # First get a balia order
        orders_response = self.session.get(f"{BASE_URL}/api/orders")
        assert orders_response.status_code == 200
        orders = orders_response.json()
        
        if len(orders) == 0:
            pytest.skip("No balia orders available for testing")
        
        order = orders[0]
        order_id = order["id"]
        original_created_by = order.get("createdBy", "")
        
        # Get a different user to assign
        users_response = self.session.get(f"{BASE_URL}/api/users")
        users = users_response.json()
        admin_employees = [u for u in users if u.get("role") in ["admin", "employee"]]
        
        if len(admin_employees) < 2:
            pytest.skip("Need at least 2 users for assignment testing")
        
        # Pick a different user
        new_user = next((u for u in admin_employees if u["username"] != original_created_by), admin_employees[0])
        
        # Assign the order
        response = self.session.patch(
            f"{BASE_URL}/api/orders/{order_id}/assign",
            json={"createdBy": new_user["username"], "assignedBy": "admin"}
        )
        
        assert response.status_code == 200
        updated_order = response.json()
        
        # Verify createdBy was updated
        assert updated_order["createdBy"] == new_user["username"]
        
        # Verify changeHistory was updated
        change_history = updated_order.get("changeHistory", [])
        assert len(change_history) > 0
        
        last_change = change_history[-1]
        assert last_change.get("changedBy") == "admin"
        
        print(f"SUCCESS: Balia order {order_id} reassigned to {new_user['username']}")
    
    def test_balia_order_assign_missing_created_by(self):
        """Test PATCH /api/orders/{id}/assign with missing createdBy returns 400"""
        # Get an order ID
        orders_response = self.session.get(f"{BASE_URL}/api/orders")
        orders = orders_response.json()
        
        if len(orders) == 0:
            pytest.skip("No balia orders available for testing")
        
        order_id = orders[0]["id"]
        
        response = self.session.patch(
            f"{BASE_URL}/api/orders/{order_id}/assign",
            json={"assignedBy": "admin"}  # Missing createdBy
        )
        
        assert response.status_code == 400
        assert "createdBy is required" in response.json().get("detail", "")
        print("SUCCESS: Missing createdBy returns 400 error for balia")
    
    def test_balia_order_assign_invalid_order_id(self):
        """Test PATCH /api/orders/{id}/assign with invalid order ID returns 404"""
        response = self.session.patch(
            f"{BASE_URL}/api/orders/INVALID-BALIA-12345/assign",
            json={"createdBy": "balia", "assignedBy": "admin"}
        )
        
        assert response.status_code == 404
        assert "not found" in response.json().get("detail", "").lower()
        print("SUCCESS: Invalid balia order ID returns 404")
    
    # ============ Change History verification tests ============
    
    def test_change_history_tracks_assignment(self):
        """Test that change history properly tracks createdBy field changes"""
        # Get a sauna order
        orders_response = self.session.get(f"{BASE_URL}/api/sauna/orders")
        orders = orders_response.json()
        
        if len(orders) == 0:
            pytest.skip("No sauna orders available for testing")
        
        order = orders[0]
        order_id = order["id"]
        original_created_by = order.get("createdBy", "")
        original_history_length = len(order.get("changeHistory", []))
        
        # Assign to a different user
        response = self.session.patch(
            f"{BASE_URL}/api/sauna/orders/{order_id}/assign",
            json={"createdBy": "admin", "assignedBy": "admin"}
        )
        
        assert response.status_code == 200
        updated_order = response.json()
        
        # Verify history has new entry
        new_history = updated_order.get("changeHistory", [])
        assert len(new_history) > original_history_length
        
        # Verify the change entry structure
        last_entry = new_history[-1]
        assert "timestamp" in last_entry
        assert "changedBy" in last_entry
        assert "changes" in last_entry
        
        # Verify the change has oldValue and newValue
        created_by_change = next((c for c in last_entry["changes"] if c.get("field") == "createdBy"), None)
        assert created_by_change is not None
        assert "oldValue" in created_by_change
        assert "newValue" in created_by_change
        assert created_by_change["newValue"] == "admin"
        
        print(f"SUCCESS: Change history properly tracks assignment from '{created_by_change['oldValue']}' to 'admin'")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
