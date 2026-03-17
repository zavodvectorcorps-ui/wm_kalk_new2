"""
Test suite for Add Orders to Existing Trip Feature - Iteration 21
Tests:
1. POST /api/trips/{trip_id}/add-orders - add orders to existing trip
2. Trip data stored in each order (tripId, tripName, tripDriverId, tripDriverName, tripDepartureDate, tripStatus, tripOrderStatus)
3. When trip is updated, all orders get updated trip data
4. Validation: orders already in another trip cannot be added
"""
import pytest
import requests
import os
import time
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://order-tracker-pro-5.preview.emergentagent.com')


class TestAddOrdersToTrip:
    """Test adding orders to existing trips"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.created_trip_ids = []
        self.created_order_ids = []
        yield
        # Cleanup
        for trip_id in self.created_trip_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/trips/{trip_id}")
            except:
                pass
        for order_id in self.created_order_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/greenhouse/orders/{order_id}")
            except:
                pass
    
    def create_test_order(self, suffix=""):
        """Helper to create a test order"""
        order_data = {
            "id": f"TEST-ADD-{int(time.time())}{suffix}",
            "fullName": f"Test Order {suffix}",
            "fullAddress": f"Test Address {suffix}, Warsaw",
            "phoneNumber": "+48 123 456 789",
            "source": "amocrm",
            "amocrm_id": f"AMO-{int(time.time())}{suffix}",
            "status": "new"
        }
        response = self.session.post(f"{BASE_URL}/api/greenhouse/orders", json=order_data)
        assert response.status_code in [200, 201], f"Failed to create order: {response.text}"
        self.created_order_ids.append(order_data["id"])
        return order_data["id"]
    
    def create_test_trip(self, order_ids, name_suffix=""):
        """Helper to create a test trip"""
        trip_data = {
            "name": f"Test Trip {int(time.time())}{name_suffix}",
            "section": "greenhouse",
            "orderIds": order_ids,
            "driverId": "driver1",
            "driverName": "Test Driver"
        }
        response = self.session.post(f"{BASE_URL}/api/trips", json=trip_data)
        assert response.status_code == 200, f"Failed to create trip: {response.text}"
        trip = response.json()
        self.created_trip_ids.append(trip["id"])
        return trip
    
    def test_add_orders_to_trip_endpoint_exists(self):
        """Test POST /api/trips/{trip_id}/add-orders endpoint exists"""
        # Create initial order and trip
        order1_id = self.create_test_order("-1")
        trip = self.create_test_trip([order1_id])
        
        # Create another order to add
        order2_id = self.create_test_order("-2")
        
        # Add order to trip
        response = self.session.post(
            f"{BASE_URL}/api/trips/{trip['id']}/add-orders",
            json=[order2_id]
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        result = response.json()
        assert result.get("status") == "ok"
        assert order2_id in result.get("added", [])
        print(f"✓ POST /api/trips/{trip['id']}/add-orders returns status: ok")
    
    def test_add_multiple_orders_to_trip(self):
        """Test adding multiple orders to a trip at once"""
        # Create initial order and trip
        order1_id = self.create_test_order("-init")
        trip = self.create_test_trip([order1_id])
        
        # Create multiple orders to add
        order2_id = self.create_test_order("-add1")
        order3_id = self.create_test_order("-add2")
        order4_id = self.create_test_order("-add3")
        
        # Add all orders to trip
        response = self.session.post(
            f"{BASE_URL}/api/trips/{trip['id']}/add-orders",
            json=[order2_id, order3_id, order4_id]
        )
        
        assert response.status_code == 200
        result = response.json()
        assert len(result.get("added", [])) == 3
        
        # Verify trip now has all orders
        trip_response = self.session.get(f"{BASE_URL}/api/trips/{trip['id']}")
        updated_trip = trip_response.json()
        assert order1_id in updated_trip.get("orderIds", [])
        assert order2_id in updated_trip.get("orderIds", [])
        assert order3_id in updated_trip.get("orderIds", [])
        assert order4_id in updated_trip.get("orderIds", [])
        print(f"✓ Added 3 orders to trip, total orders: {len(updated_trip.get('orderIds', []))}")
    
    def test_trip_data_stored_in_order_after_add(self):
        """Test that trip data is stored in each order after adding to trip"""
        # Create order and trip
        order1_id = self.create_test_order("-data1")
        trip = self.create_test_trip([order1_id], "-data")
        
        # Update trip with departure date
        self.session.put(
            f"{BASE_URL}/api/trips/{trip['id']}",
            json={"departureDate": "2025-01-20"}
        )
        
        # Create another order and add to trip
        order2_id = self.create_test_order("-data2")
        self.session.post(
            f"{BASE_URL}/api/trips/{trip['id']}/add-orders",
            json=[order2_id]
        )
        
        # Verify order has trip data
        order_response = self.session.get(f"{BASE_URL}/api/greenhouse/orders/{order2_id}")
        assert order_response.status_code == 200
        order = order_response.json()
        
        # Check all trip fields are stored in order
        assert order.get("tripId") == trip["id"], f"Expected tripId={trip['id']}, got {order.get('tripId')}"
        assert order.get("tripName") == trip["name"], f"Expected tripName={trip['name']}, got {order.get('tripName')}"
        assert order.get("tripDriverId") == "driver1", f"Expected tripDriverId=driver1, got {order.get('tripDriverId')}"
        assert order.get("tripDriverName") == "Test Driver", f"Expected tripDriverName=Test Driver, got {order.get('tripDriverName')}"
        assert order.get("tripStatus") == "planned", f"Expected tripStatus=planned, got {order.get('tripStatus')}"
        assert order.get("tripOrderStatus") == "pending", f"Expected tripOrderStatus=pending, got {order.get('tripOrderStatus')}"
        
        print(f"✓ Order {order2_id} has all trip data fields:")
        print(f"  - tripId: {order.get('tripId')}")
        print(f"  - tripName: {order.get('tripName')}")
        print(f"  - tripDriverId: {order.get('tripDriverId')}")
        print(f"  - tripDriverName: {order.get('tripDriverName')}")
        print(f"  - tripDepartureDate: {order.get('tripDepartureDate')}")
        print(f"  - tripStatus: {order.get('tripStatus')}")
        print(f"  - tripOrderStatus: {order.get('tripOrderStatus')}")
    
    def test_trip_update_syncs_to_all_orders(self):
        """Test that when trip is updated, all orders get updated trip data"""
        # Create orders and trip
        order1_id = self.create_test_order("-sync1")
        order2_id = self.create_test_order("-sync2")
        trip = self.create_test_trip([order1_id], "-sync")
        
        # Add second order
        self.session.post(
            f"{BASE_URL}/api/trips/{trip['id']}/add-orders",
            json=[order2_id]
        )
        
        # Update trip status and departure date
        update_response = self.session.put(
            f"{BASE_URL}/api/trips/{trip['id']}",
            json={
                "status": "in_transit",
                "departureDate": "2025-01-25",
                "driverName": "Updated Driver",
                "syncOrderStatuses": True
            }
        )
        assert update_response.status_code == 200
        
        # Verify both orders have updated trip data
        for order_id in [order1_id, order2_id]:
            order_response = self.session.get(f"{BASE_URL}/api/greenhouse/orders/{order_id}")
            order = order_response.json()
            
            assert order.get("tripStatus") == "in_transit", f"Order {order_id} tripStatus should be in_transit"
            assert order.get("tripDepartureDate") == "2025-01-25", f"Order {order_id} tripDepartureDate should be 2025-01-25"
            assert order.get("tripDriverName") == "Updated Driver", f"Order {order_id} tripDriverName should be Updated Driver"
            assert order.get("tripOrderStatus") == "delivering", f"Order {order_id} tripOrderStatus should be delivering"
        
        print(f"✓ Trip update synced to all {2} orders")
    
    def test_cannot_add_order_already_in_another_trip(self):
        """Test that orders already in another trip cannot be added"""
        # Create order and first trip
        order_id = self.create_test_order("-conflict")
        trip1 = self.create_test_trip([order_id], "-trip1")
        
        # Wait to ensure different trip ID (timestamp-based)
        time.sleep(1.5)
        
        # Create second trip
        order2_id = self.create_test_order("-trip2init")
        trip2 = self.create_test_trip([order2_id], "-trip2")
        
        # Try to add order from trip1 to trip2
        response = self.session.post(
            f"{BASE_URL}/api/trips/{trip2['id']}/add-orders",
            json=[order_id]
        )
        
        # Should fail with 400
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        error = response.json()
        assert "already in trip" in error.get("detail", "").lower() or "already" in error.get("detail", "").lower()
        print(f"✓ Cannot add order already in another trip: {error.get('detail')}")
    
    def test_add_orders_to_nonexistent_trip(self):
        """Test adding orders to a trip that doesn't exist"""
        order_id = self.create_test_order("-notrip")
        
        response = self.session.post(
            f"{BASE_URL}/api/trips/NONEXISTENT-TRIP/add-orders",
            json=[order_id]
        )
        
        assert response.status_code == 404
        print(f"✓ Adding to nonexistent trip returns 404")
    
    def test_order_statuses_initialized_as_pending(self):
        """Test that newly added orders get 'pending' status in trip"""
        # Create order and trip
        order1_id = self.create_test_order("-status1")
        trip = self.create_test_trip([order1_id], "-status")
        
        # Add another order
        order2_id = self.create_test_order("-status2")
        self.session.post(
            f"{BASE_URL}/api/trips/{trip['id']}/add-orders",
            json=[order2_id]
        )
        
        # Verify order status in trip
        trip_response = self.session.get(f"{BASE_URL}/api/trips/{trip['id']}")
        updated_trip = trip_response.json()
        
        assert updated_trip.get("orderStatuses", {}).get(order2_id) == "pending"
        print(f"✓ Newly added order has 'pending' status in trip")


