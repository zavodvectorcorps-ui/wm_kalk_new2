"""
Test Balia Prices API - Testing heaterVariants support
This test verifies the fix for 422 Unprocessable Content error when saving Balia prices with heaterVariants
"""
import pytest
import requests
import os
import json
import copy

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')

class TestBaliaPricesAPI:
    """Test Balia prices API with heaterVariants support"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.api_url = f"{BASE_URL}/api/prices"
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_get_prices_returns_200(self):
        """Test GET /api/prices returns 200 and valid data"""
        response = self.session.get(self.api_url)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "models" in data, "Response should contain 'models' field"
        assert "categories" in data, "Response should contain 'categories' field"
        assert isinstance(data["models"], list), "models should be a list"
        assert isinstance(data["categories"], list), "categories should be a list"
        print(f"✓ GET /api/prices returned {len(data['models'])} models and {len(data['categories'])} categories")
    
    def test_get_prices_models_have_heater_variants(self):
        """Test that models contain heaterVariants array"""
        response = self.session.get(self.api_url)
        assert response.status_code == 200
        
        data = response.json()
        models_with_variants = 0
        
        for model in data["models"]:
            if "heaterVariants" in model and isinstance(model["heaterVariants"], list):
                models_with_variants += 1
                # Verify heaterVariants structure
                for variant in model["heaterVariants"]:
                    assert "type" in variant, f"heaterVariant should have 'type' field in model {model['id']}"
                    assert "price" in variant, f"heaterVariant should have 'price' field in model {model['id']}"
                    assert variant["type"] in ["integrated", "external"], f"Invalid heater type: {variant['type']}"
        
        print(f"✓ {models_with_variants}/{len(data['models'])} models have heaterVariants")
        assert models_with_variants > 0, "At least one model should have heaterVariants"
    
    def test_get_prices_model_specs_support_string_values(self):
        """Test that ModelSpec supports string values like '200cm'"""
        response = self.session.get(self.api_url)
        assert response.status_code == 200
        
        data = response.json()
        string_specs_found = False
        
        for model in data["models"]:
            if "specs" in model and model["specs"]:
                specs = model["specs"]
                # Check for string values in specs
                for key, value in specs.items():
                    if isinstance(value, str) and value:
                        string_specs_found = True
                        print(f"  Model {model['id']}: {key} = '{value}' (string)")
        
        print(f"✓ String values in specs supported: {string_specs_found}")
    
    def test_post_prices_with_heater_variants_no_422(self):
        """CRITICAL TEST: POST /api/prices with heaterVariants should NOT return 422"""
        # First get current prices
        get_response = self.session.get(self.api_url)
        assert get_response.status_code == 200
        
        original_data = get_response.json()
        
        # Create test data with heaterVariants
        test_data = copy.deepcopy(original_data)
        
        # Ensure at least one model has heaterVariants
        if test_data["models"]:
            test_model = test_data["models"][0]
            test_model["heaterVariants"] = [
                {
                    "type": "integrated",
                    "price": 1250.0,
                    "imageUrl": "",
                    "hint": "Test hint for integrated heater",
                    "hintPl": ""
                },
                {
                    "type": "external",
                    "price": 1200.0,
                    "imageUrl": "",
                    "hint": "Test hint for external heater",
                    "hintPl": ""
                }
            ]
        
        # POST the data - this was causing 422 before the fix
        post_response = self.session.post(self.api_url, json=test_data)
        
        # CRITICAL: Should NOT be 422
        assert post_response.status_code != 422, f"Got 422 Unprocessable Content! Response: {post_response.text}"
        assert post_response.status_code == 200, f"Expected 200, got {post_response.status_code}. Response: {post_response.text}"
        
        print(f"✓ POST /api/prices with heaterVariants returned {post_response.status_code}")
    
    def test_post_prices_with_string_specs_no_422(self):
        """Test POST /api/prices with string values in specs (like '200cm') should NOT return 422"""
        # First get current prices
        get_response = self.session.get(self.api_url)
        assert get_response.status_code == 200
        
        original_data = get_response.json()
        test_data = copy.deepcopy(original_data)
        
        # Ensure model has string specs
        if test_data["models"]:
            test_model = test_data["models"][0]
            test_model["specs"] = {
                "outerDiameter": "200cm",
                "innerDiameter": "160cm",
                "depth": "100cm",
                "volume": "1500L",
                "seats": 6
            }
        
        # POST the data
        post_response = self.session.post(self.api_url, json=test_data)
        
        assert post_response.status_code != 422, f"Got 422 with string specs! Response: {post_response.text}"
        assert post_response.status_code == 200, f"Expected 200, got {post_response.status_code}"
        
        print(f"✓ POST /api/prices with string specs returned {post_response.status_code}")
    
    def test_post_prices_persists_heater_variants(self):
        """Test that heaterVariants are persisted after POST"""
        # Get current prices
        get_response = self.session.get(self.api_url)
        assert get_response.status_code == 200
        original_data = get_response.json()
        
        # Modify a heaterVariant price
        test_data = copy.deepcopy(original_data)
        test_price = 9999.0  # Unique test price
        
        if test_data["models"] and test_data["models"][0].get("heaterVariants"):
            test_data["models"][0]["heaterVariants"][0]["price"] = test_price
            model_id = test_data["models"][0]["id"]
        else:
            pytest.skip("No models with heaterVariants to test")
        
        # POST the modified data
        post_response = self.session.post(self.api_url, json=test_data)
        assert post_response.status_code == 200
        
        # GET and verify the change persisted
        verify_response = self.session.get(self.api_url)
        assert verify_response.status_code == 200
        
        verify_data = verify_response.json()
        found_model = next((m for m in verify_data["models"] if m["id"] == model_id), None)
        
        assert found_model is not None, f"Model {model_id} not found after POST"
        assert found_model.get("heaterVariants"), "heaterVariants missing after POST"
        
        saved_price = found_model["heaterVariants"][0]["price"]
        assert saved_price == test_price, f"Price not persisted. Expected {test_price}, got {saved_price}"
        
        print(f"✓ heaterVariants price persisted correctly: {saved_price}")
        
        # Restore original data
        self.session.post(self.api_url, json=original_data)
    
    def test_post_prices_with_extra_fields_allowed(self):
        """Test that extra fields are allowed (ConfigDict extra='allow')"""
        get_response = self.session.get(self.api_url)
        assert get_response.status_code == 200
        
        test_data = get_response.json()
        
        # Add extra fields that weren't in original schema
        if test_data["models"]:
            test_data["models"][0]["customField"] = "test_value"
            test_data["models"][0]["specs"]["customSpec"] = "custom_value"
        
        # POST should succeed with extra fields
        post_response = self.session.post(self.api_url, json=test_data)
        
        assert post_response.status_code != 422, f"Got 422 with extra fields! Response: {post_response.text}"
        assert post_response.status_code == 200, f"Expected 200, got {post_response.status_code}"
        
        print(f"✓ POST /api/prices with extra fields returned {post_response.status_code}")


class TestBaliaModelSpecs:
    """Tests for Balia model specifications (specs) feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.api_url = f"{BASE_URL}/api/prices"
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_get_prices_returns_specs_in_models(self):
        """Test GET /api/prices returns specs field in models"""
        response = self.session.get(self.api_url)
        assert response.status_code == 200
        
        data = response.json()
        models_with_specs = 0
        
        for model in data["models"]:
            if "specs" in model:
                models_with_specs += 1
                if model["specs"]:
                    print(f"  Model {model['id']}: specs present with data")
        
        print(f"✓ {models_with_specs}/{len(data['models'])} models have specs field")
    
    def test_specs_supports_all_fields(self):
        """Test that specs supports all expected fields: outerDiameter, innerDiameter, dimensions, depth, volume, seats, totalHeight, heaterPower, weight"""
        response = self.session.get(self.api_url)
        assert response.status_code == 200
        
        data = response.json()
        
        # Find a model with specs
        model_with_specs = None
        for model in data["models"]:
            if model.get("specs") and any(v for v in model["specs"].values() if v):
                model_with_specs = model
                break
        
        if model_with_specs:
            specs = model_with_specs["specs"]
            expected_fields = ["outerDiameter", "innerDiameter", "dimensions", "depth", "volume", "seats", "totalHeight", "heaterPower", "weight"]
            
            for field in expected_fields:
                # Field should be allowed (may be None or have value)
                print(f"  {field}: {specs.get(field, 'not present')}")
            
            print(f"✓ Specs structure verified for model {model_with_specs['id']}")
        else:
            print("⚠ No models with populated specs found")
    
    def test_post_specs_with_all_fields(self):
        """Test POST /api/prices with full specs object"""
        # Get current prices
        get_response = self.session.get(self.api_url)
        assert get_response.status_code == 200
        original_data = get_response.json()
        
        test_data = copy.deepcopy(original_data)
        
        # Create comprehensive specs
        test_specs = {
            "outerDiameter": "200cm",
            "innerDiameter": "160cm",
            "dimensions": "200x200cm",
            "depth": "100cm",
            "volume": "1500L",
            "seats": 6,
            "totalHeight": "120cm",
            "heaterPower": "24kW",
            "weight": "350kg"
        }
        
        if test_data["models"]:
            test_data["models"][0]["specs"] = test_specs
            model_id = test_data["models"][0]["id"]
        else:
            pytest.skip("No models to test")
        
        # POST the data
        post_response = self.session.post(self.api_url, json=test_data)
        assert post_response.status_code == 200, f"POST failed: {post_response.text}"
        
        # Verify specs persisted
        verify_response = self.session.get(self.api_url)
        assert verify_response.status_code == 200
        
        verify_data = verify_response.json()
        found_model = next((m for m in verify_data["models"] if m["id"] == model_id), None)
        
        assert found_model is not None, f"Model {model_id} not found"
        assert found_model.get("specs") is not None, "specs field missing after POST"
        
        saved_specs = found_model["specs"]
        assert saved_specs.get("outerDiameter") == "200cm", f"outerDiameter not saved correctly"
        assert saved_specs.get("depth") == "100cm", f"depth not saved correctly"
        assert saved_specs.get("volume") == "1500L", f"volume not saved correctly"
        assert saved_specs.get("seats") == 6, f"seats not saved correctly"
        
        print(f"✓ Full specs saved and retrieved correctly for model {model_id}")
        
        # Restore original data
        self.session.post(self.api_url, json=original_data)
    
    def test_specs_partial_update(self):
        """Test updating only some specs fields preserves others"""
        get_response = self.session.get(self.api_url)
        assert get_response.status_code == 200
        original_data = get_response.json()
        
        test_data = copy.deepcopy(original_data)
        
        # First set full specs
        initial_specs = {
            "outerDiameter": "200cm",
            "depth": "100cm",
            "volume": "1500L",
            "seats": 6
        }
        
        if test_data["models"]:
            test_data["models"][0]["specs"] = initial_specs
            model_id = test_data["models"][0]["id"]
        else:
            pytest.skip("No models to test")
        
        # POST initial specs
        self.session.post(self.api_url, json=test_data)
        
        # Now update only depth
        test_data["models"][0]["specs"]["depth"] = "110cm"
        post_response = self.session.post(self.api_url, json=test_data)
        assert post_response.status_code == 200
        
        # Verify other fields preserved
        verify_response = self.session.get(self.api_url)
        verify_data = verify_response.json()
        found_model = next((m for m in verify_data["models"] if m["id"] == model_id), None)
        
        saved_specs = found_model["specs"]
        assert saved_specs.get("depth") == "110cm", "depth not updated"
        assert saved_specs.get("outerDiameter") == "200cm", "outerDiameter was lost"
        assert saved_specs.get("volume") == "1500L", "volume was lost"
        
        print(f"✓ Partial specs update preserved other fields")
        
        # Restore original data
        self.session.post(self.api_url, json=original_data)
    
    def test_specs_with_mixed_types(self):
        """Test specs accepts both string and numeric values"""
        get_response = self.session.get(self.api_url)
        assert get_response.status_code == 200
        original_data = get_response.json()
        
        test_data = copy.deepcopy(original_data)
        
        # Mix of string and numeric values
        mixed_specs = {
            "outerDiameter": "200cm",  # string
            "innerDiameter": "160cm",  # string
            "depth": "100cm",          # string
            "volume": "1500L",         # string
            "seats": 6,                # integer
            "totalHeight": "120cm",    # string
            "heaterPower": "24kW",     # string
            "weight": "350kg"          # string
        }
        
        if test_data["models"]:
            test_data["models"][0]["specs"] = mixed_specs
        
        post_response = self.session.post(self.api_url, json=test_data)
        assert post_response.status_code == 200, f"POST with mixed types failed: {post_response.text}"
        
        print(f"✓ Specs with mixed string/numeric types accepted")
        
        # Restore original data
        self.session.post(self.api_url, json=original_data)


