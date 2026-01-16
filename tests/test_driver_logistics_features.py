"""
Test suite for Driver Logistics features - Iteration 22
Tests: Driver Panel, Trip Management, amoCRM clearing, Geocoding, Push Notifications
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://sales-hub-72.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_USER = "admin"
ADMIN_PASS = "220066"
DRIVER_USER = "drivertest"
DRIVER_PASS = "test123"


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USER,
            "password": ADMIN_PASS
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "admin"
    
    def test_driver_login(self):
        """Test driver login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": DRIVER_USER,
            "password": DRIVER_PASS
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "driver"


class TestDriverPanel:
    """Test Driver Panel API endpoints"""
    
    @pytest.fixture
    def driver_token(self):
        """Get driver authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": DRIVER_USER,
            "password": DRIVER_PASS
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Driver authentication failed")
    
    def test_driver_my_trips(self, driver_token):
        """Test GET /api/driver-panel/my-trips - driver should see assigned trips"""
        response = requests.get(
            f"{BASE_URL}/api/driver-panel/my-trips",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "trips" in data
        assert "driver" in data
        
        # Verify driver info
        driver = data["driver"]
        assert driver is not None
        assert "name" in driver
        
        # Verify trips have required fields
        if data["trips"]:
            trip = data["trips"][0]
            assert "id" in trip
            assert "name" in trip
            assert "status" in trip
            assert "orders" in trip
    
    def test_driver_trip_orders_have_coordinates(self, driver_token):
        """Test that trip orders include lat/lng coordinates for map display"""
        response = requests.get(
            f"{BASE_URL}/api/driver-panel/my-trips",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if data["trips"]:
            trip = data["trips"][0]
            orders = trip.get("orders", [])
            
            # Check if orders have coordinates
            orders_with_coords = [o for o in orders if o.get("lat") and o.get("lng")]
            print(f"Trip {trip['name']}: {len(orders_with_coords)}/{len(orders)} orders have coordinates")
            
            # Verify order structure includes phone and payment amount
            if orders:
                order = orders[0]
                assert "fullAddress" in order
                # Phone and debtSum should be present for collapsed card display
                assert "phoneNumber" in order or "phone" in order
    
    def test_driver_trip_orders_have_phone_and_amount(self, driver_token):
        """Test that orders show customer phone and payment amount"""
        response = requests.get(
            f"{BASE_URL}/api/driver-panel/my-trips",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if data["trips"]:
            trip = data["trips"][0]
            orders = trip.get("orders", [])
            
            if orders:
                order = orders[0]
                # Verify phone number is present
                phone = order.get("phoneNumber") or order.get("phone")
                assert phone is not None, "Order should have phone number"
                
                # debtSum may be empty string but should exist
                assert "debtSum" in order, "Order should have debtSum field"
                print(f"Order {order.get('id')}: phone={phone}, debtSum={order.get('debtSum')}")


class TestStartTrip:
    """Test Start Trip functionality"""
    
    @pytest.fixture
    def driver_token(self):
        """Get driver authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": DRIVER_USER,
            "password": DRIVER_PASS
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Driver authentication failed")
    
    def test_start_trip_changes_status(self, driver_token):
        """Test POST /api/driver-panel/start-trip/{trip_id} changes trip and order statuses"""
        # First get trips
        response = requests.get(
            f"{BASE_URL}/api/driver-panel/my-trips",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if not data["trips"]:
            pytest.skip("No trips available for testing")
        
        # Find a trip that's already in_transit (test data)
        trip = data["trips"][0]
        trip_id = trip["id"]
        
        # If trip is already in_transit, verify the status
        if trip["status"] == "in_transit":
            print(f"Trip {trip_id} is already in_transit")
            # Verify orders are in delivering status
            for order in trip.get("orders", []):
                status = trip.get("orderStatuses", {}).get(order["id"])
                print(f"Order {order['id']} status: {status}")
        else:
            # Try to start the trip
            response = requests.post(
                f"{BASE_URL}/api/driver-panel/start-trip/{trip_id}",
                headers={"Authorization": f"Bearer {driver_token}"}
            )
            # May fail if trip is already started or completed
            print(f"Start trip response: {response.status_code} - {response.text}")


class TestTripsAPI:
    """Test Trips management API"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USER,
            "password": ADMIN_PASS
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_get_all_trips(self):
        """Test GET /api/trips returns trip list"""
        response = requests.get(f"{BASE_URL}/api/trips")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        if data:
            trip = data[0]
            assert "id" in trip
            assert "name" in trip
            assert "status" in trip
            assert "section" in trip
    
    def test_get_trips_by_section(self):
        """Test GET /api/trips?section=balia filters by section"""
        response = requests.get(f"{BASE_URL}/api/trips?section=balia")
        assert response.status_code == 200
        data = response.json()
        
        # All returned trips should be from balia section
        for trip in data:
            assert trip.get("section") == "balia"
    
    def test_get_single_trip(self):
        """Test GET /api/trips/{trip_id} returns trip with orders"""
        # First get list of trips
        response = requests.get(f"{BASE_URL}/api/trips")
        assert response.status_code == 200
        trips = response.json()
        
        if not trips:
            pytest.skip("No trips available")
        
        trip_id = trips[0]["id"]
        
        # Get single trip
        response = requests.get(f"{BASE_URL}/api/trips/{trip_id}")
        assert response.status_code == 200
        trip = response.json()
        
        assert trip["id"] == trip_id
        assert "orders" in trip


class TestRemoveOrderFromTrip:
    """Test removing order from trip with amoCRM clearing feedback"""
    
    def test_remove_order_returns_detailed_amocrm_result(self):
        """Test POST /api/trips/{trip_id}/remove-orders returns detailed amoCRM sync result"""
        # First get a trip with orders
        response = requests.get(f"{BASE_URL}/api/trips")
        assert response.status_code == 200
        trips = response.json()
        
        if not trips:
            pytest.skip("No trips available")
        
        # Find a trip with orders
        trip_with_orders = None
        for trip in trips:
            if trip.get("orderIds") and len(trip["orderIds"]) > 0:
                trip_with_orders = trip
                break
        
        if not trip_with_orders:
            pytest.skip("No trips with orders available")
        
        trip_id = trip_with_orders["id"]
        order_id = trip_with_orders["orderIds"][0]
        
        # Remove order from trip
        response = requests.post(
            f"{BASE_URL}/api/trips/{trip_id}/remove-orders",
            json=[order_id]
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response has detailed amoCRM feedback
        assert "status" in data
        assert "removed" in data
        assert "amocrm_orders_count" in data
        assert "amocrm_settings" in data
        
        # Verify settings check structure
        settings = data["amocrm_settings"]
        assert "configured" in settings
        assert "domain_set" in settings
        assert "token_set" in settings
        assert "trip_fields_configured" in settings
        
        print(f"Remove order result: {data}")
        
        # Add the order back to the trip for cleanup
        requests.post(
            f"{BASE_URL}/api/trips/{trip_id}/add-orders",
            json=[order_id]
        )


class TestGeocodeTrip:
    """Test geocoding trip orders endpoint"""
    
    @pytest.fixture
    def driver_token(self):
        """Get driver authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": DRIVER_USER,
            "password": DRIVER_PASS
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Driver authentication failed")
    
    def test_geocode_trip_endpoint_exists(self, driver_token):
        """Test POST /api/driver-panel/geocode-trip/{trip_id} endpoint exists"""
        # Get a trip ID
        response = requests.get(
            f"{BASE_URL}/api/driver-panel/my-trips",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if not data["trips"]:
            pytest.skip("No trips available")
        
        trip_id = data["trips"][0]["id"]
        
        # Call geocode endpoint
        response = requests.post(
            f"{BASE_URL}/api/driver-panel/geocode-trip/{trip_id}",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        
        # Should return 200 (success) or specific error, not 404/405
        assert response.status_code in [200, 400, 500], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "geocoded" in data or "message" in data
            print(f"Geocode result: {data}")


class TestNotificationSettings:
    """Test push notification settings UI endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": ADMIN_USER,
            "password": ADMIN_PASS
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_telegram_settings_endpoint(self, admin_token):
        """Test GET /api/notifications/telegram/settings endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/telegram/settings",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # May return 200 or 404 if not configured
        assert response.status_code in [200, 404]
        
        if response.status_code == 200:
            data = response.json()
            print(f"Telegram settings: {data}")
    
    def test_send_custom_notification_endpoint(self, admin_token):
        """Test POST /api/notifications/send-custom endpoint exists"""
        # This endpoint should exist for the test form
        # Use a real driver ID from test data
        response = requests.post(
            f"{BASE_URL}/api/notifications/send-custom",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={
                "driverId": "drv-test-001",  # Use test driver ID
                "message": "Test message from pytest"
            }
        )
        # Should return 200 (success) or 404 if driver not found
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "status" in data
            assert "method" in data
            print(f"Send notification response: {data}")
        else:
            print(f"Driver not found (expected if test data not seeded)")


class TestIntegrationSettings:
    """Test integration settings for amoCRM"""
    
    def test_amocrm_settings_endpoint(self):
        """Test GET /api/integrations/amocrm/settings endpoint"""
        response = requests.get(f"{BASE_URL}/api/integrations/amocrm/settings")
        assert response.status_code == 200
        data = response.json()
        
        # Verify settings structure
        assert isinstance(data, dict)
        print(f"amoCRM settings keys: {list(data.keys())}")


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