class TestTripDataInOrders:
    """Test trip data fields stored in orders"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.created_trip_ids = []
        self.created_order_ids = []
        yield
        # Cleanup
        for trip_id in self.created_trip_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/trips/{trip_id}")
            except:
                pass
        for order_id in self.created_order_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/greenhouse/orders/{order_id}")
            except:
                pass
    
    def create_test_order(self, suffix=""):
        """Helper to create a test order"""
        order_data = {
            "id": f"TEST-TRIPDATA-{int(time.time())}{suffix}",
            "fullName": f"Test Order {suffix}",
            "fullAddress": f"Test Address {suffix}, Warsaw",
            "phoneNumber": "+48 123 456 789",
            "source": "amocrm",
            "amocrm_id": f"AMO-{int(time.time())}{suffix}",
            "status": "new"
        }
        response = self.session.post(f"{BASE_URL}/api/greenhouse/orders", json=order_data)
        assert response.status_code in [200, 201]
        self.created_order_ids.append(order_data["id"])
        return order_data["id"]
    
    def test_order_has_all_trip_fields_after_trip_creation(self):
        """Test that order has all trip fields after being added to a trip"""
        order_id = self.create_test_order("-fields")
        
        # Create trip with the order
        trip_data = {
            "name": "Trip With All Fields",
            "section": "greenhouse",
            "orderIds": [order_id],
            "driverId": "driver123",
            "driverName": "John Driver"
        }
        response = self.session.post(f"{BASE_URL}/api/trips", json=trip_data)
        assert response.status_code == 200
        trip = response.json()
        self.created_trip_ids.append(trip["id"])
        
        # Get order and verify all trip fields
        order_response = self.session.get(f"{BASE_URL}/api/greenhouse/orders/{order_id}")
        order = order_response.json()
        
        # All required fields for amoCRM sync
        required_fields = ["tripId", "tripName", "tripDriverId", "tripDriverName", "tripDepartureDate", "tripStatus", "tripOrderStatus"]
        for field in required_fields:
            assert field in order, f"Order missing field: {field}"
        
        assert order["tripId"] == trip["id"]
        assert order["tripName"] == "Trip With All Fields"
        assert order["tripDriverId"] == "driver123"
        assert order["tripDriverName"] == "John Driver"
        assert order["tripStatus"] == "planned"
        assert order["tripOrderStatus"] == "pending"
        
        print(f"✓ Order has all required trip fields for amoCRM sync")
    
    def test_trip_data_cleared_when_order_removed_from_trip(self):
        """Test that trip data is cleared when order is removed from trip"""
        order_id = self.create_test_order("-remove")
        
        # Create trip
        trip_data = {
            "name": "Trip To Remove From",
            "section": "greenhouse",
            "orderIds": [order_id],
            "driverId": "driver1",
            "driverName": "Driver Name"
        }
        response = self.session.post(f"{BASE_URL}/api/trips", json=trip_data)
        trip = response.json()
        self.created_trip_ids.append(trip["id"])
        
        # Verify order has trip data
        order_response = self.session.get(f"{BASE_URL}/api/greenhouse/orders/{order_id}")
        order = order_response.json()
        assert order.get("tripId") == trip["id"]
        
        # Remove order from trip
        remove_response = self.session.post(
            f"{BASE_URL}/api/trips/{trip['id']}/remove-orders",
            json=[order_id]
        )
        assert remove_response.status_code == 200
        
        # Verify trip data is cleared
        order_response = self.session.get(f"{BASE_URL}/api/greenhouse/orders/{order_id}")
        order = order_response.json()
        
        # Trip fields should be unset/empty
        assert not order.get("tripId"), f"tripId should be cleared, got: {order.get('tripId')}"
        assert not order.get("tripName"), f"tripName should be cleared, got: {order.get('tripName')}"
        
        print(f"✓ Trip data cleared when order removed from trip")


class TestTripsWithPlannedAndInTransitStatus:
    """Test that only planned and in_transit trips are available for adding orders"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.created_trip_ids = []
        self.created_order_ids = []
        yield
        # Cleanup
        for trip_id in self.created_trip_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/trips/{trip_id}")
            except:
                pass
        for order_id in self.created_order_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/greenhouse/orders/{order_id}")
            except:
                pass
    
    def create_test_order(self, suffix=""):
        """Helper to create a test order"""
        order_data = {
            "id": f"TEST-STATUS-{int(time.time())}{suffix}",
            "fullName": f"Test Order {suffix}",
            "fullAddress": f"Test Address {suffix}, Warsaw",
            "phoneNumber": "+48 123 456 789",
            "source": "amocrm",
            "amocrm_id": f"AMO-{int(time.time())}{suffix}",
            "status": "new"
        }
        response = self.session.post(f"{BASE_URL}/api/greenhouse/orders", json=order_data)
        self.created_order_ids.append(order_data["id"])
        return order_data["id"]
    
    def test_get_trips_returns_all_statuses(self):
        """Test GET /api/trips returns trips with all statuses"""
        # Create trips with different statuses
        order1_id = self.create_test_order("-planned")
        
        # Create planned trip
        trip1_data = {"name": "Planned Trip", "section": "greenhouse", "orderIds": [order1_id]}
        trip1 = self.session.post(f"{BASE_URL}/api/trips", json=trip1_data).json()
        self.created_trip_ids.append(trip1["id"])
        
        # Wait to ensure different trip ID
        time.sleep(1.5)
        
        # Create in_transit trip
        order2_id = self.create_test_order("-transit")
        trip2_data = {"name": "In Transit Trip", "section": "greenhouse", "orderIds": [order2_id]}
        trip2 = self.session.post(f"{BASE_URL}/api/trips", json=trip2_data).json()
        self.created_trip_ids.append(trip2["id"])
        update_resp = self.session.put(f"{BASE_URL}/api/trips/{trip2['id']}", json={"status": "in_transit"})
        assert update_resp.status_code == 200, f"Failed to update trip status: {update_resp.text}"
        
        # Wait to ensure different trip ID
        time.sleep(1.5)
        
        # Create completed trip
        order3_id = self.create_test_order("-completed")
        trip3_data = {"name": "Completed Trip", "section": "greenhouse", "orderIds": [order3_id]}
        trip3 = self.session.post(f"{BASE_URL}/api/trips", json=trip3_data).json()
        self.created_trip_ids.append(trip3["id"])
        self.session.put(f"{BASE_URL}/api/trips/{trip3['id']}", json={"status": "completed"})
        
        # Get all trips
        response = self.session.get(f"{BASE_URL}/api/trips?section=greenhouse")
        trips = response.json()
        
        # Find our test trips
        test_trips = [t for t in trips if t["id"] in self.created_trip_ids]
        statuses = [t["status"] for t in test_trips]
        
        assert "planned" in statuses
        assert "in_transit" in statuses
        assert "completed" in statuses
        
        print(f"✓ GET /api/trips returns trips with all statuses: {statuses}")
    
    def test_can_add_orders_to_planned_trip(self):
        """Test that orders can be added to a planned trip"""
        order1_id = self.create_test_order("-p1")
        order2_id = self.create_test_order("-p2")
        
        # Create planned trip
        trip_data = {"name": "Planned Trip", "section": "greenhouse", "orderIds": [order1_id]}
        trip = self.session.post(f"{BASE_URL}/api/trips", json=trip_data).json()
        self.created_trip_ids.append(trip["id"])
        
        # Add order to planned trip
        response = self.session.post(
            f"{BASE_URL}/api/trips/{trip['id']}/add-orders",
            json=[order2_id]
        )
        
        assert response.status_code == 200
        print(f"✓ Can add orders to planned trip")
    
    def test_can_add_orders_to_in_transit_trip(self):
        """Test that orders can be added to an in_transit trip"""
        order1_id = self.create_test_order("-t1")
        order2_id = self.create_test_order("-t2")
        
        # Create and update to in_transit
        trip_data = {"name": "In Transit Trip", "section": "greenhouse", "orderIds": [order1_id]}
        trip = self.session.post(f"{BASE_URL}/api/trips", json=trip_data).json()
        self.created_trip_ids.append(trip["id"])
        self.session.put(f"{BASE_URL}/api/trips/{trip['id']}", json={"status": "in_transit"})
        
        # Add order to in_transit trip
        response = self.session.post(
            f"{BASE_URL}/api/trips/{trip['id']}/add-orders",
            json=[order2_id]
        )
        
        assert response.status_code == 200
        print(f"✓ Can add orders to in_transit trip")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
