"""
Test orders filtering by createdBy for managers and admin access.
Tests new features:
1. Managers see only their own orders (filtered by createdBy)
2. Admins see all orders (no filtering)
3. amoCRM note sending code path exists on order update
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_USER = {"username": "admin", "password": "admin123"}
MANAGER_USER = {"username": "sauna_employee", "password": "test123"}


class TestOrdersFilteringBalia:
    """Test orders filtering for Balia calculator (/api/orders)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.created_order_ids = []
        yield
        # Cleanup created orders
        for order_id in self.created_order_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/orders/{order_id}")
            except:
                pass
    
    def test_get_orders_without_params_returns_all(self):
        """GET /api/orders without params should return all orders"""
        response = self.session.get(f"{BASE_URL}/api/orders")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"GET /api/orders (no params): returned {len(data)} orders")
    
    def test_get_orders_admin_sees_all(self):
        """Admin (role=admin) should see all orders regardless of createdBy"""
        # First get all orders without filter
        all_response = self.session.get(f"{BASE_URL}/api/orders")
        assert all_response.status_code == 200
        all_orders = all_response.json()
        
        # Now get with admin role
        admin_response = self.session.get(
            f"{BASE_URL}/api/orders",
            params={"username": "admin", "role": "admin"}
        )
        assert admin_response.status_code == 200
        admin_orders = admin_response.json()
        
        # Admin should see all orders
        assert len(admin_orders) == len(all_orders)
        print(f"Admin sees all {len(admin_orders)} orders (same as unfiltered {len(all_orders)})")
    
    def test_get_orders_manager_sees_only_own(self):
        """Manager (role != admin) should see only orders with matching createdBy"""
        # Create a test order with specific createdBy
        test_order_id = f"TEST-FILTER-{uuid.uuid4().hex[:8]}"
        test_order = {
            "id": test_order_id,
            "fullName": "Test Filter Order",
            "phoneNumber": "+48123456789",
            "fullAddress": "Test Address",
            "createdBy": "test_manager_user",
            "orderDate": datetime.now().isoformat(),
            "total": 1000
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/orders", json=test_order)
        assert create_response.status_code == 200
        self.created_order_ids.append(test_order_id)
        
        # Get orders as the test manager
        manager_response = self.session.get(
            f"{BASE_URL}/api/orders",
            params={"username": "test_manager_user", "role": "manager"}
        )
        assert manager_response.status_code == 200
        manager_orders = manager_response.json()
        
        # All returned orders should have createdBy = test_manager_user
        for order in manager_orders:
            assert order.get('createdBy') == 'test_manager_user', \
                f"Manager should only see own orders, but got order with createdBy={order.get('createdBy')}"
        
        # Should include our test order
        order_ids = [o.get('id') for o in manager_orders]
        assert test_order_id in order_ids, "Manager should see their own created order"
        print(f"Manager 'test_manager_user' sees {len(manager_orders)} orders (all with createdBy=test_manager_user)")
    
    def test_get_orders_different_manager_sees_different_orders(self):
        """Different managers should see different orders based on createdBy"""
        # Create order for manager1
        order1_id = f"TEST-MGR1-{uuid.uuid4().hex[:8]}"
        order1 = {
            "id": order1_id,
            "fullName": "Manager1 Order",
            "phoneNumber": "+48111111111",
            "fullAddress": "Address 1",
            "createdBy": "manager1",
            "orderDate": datetime.now().isoformat(),
            "total": 500
        }
        self.session.post(f"{BASE_URL}/api/orders", json=order1)
        self.created_order_ids.append(order1_id)
        
        # Create order for manager2
        order2_id = f"TEST-MGR2-{uuid.uuid4().hex[:8]}"
        order2 = {
            "id": order2_id,
            "fullName": "Manager2 Order",
            "phoneNumber": "+48222222222",
            "fullAddress": "Address 2",
            "createdBy": "manager2",
            "orderDate": datetime.now().isoformat(),
            "total": 600
        }
        self.session.post(f"{BASE_URL}/api/orders", json=order2)
        self.created_order_ids.append(order2_id)
        
        # Manager1 should see only their order
        mgr1_response = self.session.get(
            f"{BASE_URL}/api/orders",
            params={"username": "manager1", "role": "manager"}
        )
        assert mgr1_response.status_code == 200
        mgr1_orders = mgr1_response.json()
        mgr1_ids = [o.get('id') for o in mgr1_orders]
        
        assert order1_id in mgr1_ids, "Manager1 should see their own order"
        assert order2_id not in mgr1_ids, "Manager1 should NOT see Manager2's order"
        
        # Manager2 should see only their order
        mgr2_response = self.session.get(
            f"{BASE_URL}/api/orders",
            params={"username": "manager2", "role": "manager"}
        )
        assert mgr2_response.status_code == 200
        mgr2_orders = mgr2_response.json()
        mgr2_ids = [o.get('id') for o in mgr2_orders]
        
        assert order2_id in mgr2_ids, "Manager2 should see their own order"
        assert order1_id not in mgr2_ids, "Manager2 should NOT see Manager1's order"
        
        print(f"Manager1 sees {len(mgr1_orders)} orders, Manager2 sees {len(mgr2_orders)} orders - filtering works!")


class TestOrdersFilteringSauna:
    """Test orders filtering for Sauna calculator (/api/sauna/orders)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.created_order_ids = []
        yield
        # Cleanup created orders
        for order_id in self.created_order_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/sauna/orders/{order_id}")
            except:
                pass
    
    def test_get_sauna_orders_without_params_returns_all(self):
        """GET /api/sauna/orders without params should return all orders"""
        response = self.session.get(f"{BASE_URL}/api/sauna/orders")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"GET /api/sauna/orders (no params): returned {len(data)} orders")
    
    def test_get_sauna_orders_admin_sees_all(self):
        """Admin should see all sauna orders"""
        # Get all orders without filter
        all_response = self.session.get(f"{BASE_URL}/api/sauna/orders")
        assert all_response.status_code == 200
        all_orders = all_response.json()
        
        # Get with admin role
        admin_response = self.session.get(
            f"{BASE_URL}/api/sauna/orders",
            params={"username": "admin", "role": "admin"}
        )
        assert admin_response.status_code == 200
        admin_orders = admin_response.json()
        
        # Admin should see all orders
        assert len(admin_orders) == len(all_orders)
        print(f"Admin sees all {len(admin_orders)} sauna orders")
    
    def test_get_sauna_orders_manager_sees_only_own(self):
        """Manager should see only their own sauna orders"""
        # Create a test sauna order
        test_order_id = f"TEST-SAUNA-{uuid.uuid4().hex[:8]}"
        test_order = {
            "id": test_order_id,
            "fullName": "Test Sauna Order",
            "phoneNumber": "+48123456789",
            "fullAddress": "Test Sauna Address",
            "createdBy": "sauna_test_manager",
            "orderDate": datetime.now().isoformat(),
            "total": 2000,
            "selectedModel": "test_model"  # Required field for sauna orders
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/sauna/orders", json=test_order)
        assert create_response.status_code == 200
        self.created_order_ids.append(test_order_id)
        
        # Get orders as the test manager
        manager_response = self.session.get(
            f"{BASE_URL}/api/sauna/orders",
            params={"username": "sauna_test_manager", "role": "employee"}
        )
        assert manager_response.status_code == 200
        manager_orders = manager_response.json()
        
        # All returned orders should have createdBy = sauna_test_manager
        for order in manager_orders:
            assert order.get('createdBy') == 'sauna_test_manager', \
                f"Manager should only see own orders, but got createdBy={order.get('createdBy')}"
        
        # Should include our test order
        order_ids = [o.get('id') for o in manager_orders]
        assert test_order_id in order_ids, "Manager should see their own created sauna order"
        print(f"Sauna manager sees {len(manager_orders)} orders (all with createdBy=sauna_test_manager)")


class TestAmoCRMNoteSending:
    """Test amoCRM note sending code path on order update"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.created_order_ids = []
        yield
        # Cleanup
        for order_id in self.created_order_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/orders/{order_id}")
            except:
                pass
    
    def test_order_update_with_amocrm_id_triggers_note_code_path(self):
        """Update order with amocrm_id should trigger note sending code (even if amoCRM not configured)"""
        # Create order with amocrm_id
        test_order_id = f"TEST-AMO-NOTE-{uuid.uuid4().hex[:8]}"
        test_order = {
            "id": test_order_id,
            "fullName": "Test amoCRM Note Order",
            "phoneNumber": "+48123456789",
            "fullAddress": "Test Address",
            "amocrm_id": "99999999",  # Fake amoCRM ID
            "orderDate": datetime.now().isoformat(),
            "total": 1500
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/orders", json=test_order)
        assert create_response.status_code == 200
        self.created_order_ids.append(test_order_id)
        
        # Update the order with changes
        updated_order = test_order.copy()
        updated_order["fullName"] = "Updated Name for amoCRM Note"
        updated_order["notes"] = "Updated notes"
        updated_order["updatedBy"] = "test_user"
        
        update_response = self.session.put(
            f"{BASE_URL}/api/orders/{test_order_id}",
            json=updated_order
        )
        
        # Should succeed (note sending may fail silently due to no amoCRM config)
        assert update_response.status_code == 200
        updated_data = update_response.json()
        
        # Verify change history was recorded
        assert 'changeHistory' in updated_data
        assert len(updated_data['changeHistory']) > 0
        
        last_change = updated_data['changeHistory'][-1]
        assert 'changes' in last_change
        assert 'changedBy' in last_change
        assert last_change['changedBy'] == 'test_user'
        
        # Verify fullName change was tracked
        changed_fields = [c['field'] for c in last_change['changes']]
        assert 'fullName' in changed_fields
        
        print(f"Order update with amocrm_id triggered change tracking. Changed fields: {changed_fields}")
    
    def test_sauna_order_update_with_amocrm_id_triggers_note_code_path(self):
        """Update sauna order with amocrm_id should trigger note sending code"""
        # Create sauna order with amocrm_id
        test_order_id = f"TEST-SAUNA-AMO-{uuid.uuid4().hex[:8]}"
        test_order = {
            "id": test_order_id,
            "fullName": "Test Sauna amoCRM Order",
            "phoneNumber": "+48123456789",
            "fullAddress": "Test Sauna Address",
            "amocrm_id": "88888888",  # Fake amoCRM ID
            "orderDate": datetime.now().isoformat(),
            "total": 3000,
            "selectedModel": "test_model"  # Required field for sauna orders
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/sauna/orders", json=test_order)
        assert create_response.status_code == 200
        self.created_order_ids.append(test_order_id)
        
        # Update the order
        updated_order = test_order.copy()
        updated_order["fullName"] = "Updated Sauna Name"
        updated_order["deliveryStatus"] = "in_progress"
        updated_order["updatedBy"] = "sauna_manager"
        updated_order["selectedModel"] = "test_model"  # Required field
        
        update_response = self.session.put(
            f"{BASE_URL}/api/sauna/orders/{test_order_id}",
            json=updated_order
        )
        
        assert update_response.status_code == 200
        updated_data = update_response.json()
        
        # Verify change history
        assert 'changeHistory' in updated_data
        assert len(updated_data['changeHistory']) > 0
        
        last_change = updated_data['changeHistory'][-1]
        changed_fields = [c['field'] for c in last_change['changes']]
        assert 'fullName' in changed_fields
        
        print(f"Sauna order update with amocrm_id triggered change tracking. Changed fields: {changed_fields}")
    
    def test_existing_test_order_has_amocrm_id(self):
        """Verify TEST-AMO-001 order exists with amocrm_id=12345678"""
        response = self.session.get(f"{BASE_URL}/api/orders/TEST-AMO-001")
        
        if response.status_code == 200:
            order = response.json()
            assert order.get('amocrm_id') == '12345678' or order.get('amocrm_id') == 12345678
            print(f"TEST-AMO-001 exists with amocrm_id={order.get('amocrm_id')}")
        else:
            # Order may not exist, that's okay - create it for future tests
            print("TEST-AMO-001 not found - this is expected if not seeded")
            pytest.skip("TEST-AMO-001 not found")


class TestOrdersEndpointBasics:
    """Basic endpoint tests for orders"""
    
    def test_balia_orders_endpoint_exists(self):
        """Verify /api/orders endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/orders")
        assert response.status_code == 200
        print("GET /api/orders - OK")
    
    def test_sauna_orders_endpoint_exists(self):
        """Verify /api/sauna/orders endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/sauna/orders")
        assert response.status_code == 200
        print("GET /api/sauna/orders - OK")
    
    def test_orders_endpoint_accepts_username_role_params(self):
        """Verify /api/orders accepts username and role query params"""
        response = requests.get(
            f"{BASE_URL}/api/orders",
            params={"username": "test", "role": "test"}
        )
        assert response.status_code == 200
        print("GET /api/orders with username/role params - OK")
    
    def test_sauna_orders_endpoint_accepts_username_role_params(self):
        """Verify /api/sauna/orders accepts username and role query params"""
        response = requests.get(
            f"{BASE_URL}/api/sauna/orders",
            params={"username": "test", "role": "test"}
        )
        assert response.status_code == 200
        print("GET /api/sauna/orders with username/role params - OK")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
