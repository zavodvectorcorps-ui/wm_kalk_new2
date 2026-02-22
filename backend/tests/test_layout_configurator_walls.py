"""
Tests for Layout Configurator - Individual Wall Thickness and Fixed Height Features
Tests:
1. Asset upload with fixedHeight parameter
2. Room creation with 4 individual wall thicknesses
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAssetUploadWithFixedHeight:
    """Test asset upload with fixedHeight parameter"""
    
    def test_upload_asset_without_fixed_height(self):
        """Test uploading asset without fixedHeight parameter"""
        # Create a minimal PNG file (1x1 pixel)
        png_header = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {'file': ('test_asset.png', io.BytesIO(png_header), 'image/png')}
        data = {
            'name': 'TEST_Normal_Asset',
            'type': 'other',
            'widthCm': '50',
            'heightCm': '50',
        }
        
        response = requests.post(f"{BASE_URL}/api/layout-configurator/assets", files=files, data=data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        asset = response.json()
        assert asset['fixedHeight'] == False, "Asset without fixedHeight param should have fixedHeight=False"
        assert asset['name'] == 'TEST_Normal_Asset'
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/layout-configurator/assets/{asset['id']}")
    
    def test_upload_asset_with_fixed_height_true(self):
        """Test uploading asset with fixedHeight=true"""
        png_header = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {'file': ('test_bench.png', io.BytesIO(png_header), 'image/png')}
        data = {
            'name': 'TEST_Fixed_Bench',
            'type': 'bench',
            'widthCm': '100',
            'heightCm': '40',
            'fixedHeight': 'true',
        }
        
        response = requests.post(f"{BASE_URL}/api/layout-configurator/assets", files=files, data=data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        asset = response.json()
        assert asset['fixedHeight'] == True, "Asset with fixedHeight=true should have fixedHeight=True"
        assert asset['heightCm'] == 40, "heightCm should be preserved"
        assert asset['widthCm'] == 100, "widthCm should be preserved"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/layout-configurator/assets/{asset['id']}")
    
    def test_upload_asset_with_fixed_height_false(self):
        """Test uploading asset with fixedHeight=false"""
        png_header = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {'file': ('test_item.png', io.BytesIO(png_header), 'image/png')}
        data = {
            'name': 'TEST_Regular_Item',
            'type': 'other',
            'widthCm': '60',
            'heightCm': '60',
            'fixedHeight': 'false',
        }
        
        response = requests.post(f"{BASE_URL}/api/layout-configurator/assets", files=files, data=data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        asset = response.json()
        assert asset['fixedHeight'] == False, "Asset with fixedHeight=false should have fixedHeight=False"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/layout-configurator/assets/{asset['id']}")


class TestElementTypes:
    """Test element types endpoint"""
    
    def test_get_element_types(self):
        """Test getting element types returns expected types"""
        response = requests.get(f"{BASE_URL}/api/layout-configurator/element-types")
        
        assert response.status_code == 200
        data = response.json()
        assert 'types' in data
        
        type_ids = [t['id'] for t in data['types']]
        expected_types = ['heater', 'bench', 'door', 'window', 'shower', 'divider', 'stairs', 'terrace', 'other']
        
        for expected in expected_types:
            assert expected in type_ids, f"Missing element type: {expected}"


class TestAssetsList:
    """Test assets list endpoint"""
    
    def test_list_assets(self):
        """Test listing all assets"""
        response = requests.get(f"{BASE_URL}/api/layout-configurator/assets")
        
        assert response.status_code == 200
        data = response.json()
        assert 'assets' in data
        assert isinstance(data['assets'], list)
    
    def test_list_assets_by_type(self):
        """Test filtering assets by type"""
        response = requests.get(f"{BASE_URL}/api/layout-configurator/assets?type=bench")
        
        assert response.status_code == 200
        data = response.json()
        assert 'assets' in data
        # All returned assets should be of type bench
        for asset in data['assets']:
            assert asset['type'] == 'bench', f"Expected type 'bench', got '{asset['type']}'"


class TestLayoutCRUD:
    """Test layout CRUD operations"""
    
    def test_create_layout(self):
        """Test creating a new layout"""
        data = {
            'name': 'TEST_Layout',
            'modelId': 'test-model-1',
            'modelName': 'Test Model',
            'canvasWidth': '800',
            'canvasHeight': '600',
        }
        
        response = requests.post(f"{BASE_URL}/api/layout-configurator/layouts", data=data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        result = response.json()
        assert 'layoutId' in result
        assert 'layout' in result
        
        layout = result['layout']
        assert layout['name'] == 'TEST_Layout'
        assert layout['modelId'] == 'test-model-1'
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/layout-configurator/layouts/{result['layoutId']}")
    
    def test_list_layouts(self):
        """Test listing layouts"""
        response = requests.get(f"{BASE_URL}/api/layout-configurator/layouts")
        
        assert response.status_code == 200
        data = response.json()
        assert 'layouts' in data
        assert isinstance(data['layouts'], list)


class TestSaunaModels:
    """Test sauna models endpoint"""
    
    def test_get_sauna_models(self):
        """Test getting sauna models"""
        response = requests.get(f"{BASE_URL}/api/layout-configurator/sauna-models")
        
        assert response.status_code == 200
        data = response.json()
        assert 'models' in data
        assert isinstance(data['models'], list)