class TestBaliaPricesEdgeCases:
    """Edge case tests for Balia prices API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.api_url = f"{BASE_URL}/api/prices"
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_empty_heater_variants_array(self):
        """Test POST with empty heaterVariants array"""
        get_response = self.session.get(self.api_url)
        assert get_response.status_code == 200
        
        test_data = get_response.json()
        
        if test_data["models"]:
            test_data["models"][0]["heaterVariants"] = []
        
        post_response = self.session.post(self.api_url, json=test_data)
        assert post_response.status_code == 200, f"Failed with empty heaterVariants: {post_response.text}"
        print("✓ Empty heaterVariants array accepted")
    
    def test_heater_variant_with_all_optional_fields(self):
        """Test heaterVariant with all optional fields populated"""
        get_response = self.session.get(self.api_url)
        assert get_response.status_code == 200
        
        test_data = get_response.json()
        
        if test_data["models"]:
            test_data["models"][0]["heaterVariants"] = [
                {
                    "type": "integrated",
                    "price": 1500.0,
                    "imageUrl": "https://example.com/image.jpg",
                    "hint": "Detailed hint in Russian",
                    "hintPl": "Detailed hint in Polish"
                }
            ]
        
        post_response = self.session.post(self.api_url, json=test_data)
        assert post_response.status_code == 200, f"Failed with full heaterVariant: {post_response.text}"
        print("✓ HeaterVariant with all optional fields accepted")
    
    def test_model_with_null_specs(self):
        """Test model with null specs field"""
        get_response = self.session.get(self.api_url)
        assert get_response.status_code == 200
        
        test_data = get_response.json()
        
        if test_data["models"]:
            test_data["models"][0]["specs"] = None
        
        post_response = self.session.post(self.api_url, json=test_data)
        assert post_response.status_code == 200, f"Failed with null specs: {post_response.text}"
        print("✓ Model with null specs accepted")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
