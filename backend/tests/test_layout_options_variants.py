"""
Test Layout Options & Variants API for Layout Configurator
Features:
- CRUD operations for layout options (e.g., "Strona wejścia")
- CRUD operations for variants within options
- Apply variant functionality
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLayoutOptionsAPI:
    """Test layout options CRUD operations"""
    
    created_option_id = None
    created_variant_id = None
    
    def test_01_get_options_empty(self):
        """GET /api/layout-configurator/options - returns list (possibly empty)"""
        response = requests.get(f"{BASE_URL}/api/layout-configurator/options")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "options" in data, "Response should contain 'options' key"
        assert isinstance(data["options"], list), "'options' should be a list"
        print(f"✓ GET /options returns {len(data['options'])} options")
    
    def test_02_create_option(self):
        """POST /api/layout-configurator/options - create new option"""
        form_data = {
            "name": "TEST_Strona wejścia",
            "namePl": "TEST_Strona wejścia",
            "nameRu": "TEST_Сторона входа"
        }
        response = requests.post(
            f"{BASE_URL}/api/layout-configurator/options",
            data=form_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}. Body: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain 'id'"
        assert data["name"] == form_data["name"], f"Name mismatch: {data['name']}"
        assert data["namePl"] == form_data["namePl"], f"NamePl mismatch"
        assert data["nameRu"] == form_data["nameRu"], f"NameRu mismatch"
        assert "variants" in data, "Response should contain 'variants'"
        assert data["variants"] == [], "New option should have empty variants"
        
        TestLayoutOptionsAPI.created_option_id = data["id"]
        print(f"✓ Created option with id: {data['id']}")
    
    def test_03_get_options_with_created(self):
        """GET /api/layout-configurator/options - verify created option appears"""
        response = requests.get(f"{BASE_URL}/api/layout-configurator/options")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["options"]) > 0, "Should have at least one option"
        
        # Find our created option
        found = None
        for opt in data["options"]:
            if opt["id"] == TestLayoutOptionsAPI.created_option_id:
                found = opt
                break
        
        assert found is not None, f"Created option {TestLayoutOptionsAPI.created_option_id} not found"
        assert found["name"] == "TEST_Strona wejścia"
        print(f"✓ Created option found in list")
    
    def test_04_add_variant_to_option(self):
        """POST /api/layout-configurator/options/{option_id}/variants - add variant"""
        option_id = TestLayoutOptionsAPI.created_option_id
        assert option_id is not None, "Option ID not set from previous test"
        
        element_configs = [{
            "elementType": "door",
            "matchBy": "type",
            "assetId": None,
            "properties": {
                "left": 100,
                "top": 200,
                "angle": 0,
                "scaleX": 1,
                "scaleY": 1,
                "visible": True
            }
        }]
        
        form_data = {
            "name": "TEST_Prosto",
            "namePl": "TEST_Prosto",
            "nameRu": "TEST_Прямо",
            "elementConfigs": json.dumps(element_configs)
        }
        
        response = requests.post(
            f"{BASE_URL}/api/layout-configurator/options/{option_id}/variants",
            data=form_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}. Body: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        assert "variant" in data, "Response should contain 'variant'"
        assert "id" in data["variant"], "Variant should have 'id'"
        assert data["variant"]["name"] == "TEST_Prosto"
        assert "elementConfigs" in data["variant"], "Variant should have elementConfigs"
        assert len(data["variant"]["elementConfigs"]) == 1
        
        TestLayoutOptionsAPI.created_variant_id = data["variant"]["id"]
        print(f"✓ Created variant with id: {data['variant']['id']}")
    
    def test_05_verify_variant_in_option(self):
        """GET /api/layout-configurator/options - verify variant attached to option"""
        response = requests.get(f"{BASE_URL}/api/layout-configurator/options")
        assert response.status_code == 200
        
        data = response.json()
        option = None
        for opt in data["options"]:
            if opt["id"] == TestLayoutOptionsAPI.created_option_id:
                option = opt
                break
        
        assert option is not None, "Option not found"
        assert "variants" in option, "Option should have variants"
        assert len(option["variants"]) >= 1, "Option should have at least 1 variant"
        
        variant = None
        for v in option["variants"]:
            if v["id"] == TestLayoutOptionsAPI.created_variant_id:
                variant = v
                break
        
        assert variant is not None, "Created variant not found in option"
        assert variant["namePl"] == "TEST_Prosto"
        assert "elementConfigs" in variant
        assert len(variant["elementConfigs"]) == 1
        assert variant["elementConfigs"][0]["elementType"] == "door"
        assert variant["elementConfigs"][0]["properties"]["left"] == 100
        print(f"✓ Variant found in option with correct elementConfigs")
    
    def test_06_add_second_variant(self):
        """POST /api/layout-configurator/options/{option_id}/variants - add second variant"""
        option_id = TestLayoutOptionsAPI.created_option_id
        
        element_configs = [{
            "elementType": "door",
            "matchBy": "type",
            "properties": {
                "left": 300,
                "top": 200,
                "angle": 90,
                "scaleX": 1,
                "scaleY": 1,
                "visible": True
            }
        }]
        
        form_data = {
            "name": "TEST_Z boku",
            "namePl": "TEST_Z boku",
            "nameRu": "TEST_С боку",
            "elementConfigs": json.dumps(element_configs)
        }
        
        response = requests.post(
            f"{BASE_URL}/api/layout-configurator/options/{option_id}/variants",
            data=form_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True
        
        # Verify option now has 2 variants
        get_response = requests.get(f"{BASE_URL}/api/layout-configurator/options")
        assert get_response.status_code == 200
        
        options = get_response.json()["options"]
        option = next((o for o in options if o["id"] == option_id), None)
        assert option is not None
        assert len(option["variants"]) == 2, f"Expected 2 variants, got {len(option['variants'])}"
        print(f"✓ Option now has 2 variants")
    
    def test_07_update_option(self):
        """PUT /api/layout-configurator/options/{option_id} - update option"""
        option_id = TestLayoutOptionsAPI.created_option_id
        
        form_data = {
            "namePl": "TEST_Strona wejścia (updated)",
            "sortOrder": 5
        }
        
        response = requests.put(
            f"{BASE_URL}/api/layout-configurator/options/{option_id}",
            data=form_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}. Body: {response.text}"
        
        data = response.json()
        assert data["namePl"] == "TEST_Strona wejścia (updated)"
        print(f"✓ Option updated successfully")
    
    def test_08_update_variant(self):
        """PUT /api/layout-configurator/options/{option_id}/variants/{variant_id} - update variant"""
        option_id = TestLayoutOptionsAPI.created_option_id
        variant_id = TestLayoutOptionsAPI.created_variant_id
        
        new_configs = [{
            "elementType": "door",
            "matchBy": "type",
            "properties": {
                "left": 150,  # Changed from 100
                "top": 250,   # Changed from 200
                "angle": 45,  # Changed from 0
                "scaleX": 1.2,
                "scaleY": 1.2,
                "visible": True
            }
        }]
        
        form_data = {
            "namePl": "TEST_Prosto (updated)",
            "elementConfigs": json.dumps(new_configs)
        }
        
        response = requests.put(
            f"{BASE_URL}/api/layout-configurator/options/{option_id}/variants/{variant_id}",
            data=form_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}. Body: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("updated") == variant_id
        print(f"✓ Variant updated successfully")
    
    def test_09_verify_variant_update(self):
        """GET /api/layout-configurator/options - verify variant update persisted"""
        response = requests.get(f"{BASE_URL}/api/layout-configurator/options")
        assert response.status_code == 200
        
        options = response.json()["options"]
        option = next((o for o in options if o["id"] == TestLayoutOptionsAPI.created_option_id), None)
        variant = next((v for v in option["variants"] if v["id"] == TestLayoutOptionsAPI.created_variant_id), None)
        
        assert variant is not None
        assert variant["namePl"] == "TEST_Prosto (updated)"
        assert variant["elementConfigs"][0]["properties"]["left"] == 150
        assert variant["elementConfigs"][0]["properties"]["top"] == 250
        assert variant["elementConfigs"][0]["properties"]["angle"] == 45
        print(f"✓ Variant update verified in database")
    
    def test_10_delete_variant(self):
        """DELETE /api/layout-configurator/options/{option_id}/variants/{variant_id}"""
        option_id = TestLayoutOptionsAPI.created_option_id
        variant_id = TestLayoutOptionsAPI.created_variant_id
        
        response = requests.delete(
            f"{BASE_URL}/api/layout-configurator/options/{option_id}/variants/{variant_id}"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("deleted") == variant_id
        
        # Verify variant removed
        get_response = requests.get(f"{BASE_URL}/api/layout-configurator/options")
        options = get_response.json()["options"]
        option = next((o for o in options if o["id"] == option_id), None)
        variant = next((v for v in option.get("variants", []) if v["id"] == variant_id), None)
        assert variant is None, "Variant should be deleted"
        print(f"✓ Variant deleted successfully")
    
    def test_11_delete_option(self):
        """DELETE /api/layout-configurator/options/{option_id}"""
        option_id = TestLayoutOptionsAPI.created_option_id
        
        response = requests.delete(
            f"{BASE_URL}/api/layout-configurator/options/{option_id}"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("deleted") == option_id
        
        # Verify option removed
        get_response = requests.get(f"{BASE_URL}/api/layout-configurator/options")
        options = get_response.json()["options"]
        option = next((o for o in options if o["id"] == option_id), None)
        assert option is None, "Option should be deleted"
        print(f"✓ Option deleted successfully")


class TestLayoutOptionsEdgeCases:
    """Test edge cases and error handling"""
    
    def test_delete_nonexistent_option(self):
        """DELETE /api/layout-configurator/options/{option_id} - 404 for nonexistent"""
        response = requests.delete(
            f"{BASE_URL}/api/layout-configurator/options/nonexistent-id-123"
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ DELETE nonexistent option returns 404")
    
    def test_add_variant_to_nonexistent_option(self):
        """POST /api/layout-configurator/options/{option_id}/variants - 404 for nonexistent option"""
        form_data = {
            "name": "Test",
            "elementConfigs": json.dumps([])
        }
        response = requests.post(
            f"{BASE_URL}/api/layout-configurator/options/nonexistent-id-123/variants",
            data=form_data
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ POST variant to nonexistent option returns 404")
    
    def test_invalid_element_configs_json(self):
        """POST /api/layout-configurator/options/{option_id}/variants - 400 for invalid JSON"""
        # First create a test option
        create_response = requests.post(
            f"{BASE_URL}/api/layout-configurator/options",
            data={"name": "TEST_TempOption", "namePl": "TEST_TempOption"}
        )
        assert create_response.status_code == 200
        option_id = create_response.json()["id"]
        
        # Try to add variant with invalid JSON
        form_data = {
            "name": "Test",
            "elementConfigs": "invalid json {"  # Invalid JSON
        }
        response = requests.post(
            f"{BASE_URL}/api/layout-configurator/options/{option_id}/variants",
            data=form_data
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/layout-configurator/options/{option_id}")
        print(f"✓ POST with invalid JSON returns 400")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
