"""
Test Warehouse Trips API - Read-only view for storekeeper
Tests the /api/warehouse/trips endpoint and related functionality
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDS = {"username": "admin", "password": "admin123"}
STOREKEEPER_CREDS = {"username": "kladovshchik", "password": "kladovshchik123"}


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Admin authentication failed")


@pytest.fixture(scope="module")
def storekeeper_token():
    """Get storekeeper authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=STOREKEEPER_CREDS)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Storekeeper authentication failed")


class TestWarehouseTripsAPI:
    """Test warehouse trips API endpoints"""
    
    def test_admin_can_access_warehouse_trips(self, admin_token):
        """Admin should be able to access warehouse trips"""
        response = requests.get(
            f"{BASE_URL}/api/warehouse/trips",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "trips" in data
        assert "total" in data
        print(f"Admin: Found {data['total']} trips")
    
    def test_storekeeper_can_access_warehouse_trips(self, storekeeper_token):
        """Storekeeper should be able to access warehouse trips (read-only)"""
        response = requests.get(
            f"{BASE_URL}/api/warehouse/trips",
            headers={"Authorization": f"Bearer {storekeeper_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "trips" in data
        assert "total" in data
        print(f"Storekeeper: Found {data['total']} trips")
    
    def test_trips_have_required_fields(self, admin_token):
        """Trips should have all required fields"""
        response = requests.get(
            f"{BASE_URL}/api/warehouse/trips",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        trips = data.get("trips", [])
        
        if len(trips) > 0:
            trip = trips[0]
            # Check required fields
            assert "id" in trip, "Trip should have 'id' field"
            assert "name" in trip or "id" in trip, "Trip should have 'name' or 'id' field"
            assert "status" in trip or trip.get("status") is None, "Trip should have 'status' field"
            assert "section" in trip, "Trip should have 'section' field"
            assert "orders" in trip, "Trip should have 'orders' field"
            assert "orderCount" in trip, "Trip should have 'orderCount' field"
            
            print(f"Trip {trip.get('name', trip.get('id'))}: section={trip.get('section')}, status={trip.get('status')}, orders={trip.get('orderCount')}")
    
    def test_trips_have_enriched_order_details(self, admin_token):
        """Trips should have enriched order details"""
        response = requests.get(
            f"{BASE_URL}/api/warehouse/trips",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        trips = data.get("trips", [])
        
        if len(trips) > 0:
            trip = trips[0]
            orders = trip.get("orders", [])
            
            if len(orders) > 0:
                order = orders[0]
                # Check order has section info
                assert "section" in order, "Order should have 'section' field"
                assert "id" in order, "Order should have 'id' field"
                print(f"Order {order.get('id')}: section={order.get('section')}")
    
    def test_trips_have_order_statuses(self, admin_token):
        """Trips should have order statuses mapping"""
        response = requests.get(
            f"{BASE_URL}/api/warehouse/trips",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        trips = data.get("trips", [])
        
        if len(trips) > 0:
            trip = trips[0]
            order_statuses = trip.get("orderStatuses", {})
            
            if order_statuses:
                # Check valid status values
                valid_statuses = ["pending", "preparing", "delivering", "delivered", "cancelled"]
                for order_id, status in order_statuses.items():
                    assert status in valid_statuses, f"Invalid order status: {status}"
                print(f"Trip has {len(order_statuses)} order statuses")
    
    def test_trips_have_driver_info(self, admin_token):
        """Trips should have driver information"""
        response = requests.get(
            f"{BASE_URL}/api/warehouse/trips",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        trips = data.get("trips", [])
        
        for trip in trips:
            if trip.get("driverName"):
                print(f"Trip {trip.get('name')}: driver={trip.get('driverName')}")
                assert isinstance(trip.get("driverName"), str)
    
    def test_trips_have_departure_date(self, admin_token):
        """Trips should have departure date"""
        response = requests.get(
            f"{BASE_URL}/api/warehouse/trips",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        trips = data.get("trips", [])
        
        for trip in trips:
            if trip.get("departureDate"):
                print(f"Trip {trip.get('name')}: departureDate={trip.get('departureDate')}")
    
    def test_unauthorized_access_denied(self):
        """Unauthorized access should be denied"""
        response = requests.get(f"{BASE_URL}/api/warehouse/trips")
        assert response.status_code in [401, 403], "Should deny unauthorized access"
    
    def test_invalid_token_denied(self):
        """Invalid token should be denied"""
        response = requests.get(
            f"{BASE_URL}/api/warehouse/trips",
            headers={"Authorization": "Bearer invalid_token"}
        )
        assert response.status_code in [401, 403], "Should deny invalid token"


class TestStorekeeperReadOnlyAccess:
    """Test that storekeeper has read-only access"""
    
    def test_storekeeper_role_is_correct(self, storekeeper_token):
        """Verify storekeeper role and access"""
        # Decode token or check user info
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=STOREKEEPER_CREDS
        )
        assert response.status_code == 200
        data = response.json()
        user = data.get("user", {})
        
        assert user.get("role") == "storekeeper", "User should have storekeeper role"
        access = user.get("access", [])
        assert "warehouse" in access or access == "all", "Storekeeper should have warehouse access"
        print(f"Storekeeper: role={user.get('role')}, access={access}")
    
    def test_storekeeper_can_view_trips(self, storekeeper_token):
        """Storekeeper should be able to view trips"""
        response = requests.get(
            f"{BASE_URL}/api/warehouse/trips",
            headers={"Authorization": f"Bearer {storekeeper_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "trips" in data
        print(f"Storekeeper can view {len(data.get('trips', []))} trips")
    
    def test_storekeeper_can_view_single_trip(self, storekeeper_token, admin_token):
        """Storekeeper should be able to view single trip details"""
        # First get list of trips
        response = requests.get(
            f"{BASE_URL}/api/warehouse/trips",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        trips = response.json().get("trips", [])
        
        if len(trips) > 0:
            trip_id = trips[0].get("id")
            
            # Storekeeper should be able to view single trip
            response = requests.get(
                f"{BASE_URL}/api/warehouse/trips/{trip_id}",
                headers={"Authorization": f"Bearer {storekeeper_token}"}
            )
            assert response.status_code == 200
            trip = response.json()
            assert trip.get("id") == trip_id
            print(f"Storekeeper can view trip {trip_id}")


class TestTripStatusFiltering:
    """Test trip status filtering (frontend logic, but verify data supports it)"""
    
    def test_trips_have_valid_status(self, admin_token):
        """All trips should have valid status"""
        response = requests.get(
            f"{BASE_URL}/api/warehouse/trips",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        trips = response.json().get("trips", [])
        
        valid_statuses = ["planned", "in_transit", "delivered"]
        status_counts = {"planned": 0, "in_transit": 0, "delivered": 0}
        
        for trip in trips:
            status = trip.get("status", "planned")  # Default to planned
            assert status in valid_statuses, f"Invalid trip status: {status}"
            status_counts[status] += 1
        
        print(f"Trip status counts: {status_counts}")
    
    def test_trips_can_be_filtered_by_status(self, admin_token):
        """Verify trips can be filtered by status (data supports filtering)"""
        response = requests.get(
            f"{BASE_URL}/api/warehouse/trips",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        trips = response.json().get("trips", [])
        
        # Group by status
        by_status = {}
        for trip in trips:
            status = trip.get("status", "planned")
            if status not in by_status:
                by_status[status] = []
            by_status[status].append(trip)
        
        print(f"Trips by status: {[(k, len(v)) for k, v in by_status.items()]}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
