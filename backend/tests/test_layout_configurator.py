"""
Tests for Layout Configurator API endpoints
Testing: sauna-models, assets, layouts, element-types
"""
import pytest
import requests
import json
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://config-builder-4.preview.emergentagent.com').rstrip('/')

class TestLayoutConfiguratorAPI:
    """Layout Configurator API endpoint tests"""
    
    def test_get_sauna_models(self):
        """Test GET /api/layout-configurator/sauna-models"""
        response = requests.get(f"{BASE_URL}/api/layout-configurator/sauna-models")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "models" in data, "Response should contain 'models' key"
        assert isinstance(data["models"], list), "models should be a list"
        
        # Check model structure if models exist
        if len(data["models"]) > 0:
            model = data["models"][0]
            assert "id" in model, "Model should have 'id'"
            assert "name" in model, "Model should have 'name'"
            print(f"Found {len(data['models'])} sauna models")
    
    def test_get_element_types(self):
        """Test GET /api/layout-configurator/element-types"""
        response = requests.get(f"{BASE_URL}/api/layout-configurator/element-types")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "types" in data, "Response should contain 'types' key"
        assert isinstance(data["types"], list), "types should be a list"
        
        # Should have standard element types
        type_ids = [t["id"] for t in data["types"]]
        expected_types = ["heater", "bench", "door", "window"]
        for expected in expected_types:
            assert expected in type_ids, f"Element type '{expected}' should exist"
        print(f"Found {len(data['types'])} element types: {type_ids}")
    
    def test_get_assets(self):
        """Test GET /api/layout-configurator/assets"""
        response = requests.get(f"{BASE_URL}/api/layout-configurator/assets")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "assets" in data, "Response should contain 'assets' key"
        assert isinstance(data["assets"], list), "assets should be a list"
        
        # Check asset structure if assets exist
        if len(data["assets"]) > 0:
            asset = data["assets"][0]
            assert "id" in asset, "Asset should have 'id'"
            assert "name" in asset, "Asset should have 'name'"
            assert "type" in asset, "Asset should have 'type'"
            assert "imageUrl" in asset, "Asset should have 'imageUrl'"
        print(f"Found {len(data['assets'])} assets")
    
    def test_get_assets_by_type(self):
        """Test GET /api/layout-configurator/assets?type=heater"""
        response = requests.get(f"{BASE_URL}/api/layout-configurator/assets?type=heater")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "assets" in data
        # All returned assets should be of type heater
        for asset in data["assets"]:
            assert asset["type"] == "heater", f"Asset type should be 'heater', got '{asset['type']}'"
        print(f"Found {len(data['assets'])} heater assets")
    
    def test_get_layouts(self):
        """Test GET /api/layout-configurator/layouts"""
        response = requests.get(f"{BASE_URL}/api/layout-configurator/layouts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "layouts" in data, "Response should contain 'layouts' key"
        assert isinstance(data["layouts"], list), "layouts should be a list"
        print(f"Found {len(data['layouts'])} layouts")
    
    def test_get_published_layouts(self):
        """Test GET /api/layout-configurator/published-layouts"""
        response = requests.get(f"{BASE_URL}/api/layout-configurator/published-layouts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "published-layouts should return a list"
        # All returned layouts should have isActive = True
        for layout in data:
            assert layout.get("isActive") == True or "isActive" not in layout
        print(f"Found {len(data)} published layouts")
    
    def test_get_outlines(self):
        """Test GET /api/layout-configurator/outlines"""
        response = requests.get(f"{BASE_URL}/api/layout-configurator/outlines")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "outlines" in data, "Response should contain 'outlines' key"
        assert isinstance(data["outlines"], list), "outlines should be a list"
        print(f"Found {len(data['outlines'])} outlines")


class TestLayoutCRUD:
    """Test Layout CRUD operations"""
    
    created_layout_id = None
    
    def test_create_layout(self):
        """Test POST /api/layout-configurator/layouts"""
        # Get a model ID first
        models_response = requests.get(f"{BASE_URL}/api/layout-configurator/sauna-models")
        models = models_response.json().get("models", [])
        
        if not models:
            pytest.skip("No sauna models available to create layout")
        
        model_id = models[0]["id"]
        model_name = models[0]["name"]
        
        form_data = {
            "name": "TEST_Layout_Configurator",
            "modelId": model_id,
            "modelName": model_name,
            "canvasWidth": "800",
            "canvasHeight": "400",
            "elements": json.dumps([]),
        }
        
        response = requests.post(f"{BASE_URL}/api/layout-configurator/layouts", data=form_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "layoutId" in data, "Response should contain 'layoutId'"
        assert "layout" in data, "Response should contain 'layout'"
        
        TestLayoutCRUD.created_layout_id = data["layoutId"]
        print(f"Created layout: {TestLayoutCRUD.created_layout_id}")
    
    def test_get_created_layout(self):
        """Test GET /api/layout-configurator/layouts/{layout_id}"""
        if not TestLayoutCRUD.created_layout_id:
            pytest.skip("No layout created in previous test")
        
        response = requests.get(f"{BASE_URL}/api/layout-configurator/layouts/{TestLayoutCRUD.created_layout_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["id"] == TestLayoutCRUD.created_layout_id
        assert data["name"] == "TEST_Layout_Configurator"
        print(f"Retrieved layout: {data['name']}")
    
    def test_update_layout(self):
        """Test PUT /api/layout-configurator/layouts/{layout_id}/data"""
        if not TestLayoutCRUD.created_layout_id:
            pytest.skip("No layout created in previous test")
        
        update_data = {
            "name": "TEST_Layout_Updated",
            "description": "Updated description"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/layout-configurator/layouts/{TestLayoutCRUD.created_layout_id}/data",
            json=update_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["name"] == "TEST_Layout_Updated"
        print(f"Updated layout name to: {data['name']}")
    
    def test_duplicate_layout(self):
        """Test POST /api/layout-configurator/layouts/{layout_id}/duplicate"""
        if not TestLayoutCRUD.created_layout_id:
            pytest.skip("No layout created in previous test")
        
        response = requests.post(
            f"{BASE_URL}/api/layout-configurator/layouts/{TestLayoutCRUD.created_layout_id}/duplicate"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert "layoutId" in data
        
        # Clean up the duplicate
        duplicate_id = data["layoutId"]
        requests.delete(f"{BASE_URL}/api/layout-configurator/layouts/{duplicate_id}")
        print(f"Duplicated and cleaned up layout: {duplicate_id}")
    
    def test_publish_layout(self):
        """Test POST /api/layout-configurator/layouts/{layout_id}/publish"""
        if not TestLayoutCRUD.created_layout_id:
            pytest.skip("No layout created in previous test")
        
        response = requests.post(
            f"{BASE_URL}/api/layout-configurator/layouts/{TestLayoutCRUD.created_layout_id}/publish"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["success"] == True
        assert data["isPublished"] == True
        print(f"Published layout: {TestLayoutCRUD.created_layout_id}")
    
    def test_unpublish_layout(self):
        """Test POST /api/layout-configurator/layouts/{layout_id}/unpublish"""
        if not TestLayoutCRUD.created_layout_id:
            pytest.skip("No layout created in previous test")
        
        response = requests.post(
            f"{BASE_URL}/api/layout-configurator/layouts/{TestLayoutCRUD.created_layout_id}/unpublish"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["success"] == True
        assert data["isPublished"] == False
        print(f"Unpublished layout: {TestLayoutCRUD.created_layout_id}")
    
    def test_delete_layout(self):
        """Test DELETE /api/layout-configurator/layouts/{layout_id}"""
        if not TestLayoutCRUD.created_layout_id:
            pytest.skip("No layout created in previous test")
        
        response = requests.delete(
            f"{BASE_URL}/api/layout-configurator/layouts/{TestLayoutCRUD.created_layout_id}"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["success"] == True
        print(f"Deleted layout: {TestLayoutCRUD.created_layout_id}")
        
        # Verify deletion
        get_response = requests.get(
            f"{BASE_URL}/api/layout-configurator/layouts/{TestLayoutCRUD.created_layout_id}"
        )
        assert get_response.status_code == 404, "Deleted layout should return 404"
        
        TestLayoutCRUD.created_layout_id = None


class TestLayoutConfiguratorErrors:
    """Test error handling for Layout Configurator API"""
    
    def test_get_nonexistent_layout(self):
        """Test GET /api/layout-configurator/layouts/{invalid_id} returns 404"""
        response = requests.get(f"{BASE_URL}/api/layout-configurator/layouts/nonexistent-layout-id")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_get_nonexistent_outline(self):
        """Test GET /api/layout-configurator/outlines/{invalid_id} returns 404"""
        response = requests.get(f"{BASE_URL}/api/layout-configurator/outlines/nonexistent-model-id")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_delete_nonexistent_asset(self):
        """Test DELETE /api/layout-configurator/assets/{invalid_id} returns 404"""
        response = requests.delete(f"{BASE_URL}/api/layout-configurator/assets/nonexistent-asset-id")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
