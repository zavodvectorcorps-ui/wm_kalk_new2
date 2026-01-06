"""
Test suite for Logistics Module Enhancements - Iteration 20
Tests:
1. Trip departure date field in PUT /api/trips/{trip_id}
2. Trip status change syncing all order statuses
3. Backend POST /api/integrations/amocrm/sync-trip endpoint
4. IntegrationsPage settings for trip sync fields
"""
import pytest
import requests
import os
import time
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://logisync-21.preview.emergentagent.com')


class TestTripsAPI:
    """Test trips API endpoints for logistics enhancements"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.created_trip_id = None
        self.created_order_ids = []
        yield
        # Cleanup
        if self.created_trip_id:
            try:
                self.session.delete(f"{BASE_URL}/api/trips/{self.created_trip_id}")
            except:
                pass
        for order_id in self.created_order_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/greenhouse/orders/{order_id}")
            except:
                pass
    
    def test_get_trips_endpoint(self):
        """Test GET /api/trips returns list of trips"""
        response = self.session.get(f"{BASE_URL}/api/trips")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/trips returns {len(data)} trips")
    
    def test_get_trips_by_section(self):
        """Test GET /api/trips?section=balia filters by section"""
        response = self.session.get(f"{BASE_URL}/api/trips?section=balia")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All trips should be from balia section
        for trip in data:
            assert trip.get("section") == "balia"
        print(f"✓ GET /api/trips?section=balia returns {len(data)} balia trips")
    
    def test_create_trip_with_orders(self):
        """Test POST /api/trips creates trip with orders"""
        # First create a test order
        order_data = {
            "id": f"TEST-GH-{int(time.time())}",
            "fullName": "Test Order for Trip",
            "fullAddress": "Test Address, Warsaw",
            "phoneNumber": "+48 123 456 789",
            "source": "test",
            "status": "new"
        }
        order_response = self.session.post(f"{BASE_URL}/api/greenhouse/orders", json=order_data)
        assert order_response.status_code in [200, 201]
        self.created_order_ids.append(order_data["id"])
        
        # Create trip with the order
        trip_data = {
            "name": f"Test Trip {int(time.time())}",
            "section": "greenhouse",
            "orderIds": [order_data["id"]],
            "driverId": "driver1",
            "driverName": "Test Driver"
        }
        response = self.session.post(f"{BASE_URL}/api/trips", json=trip_data)
        assert response.status_code == 200
        
        trip = response.json()
        self.created_trip_id = trip.get("id")
        
        assert "id" in trip
        assert trip["name"] == trip_data["name"]
        assert trip["section"] == "greenhouse"
        assert trip["status"] == "planned"
        assert order_data["id"] in trip.get("orderIds", [])
        assert trip.get("orderStatuses", {}).get(order_data["id"]) == "pending"
        print(f"✓ POST /api/trips creates trip with ID: {trip['id']}")
        return trip
    
    def test_update_trip_departure_date(self):
        """Test PUT /api/trips/{trip_id} accepts departureDate field"""
        # Create a trip first
        trip = self.test_create_trip_with_orders()
        trip_id = trip["id"]
        
        # Update with departure date
        departure_date = "2025-01-15"
        update_data = {
            "departureDate": departure_date
        }
        response = self.session.put(f"{BASE_URL}/api/trips/{trip_id}", json=update_data)
        assert response.status_code == 200
        
        updated_trip = response.json()
        assert updated_trip.get("departureDate") == departure_date
        print(f"✓ PUT /api/trips/{trip_id} accepts departureDate: {departure_date}")
    
    def test_update_trip_status_syncs_order_statuses(self):
        """Test that changing trip status syncs all order statuses when syncOrderStatuses=true"""
        # Create a trip first
        trip = self.test_create_trip_with_orders()
        trip_id = trip["id"]
        order_id = trip["orderIds"][0]
        
        # Verify initial status
        assert trip.get("status") == "planned"
        assert trip.get("orderStatuses", {}).get(order_id) == "pending"
        
        # Update trip status to in_transit with syncOrderStatuses=true
        update_data = {
            "status": "in_transit",
            "syncOrderStatuses": True
        }
        response = self.session.put(f"{BASE_URL}/api/trips/{trip_id}", json=update_data)
        assert response.status_code == 200
        
        updated_trip = response.json()
        assert updated_trip.get("status") == "in_transit"
        # Order status should be synced to "delivering"
        assert updated_trip.get("orderStatuses", {}).get(order_id) == "delivering"
        print(f"✓ Trip status change to 'in_transit' synced order status to 'delivering'")
        
        # Update trip status to completed
        update_data = {
            "status": "completed",
            "syncOrderStatuses": True
        }
        response = self.session.put(f"{BASE_URL}/api/trips/{trip_id}", json=update_data)
        assert response.status_code == 200
        
        updated_trip = response.json()
        assert updated_trip.get("status") == "completed"
        # Order status should be synced to "delivered"
        assert updated_trip.get("orderStatuses", {}).get(order_id) == "delivered"
        print(f"✓ Trip status change to 'completed' synced order status to 'delivered'")
    
    def test_update_trip_status_without_sync(self):
        """Test that changing trip status without syncOrderStatuses doesn't change order statuses"""
        # Create a trip first
        trip = self.test_create_trip_with_orders()
        trip_id = trip["id"]
        order_id = trip["orderIds"][0]
        
        # Update trip status without syncOrderStatuses
        update_data = {
            "status": "in_transit",
            "syncOrderStatuses": False
        }
        response = self.session.put(f"{BASE_URL}/api/trips/{trip_id}", json=update_data)
        assert response.status_code == 200
        
        updated_trip = response.json()
        assert updated_trip.get("status") == "in_transit"
        # Order status should remain "pending" (not synced)
        assert updated_trip.get("orderStatuses", {}).get(order_id) == "pending"
        print(f"✓ Trip status change without sync keeps order status as 'pending'")
    
    def test_update_individual_order_status_in_trip(self):
        """Test PUT /api/trips/{trip_id}/order-status/{order_id} updates single order"""
        # Create a trip first
        trip = self.test_create_trip_with_orders()
        trip_id = trip["id"]
        order_id = trip["orderIds"][0]
        
        # Update individual order status
        response = self.session.put(
            f"{BASE_URL}/api/trips/{trip_id}/order-status/{order_id}?status=delivered"
        )
        assert response.status_code == 200
        
        result = response.json()
        assert result.get("status") == "ok"
        assert result.get("new_status") == "delivered"
        print(f"✓ PUT /api/trips/{trip_id}/order-status/{order_id} updates to 'delivered'")
    
    def test_delete_trip(self):
        """Test DELETE /api/trips/{trip_id} removes trip and releases orders"""
        # Create a trip first
        trip = self.test_create_trip_with_orders()
        trip_id = trip["id"]
        
        # Delete the trip
        response = self.session.delete(f"{BASE_URL}/api/trips/{trip_id}")
        assert response.status_code == 200
        
        result = response.json()
        assert result.get("status") == "ok"
        
        # Verify trip is deleted
        get_response = self.session.get(f"{BASE_URL}/api/trips/{trip_id}")
        assert get_response.status_code == 404
        
        self.created_trip_id = None  # Already deleted
        print(f"✓ DELETE /api/trips/{trip_id} removes trip successfully")


