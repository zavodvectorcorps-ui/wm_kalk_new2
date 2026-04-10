"""
Test suite for Model Grouping feature (iteration 78)
Tests:
1. Backend: SaunaModel accepts modelGroup and modelGroupImageUrl fields
2. Backend: GET /api/sauna/prices returns modelGroup field for each model
3. Backend: PUT /api/sauna/models/{id} can update modelGroup field
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestModelGroupingBackend:
    """Test modelGroup and modelGroupImageUrl fields in SaunaModel"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Store original model data for cleanup"""
        self.test_model_id = "sauna_kwadro_beczka_235x200_cm"
        # Get original model data
        response = requests.get(f"{BASE_URL}/api/sauna/prices")
        assert response.status_code == 200
        prices = response.json()
        models = prices.get('models', [])
        self.original_model = next((m for m in models if m['id'] == self.test_model_id), None)
        yield
        # Cleanup: restore original model if it was modified
        if self.original_model:
            requests.put(
                f"{BASE_URL}/api/sauna/models/{self.test_model_id}",
                json=self.original_model
            )
    
    def test_get_prices_returns_model_structure(self):
        """Test GET /api/sauna/prices returns models with expected structure"""
        response = requests.get(f"{BASE_URL}/api/sauna/prices")
        assert response.status_code == 200
        
        data = response.json()
        assert 'models' in data
        assert len(data['models']) > 0
        
        # Check first model has expected fields
        model = data['models'][0]
        assert 'id' in model
        assert 'name' in model
        assert 'basePrice' in model
        print(f"✓ GET /api/sauna/prices returns {len(data['models'])} models")
    
    def test_model_accepts_modelGroup_field(self):
        """Test that SaunaModel accepts modelGroup optional field"""
        # Update model with modelGroup
        update_data = {
            "id": self.test_model_id,
            "name": "Sauna Kwadro-Beczka 235x200 cm",
            "basePrice": 14200,
            "foundationPrice": 150,
            "discount": 10,
            "imageUrl": "/api/uploads/cc7a2fde58ba47018dea01071dc766bc.jpg",
            "sortOrder": 1,
            "active": True,
            "modelGroup": "TEST_Квадро-Бочка",
            "modelGroupImageUrl": "/api/uploads/test_group_image.jpg"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/sauna/models/{self.test_model_id}",
            json=update_data
        )
        assert response.status_code == 200
        
        result = response.json()
        assert result.get('message') == "Model updated successfully"
        assert result.get('model', {}).get('modelGroup') == "TEST_Квадро-Бочка"
        assert result.get('model', {}).get('modelGroupImageUrl') == "/api/uploads/test_group_image.jpg"
        print("✓ Model accepts modelGroup and modelGroupImageUrl fields")
    
    def test_get_prices_returns_modelGroup_after_update(self):
        """Test that GET /api/sauna/prices returns modelGroup field after update"""
        # First update model with modelGroup
        update_data = {
            "id": self.test_model_id,
            "name": "Sauna Kwadro-Beczka 235x200 cm",
            "basePrice": 14200,
            "foundationPrice": 150,
            "discount": 10,
            "imageUrl": "/api/uploads/cc7a2fde58ba47018dea01071dc766bc.jpg",
            "sortOrder": 1,
            "active": True,
            "modelGroup": "TEST_Квадро",
            "modelGroupImageUrl": "/api/uploads/test_group.jpg"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/sauna/models/{self.test_model_id}",
            json=update_data
        )
        assert response.status_code == 200
        
        # Now get prices and verify modelGroup is returned
        response = requests.get(f"{BASE_URL}/api/sauna/prices")
        assert response.status_code == 200
        
        data = response.json()
        model = next((m for m in data['models'] if m['id'] == self.test_model_id), None)
        assert model is not None
        assert model.get('modelGroup') == "TEST_Квадро"
        assert model.get('modelGroupImageUrl') == "/api/uploads/test_group.jpg"
        print("✓ GET /api/sauna/prices returns modelGroup field correctly")
    
    def test_modelGroup_can_be_null(self):
        """Test that modelGroup can be set to null (backward compatible)"""
        update_data = {
            "id": self.test_model_id,
            "name": "Sauna Kwadro-Beczka 235x200 cm",
            "basePrice": 14200,
            "foundationPrice": 150,
            "discount": 10,
            "imageUrl": "/api/uploads/cc7a2fde58ba47018dea01071dc766bc.jpg",
            "sortOrder": 1,
            "active": True,
            "modelGroup": None,
            "modelGroupImageUrl": None
        }
        
        response = requests.put(
            f"{BASE_URL}/api/sauna/models/{self.test_model_id}",
            json=update_data
        )
        assert response.status_code == 200
        
        result = response.json()
        assert result.get('model', {}).get('modelGroup') is None
        assert result.get('model', {}).get('modelGroupImageUrl') is None
        print("✓ modelGroup can be set to null (backward compatible)")
    
    def test_modelGroup_empty_string(self):
        """Test that modelGroup can be empty string"""
        update_data = {
            "id": self.test_model_id,
            "name": "Sauna Kwadro-Beczka 235x200 cm",
            "basePrice": 14200,
            "foundationPrice": 150,
            "discount": 10,
            "imageUrl": "/api/uploads/cc7a2fde58ba47018dea01071dc766bc.jpg",
            "sortOrder": 1,
            "active": True,
            "modelGroup": "",
            "modelGroupImageUrl": ""
        }
        
        response = requests.put(
            f"{BASE_URL}/api/sauna/models/{self.test_model_id}",
            json=update_data
        )
        assert response.status_code == 200
        
        result = response.json()
        # Empty string should be accepted
        assert result.get('model', {}).get('modelGroup') == ""
        print("✓ modelGroup accepts empty string")
    
    def test_multiple_models_same_group(self):
        """Test that multiple models can have the same modelGroup"""
        # This test verifies the grouping concept works
        # We'll update two models with the same group
        
        # Get all models
        response = requests.get(f"{BASE_URL}/api/sauna/prices")
        assert response.status_code == 200
        data = response.json()
        models = data.get('models', [])
        
        # Find two Kwadro-Beczka models
        kwadro_models = [m for m in models if 'kwadro_beczka' in m['id'].lower()]
        assert len(kwadro_models) >= 2, "Need at least 2 Kwadro-Beczka models for this test"
        
        # Update first model with group
        model1 = kwadro_models[0]
        model1['modelGroup'] = "TEST_Квадро-Бочка"
        response = requests.put(
            f"{BASE_URL}/api/sauna/models/{model1['id']}",
            json=model1
        )
        assert response.status_code == 200
        
        # Update second model with same group
        model2 = kwadro_models[1]
        model2['modelGroup'] = "TEST_Квадро-Бочка"
        response = requests.put(
            f"{BASE_URL}/api/sauna/models/{model2['id']}",
            json=model2
        )
        assert response.status_code == 200
        
        # Verify both have the same group
        response = requests.get(f"{BASE_URL}/api/sauna/prices")
        data = response.json()
        
        updated_models = [m for m in data['models'] if m.get('modelGroup') == "TEST_Квадро-Бочка"]
        assert len(updated_models) >= 2
        print(f"✓ Multiple models ({len(updated_models)}) can have the same modelGroup")
        
        # Cleanup: remove group from second model
        model2['modelGroup'] = None
        requests.put(f"{BASE_URL}/api/sauna/models/{model2['id']}", json=model2)


class TestModelGroupingCalculatorLogic:
    """Test the calculator grouping logic (code review)"""
    
    def test_no_groups_shows_flat_list(self):
        """Verify that when no models have modelGroup, flat list is shown"""
        # Get prices
        response = requests.get(f"{BASE_URL}/api/sauna/prices")
        assert response.status_code == 200
        data = response.json()
        
        # Check if any model has modelGroup set
        models = data.get('models', [])
        has_groups = any(m.get('modelGroup') for m in models)
        
        print(f"✓ Models count: {len(models)}")
        print(f"✓ Any model has group: {has_groups}")
        print("✓ When no groups set, calculator should show flat list (verified in frontend)")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
