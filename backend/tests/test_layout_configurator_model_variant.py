"""
Tests for Layout Configurator API - Model/Variant binding and element visibility features.
Tests:
1. GET /api/layout-configurator/layouts with modelId and variantId query parameters
2. GET /api/layout-configurator/options with modelId and variantId query parameters  
3. POST /api/layout-configurator/options saves modelId and variantId
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestLayoutsFilterByModelVariant:
    """Test GET /api/layout-configurator/layouts with modelId and variantId filters"""
    
    def test_get_layouts_without_filters(self):
        """GET /layouts without filters should return all layouts"""
        response = requests.get(f"{BASE_URL}/api/layout-configurator/layouts")
        assert response.status_code == 200
        data = response.json()
        assert "layouts" in data
        assert isinstance(data["layouts"], list)
        print(f"PASS: GET /layouts returned {len(data['layouts'])} layouts")
    
    def test_get_layouts_with_model_id(self):
        """GET /layouts?modelId=xxx should filter by model"""
        # First create a layout with a specific modelId
        test_model_id = f"TEST_model_{uuid.uuid4().hex[:8]}"
        
        # Create test layout
        form_data = {
            "name": f"TEST_Layout_{uuid.uuid4().hex[:6]}",
            "modelId": test_model_id,
        }
        create_response = requests.post(
            f"{BASE_URL}/api/layout-configurator/layouts",
            data=form_data
        )
        assert create_response.status_code == 200, f"Failed to create layout: {create_response.text}"
        created = create_response.json()
        layout_id = created.get("layoutId")
        
        try:
            # Now filter by modelId
            response = requests.get(
                f"{BASE_URL}/api/layout-configurator/layouts",
                params={"modelId": test_model_id}
            )
            assert response.status_code == 200
            data = response.json()
            
            # Check that all returned layouts have the correct modelId
            for layout in data["layouts"]:
                assert layout.get("modelId") == test_model_id, f"Layout {layout.get('id')} has wrong modelId"
            
            # Check that our test layout is in the results
            layout_ids = [l.get("id") for l in data["layouts"]]
            assert layout_id in layout_ids, "Test layout not found in filtered results"
            
            print(f"PASS: GET /layouts?modelId={test_model_id} returned {len(data['layouts'])} layouts")
            
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/layout-configurator/layouts/{layout_id}")
    
    def test_get_layouts_with_variant_id(self):
        """GET /layouts?modelId=xxx&variantId=yyy should filter by model and variant"""
        test_model_id = f"TEST_model_{uuid.uuid4().hex[:8]}"
        test_variant_id = f"TEST_variant_{uuid.uuid4().hex[:8]}"
        
        # Create layout with model and variant
        form_data = {
            "name": f"TEST_Layout_{uuid.uuid4().hex[:6]}",
            "modelId": test_model_id,
            "variantId": test_variant_id,
        }
        create_response = requests.post(
            f"{BASE_URL}/api/layout-configurator/layouts",
            data=form_data
        )
        assert create_response.status_code == 200
        layout_id = create_response.json().get("layoutId")
        
        try:
            # Filter by both modelId and variantId
            response = requests.get(
                f"{BASE_URL}/api/layout-configurator/layouts",
                params={"modelId": test_model_id, "variantId": test_variant_id}
            )
            assert response.status_code == 200
            data = response.json()
            
            # Verify filters applied correctly
            for layout in data["layouts"]:
                assert layout.get("modelId") == test_model_id
                assert layout.get("variantId") == test_variant_id
            
            print(f"PASS: GET /layouts with modelId+variantId returned {len(data['layouts'])} layouts")
            
        finally:
            requests.delete(f"{BASE_URL}/api/layout-configurator/layouts/{layout_id}")


class TestOptionsFilterByModelVariant:
    """Test GET /api/layout-configurator/options with modelId and variantId filters"""
    
    def test_get_options_without_filters(self):
        """GET /options without filters should return all options"""
        response = requests.get(f"{BASE_URL}/api/layout-configurator/options")
        assert response.status_code == 200
        data = response.json()
        assert "options" in data
        assert isinstance(data["options"], list)
        print(f"PASS: GET /options returned {len(data['options'])} options")
    
    def test_get_options_with_model_id(self):
        """GET /options?modelId=xxx should return model-specific + global options"""
        test_model_id = f"TEST_model_{uuid.uuid4().hex[:8]}"
        
        # Create a model-specific option
        form_data = {
            "name": f"TEST_Option_{uuid.uuid4().hex[:6]}",
            "modelId": test_model_id,
        }
        create_response = requests.post(
            f"{BASE_URL}/api/layout-configurator/options",
            data=form_data
        )
        assert create_response.status_code == 200, f"Failed to create option: {create_response.text}"
        option_id = create_response.json().get("id")
        
        try:
            # Filter by modelId
            response = requests.get(
                f"{BASE_URL}/api/layout-configurator/options",
                params={"modelId": test_model_id}
            )
            assert response.status_code == 200
            data = response.json()
            
            # Should include global options (modelId=null) and model-specific options
            option_ids = [o.get("id") for o in data["options"]]
            assert option_id in option_ids, "Test option not found in filtered results"
            
            print(f"PASS: GET /options?modelId={test_model_id} returned {len(data['options'])} options")
            
        finally:
            requests.delete(f"{BASE_URL}/api/layout-configurator/options/{option_id}")
    
    def test_get_options_with_model_and_variant(self):
        """GET /options?modelId=xxx&variantId=yyy should return filtered options"""
        test_model_id = f"TEST_model_{uuid.uuid4().hex[:8]}"
        test_variant_id = f"TEST_variant_{uuid.uuid4().hex[:8]}"
        
        # Create option with model and variant
        form_data = {
            "name": f"TEST_Option_{uuid.uuid4().hex[:6]}",
            "modelId": test_model_id,
            "variantId": test_variant_id,
        }
        create_response = requests.post(
            f"{BASE_URL}/api/layout-configurator/options",
            data=form_data
        )
        assert create_response.status_code == 200
        option_id = create_response.json().get("id")
        
        try:
            # Filter by both
            response = requests.get(
                f"{BASE_URL}/api/layout-configurator/options",
                params={"modelId": test_model_id, "variantId": test_variant_id}
            )
            assert response.status_code == 200
            data = response.json()
            
            # Verify our test option is in results
            option_ids = [o.get("id") for o in data["options"]]
            assert option_id in option_ids
            
            print(f"PASS: GET /options with modelId+variantId returned {len(data['options'])} options")
            
        finally:
            requests.delete(f"{BASE_URL}/api/layout-configurator/options/{option_id}")


class TestCreateOptionWithModelVariant:
    """Test POST /api/layout-configurator/options saves modelId and variantId"""
    
    def test_create_option_with_model_id(self):
        """POST /options should save modelId"""
        test_model_id = f"TEST_model_{uuid.uuid4().hex[:8]}"
        
        form_data = {
            "name": f"TEST_Option_{uuid.uuid4().hex[:6]}",
            "namePl": "Test Option PL",
            "nameRu": "Test Option RU",
            "modelId": test_model_id,
        }
        
        response = requests.post(
            f"{BASE_URL}/api/layout-configurator/options",
            data=form_data
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify modelId was saved
        assert data.get("modelId") == test_model_id, f"modelId not saved correctly: {data}"
        assert data.get("name") == form_data["name"]
        
        option_id = data.get("id")
        print(f"PASS: POST /options saved modelId correctly: {test_model_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/layout-configurator/options/{option_id}")
    
    def test_create_option_with_model_and_variant(self):
        """POST /options should save both modelId and variantId"""
        test_model_id = f"TEST_model_{uuid.uuid4().hex[:8]}"
        test_variant_id = f"TEST_variant_{uuid.uuid4().hex[:8]}"
        
        form_data = {
            "name": f"TEST_Option_{uuid.uuid4().hex[:6]}",
            "modelId": test_model_id,
            "variantId": test_variant_id,
        }
        
        response = requests.post(
            f"{BASE_URL}/api/layout-configurator/options",
            data=form_data
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify both modelId and variantId were saved
        assert data.get("modelId") == test_model_id, f"modelId not saved: {data}"
        assert data.get("variantId") == test_variant_id, f"variantId not saved: {data}"
        
        option_id = data.get("id")
        print(f"PASS: POST /options saved modelId and variantId correctly")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/layout-configurator/options/{option_id}")
    
    def test_create_option_with_null_values(self):
        """POST /options with 'null' string values should convert to None"""
        form_data = {
            "name": f"TEST_Option_{uuid.uuid4().hex[:6]}",
            "modelId": "null",
            "variantId": "null",
        }
        
        response = requests.post(
            f"{BASE_URL}/api/layout-configurator/options",
            data=form_data
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify "null" strings are converted to None
        assert data.get("modelId") is None, f"modelId should be None but got: {data.get('modelId')}"
        assert data.get("variantId") is None, f"variantId should be None but got: {data.get('variantId')}"
        
        option_id = data.get("id")
        print(f"PASS: POST /options correctly converts 'null' strings to None")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/layout-configurator/options/{option_id}")


class TestElementVisibilityInVariant:
    """Test that element visibility property is properly saved in variant configs"""
    
    def test_variant_element_config_includes_visible(self):
        """POST /options/{id}/variants should accept visible property in elementConfigs"""
        # First create an option
        option_form = {
            "name": f"TEST_Option_{uuid.uuid4().hex[:6]}",
        }
        opt_response = requests.post(
            f"{BASE_URL}/api/layout-configurator/options",
            data=option_form
        )
        assert opt_response.status_code == 200
        option_id = opt_response.json().get("id")
        
        try:
            # Create variant with element config that includes visible property
            import json
            element_configs = [
                {
                    "elementType": "heater",
                    "matchBy": "type",
                    "properties": {
                        "left": 100,
                        "top": 200,
                        "visible": False,  # Hidden element
                        "angle": 0,
                        "scaleX": 1,
                        "scaleY": 1,
                    }
                }
            ]
            
            variant_form = {
                "name": f"TEST_Variant_{uuid.uuid4().hex[:6]}",
                "elementConfigs": json.dumps(element_configs),
            }
            
            var_response = requests.post(
                f"{BASE_URL}/api/layout-configurator/options/{option_id}/variants",
                data=variant_form
            )
            assert var_response.status_code == 200
            var_data = var_response.json()
            
            # Verify the variant was created
            assert var_data.get("success") == True
            variant = var_data.get("variant", {})
            
            # Verify elementConfigs includes visible property
            saved_configs = variant.get("elementConfigs", [])
            assert len(saved_configs) == 1
            assert saved_configs[0]["properties"]["visible"] == False
            
            print(f"PASS: Variant saved with visible property in elementConfigs")
            
        finally:
            requests.delete(f"{BASE_URL}/api/layout-configurator/options/{option_id}")


class TestLayoutConfiguratorEndpoints:
    """Additional tests for Layout Configurator API endpoints"""
    
    def test_api_health(self):
        """Verify Layout Configurator API is accessible"""
        response = requests.get(f"{BASE_URL}/api/layout-configurator/element-types")
        assert response.status_code == 200
        data = response.json()
        assert "types" in data
        print(f"PASS: API health check - element-types endpoint working")
    
    def test_sauna_models_endpoint(self):
        """GET /sauna-models should return models with variants"""
        response = requests.get(f"{BASE_URL}/api/layout-configurator/sauna-models")
        assert response.status_code == 200
        data = response.json()
        assert "models" in data
        print(f"PASS: GET /sauna-models returned {len(data['models'])} models")
    
    def test_layouts_crud_flow(self):
        """Test create-read-delete flow for layouts"""
        test_model_id = f"TEST_model_{uuid.uuid4().hex[:8]}"
        test_name = f"TEST_Layout_{uuid.uuid4().hex[:6]}"
        
        # CREATE
        form_data = {
            "name": test_name,
            "modelId": test_model_id,
        }
        create_response = requests.post(
            f"{BASE_URL}/api/layout-configurator/layouts",
            data=form_data
        )
        assert create_response.status_code == 200
        layout_id = create_response.json().get("layoutId")
        assert layout_id is not None
        
        # READ
        get_response = requests.get(f"{BASE_URL}/api/layout-configurator/layouts/{layout_id}")
        assert get_response.status_code == 200
        layout_data = get_response.json()
        assert layout_data.get("name") == test_name
        assert layout_data.get("modelId") == test_model_id
        
        # DELETE
        delete_response = requests.delete(f"{BASE_URL}/api/layout-configurator/layouts/{layout_id}")
        assert delete_response.status_code == 200
        
        # VERIFY DELETED
        verify_response = requests.get(f"{BASE_URL}/api/layout-configurator/layouts/{layout_id}")
        assert verify_response.status_code == 404
        
        print(f"PASS: Layout CRUD flow completed successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