class TestAmoCRMSyncTripAPI:
    """Test amoCRM sync-trip endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_sync_trip_endpoint_exists(self):
        """Test POST /api/integrations/amocrm/sync-trip endpoint exists"""
        # Call with test data - should return skipped if no credentials
        response = self.session.post(
            f"{BASE_URL}/api/integrations/amocrm/sync-trip",
            params={
                "amocrm_id": "12345",
                "trip_name": "Test Trip",
                "driver_name": "Test Driver",
                "departure_date": "2025-01-15",
                "order_status": "delivering"
            }
        )
        # Should return 200 with skipped status (no credentials configured)
        assert response.status_code == 200
        data = response.json()
        # Either skipped (no credentials) or ok (credentials configured)
        assert data.get("status") in ["skipped", "ok", "error"]
        print(f"✓ POST /api/integrations/amocrm/sync-trip returns status: {data.get('status')}")
    
    def test_sync_trip_with_all_params(self):
        """Test sync-trip with all parameters"""
        response = self.session.post(
            f"{BASE_URL}/api/integrations/amocrm/sync-trip",
            params={
                "amocrm_id": "99999",
                "trip_name": "Рейс 15 января",
                "driver_name": "Иван Петров",
                "departure_date": "2025-01-15",
                "order_status": "pending"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        print(f"✓ sync-trip with all params returns: {data}")


class TestAmoCRMSettings:
    """Test amoCRM settings for trip sync fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_get_settings_includes_trip_fields(self):
        """Test GET /api/integrations/amocrm/settings includes trip sync field IDs"""
        response = self.session.get(f"{BASE_URL}/api/integrations/amocrm/settings")
        assert response.status_code == 200
        
        settings = response.json()
        
        # Check that trip sync fields are present in response
        assert "trip_number_field_id" in settings
        assert "trip_driver_field_id" in settings
        assert "trip_departure_field_id" in settings
        assert "trip_order_status_field_id" in settings
        
        print(f"✓ Settings include trip sync fields:")
        print(f"  - trip_number_field_id: {settings.get('trip_number_field_id')}")
        print(f"  - trip_driver_field_id: {settings.get('trip_driver_field_id')}")
        print(f"  - trip_departure_field_id: {settings.get('trip_departure_field_id')}")
        print(f"  - trip_order_status_field_id: {settings.get('trip_order_status_field_id')}")
    
    def test_save_settings_with_trip_fields(self):
        """Test POST /api/integrations/amocrm/settings saves trip sync field IDs"""
        # First get current settings
        get_response = self.session.get(f"{BASE_URL}/api/integrations/amocrm/settings")
        current_settings = get_response.json()
        
        # Update with trip field IDs
        update_data = {
            "enabled": current_settings.get("enabled", False),
            "field_mapping": current_settings.get("field_mapping", {}),
            "amocrm_domain": current_settings.get("amocrm_domain", ""),
            "amocrm_token": current_settings.get("amocrm_token", ""),
            "status_field_id": current_settings.get("status_field_id", ""),
            "comment_field_id": current_settings.get("comment_field_id", ""),
            "trip_number_field_id": "123456",
            "trip_driver_field_id": "123457",
            "trip_departure_field_id": "123458",
            "trip_order_status_field_id": "123459"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/integrations/amocrm/settings",
            json=update_data
        )
        assert response.status_code == 200
        
        # Verify settings were saved
        verify_response = self.session.get(f"{BASE_URL}/api/integrations/amocrm/settings")
        saved_settings = verify_response.json()
        
        assert saved_settings.get("trip_number_field_id") == "123456"
        assert saved_settings.get("trip_driver_field_id") == "123457"
        assert saved_settings.get("trip_departure_field_id") == "123458"
        assert saved_settings.get("trip_order_status_field_id") == "123459"
        
        print(f"✓ Settings saved with trip sync field IDs")
        
        # Restore original settings
        restore_data = {
            "enabled": current_settings.get("enabled", False),
            "field_mapping": current_settings.get("field_mapping", {}),
            "amocrm_domain": current_settings.get("amocrm_domain", ""),
            "amocrm_token": current_settings.get("amocrm_token", ""),
            "status_field_id": current_settings.get("status_field_id", ""),
            "comment_field_id": current_settings.get("comment_field_id", ""),
            "trip_number_field_id": current_settings.get("trip_number_field_id", ""),
            "trip_driver_field_id": current_settings.get("trip_driver_field_id", ""),
            "trip_departure_field_id": current_settings.get("trip_departure_field_id", ""),
            "trip_order_status_field_id": current_settings.get("trip_order_status_field_id", "")
        }
        self.session.post(f"{BASE_URL}/api/integrations/amocrm/settings", json=restore_data)


class TestDriversAPI:
    """Test drivers API for trip management"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_get_drivers(self):
        """Test GET /api/drivers returns list of drivers"""
        response = self.session.get(f"{BASE_URL}/api/drivers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/drivers returns {len(data)} drivers")
        for driver in data[:3]:
            print(f"  - {driver.get('name')} (ID: {driver.get('id')})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
