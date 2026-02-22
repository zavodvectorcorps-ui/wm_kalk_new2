"""
Test Variant Conditions (Warunki widoczności) for Layout Configurator
Features:
- Save variant with conditions (POST /api/layout-configurator/options/{option_id}/variants)
- Update variant conditions (PUT /api/layout-configurator/options/{option_id}/variants/{variant_id})
- Conditions are stored and returned correctly
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestVariantConditions:
    """Test variant conditions (visibility conditions) feature"""
    
    option1_id = None  # Typ pieca
    option2_id = None  # Położenie
    option3_id = None  # Pozycja zakładki
    variant_external_id = None
    variant_left_id = None
    variant_with_conditions_id = None
    
    def test_01_create_option_typ_pieca(self):
        """Create first option: Typ pieca (heater type)"""
        form_data = {
            "name": "TEST_Typ pieca",
            "namePl": "TEST_Typ pieca",
            "nameRu": "TEST_Тип печи"
        }
        response = requests.post(
            f"{BASE_URL}/api/layout-configurator/options",
            data=form_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}. Body: {response.text}"
        data = response.json()
        TestVariantConditions.option1_id = data["id"]
        print(f"✓ Created option 'Typ pieca' with id: {data['id']}")
    
    def test_02_create_option_polozenie(self):
        """Create second option: Położenie (position)"""
        form_data = {
            "name": "TEST_Położenie",
            "namePl": "TEST_Położenie",
            "nameRu": "TEST_Расположение"
        }
        response = requests.post(
            f"{BASE_URL}/api/layout-configurator/options",
            data=form_data
        )
        assert response.status_code == 200
        data = response.json()
        TestVariantConditions.option2_id = data["id"]
        print(f"✓ Created option 'Położenie' with id: {data['id']}")
    
    def test_03_create_option_pozycja_zakladki(self):
        """Create third option: Pozycja zakładki (bookmark position)"""
        form_data = {
            "name": "TEST_Pozycja zakładki",
            "namePl": "TEST_Pozycja zakładki",
            "nameRu": "TEST_Позиция закладки"
        }
        response = requests.post(
            f"{BASE_URL}/api/layout-configurator/options",
            data=form_data
        )
        assert response.status_code == 200
        data = response.json()
        TestVariantConditions.option3_id = data["id"]
        print(f"✓ Created option 'Pozycja zakładki' with id: {data['id']}")
    
    def test_04_add_variant_wewnetrzny(self):
        """Add variant 'Wewnętrzny' (internal) to Typ pieca"""
        element_configs = [{
            "elementType": "heater",
            "matchBy": "type",
            "properties": {"left": 100, "top": 100, "visible": True}
        }]
        form_data = {
            "name": "TEST_Wewnętrzny",
            "namePl": "TEST_Wewnętrzny",
            "nameRu": "TEST_Внутренний",
            "elementConfigs": json.dumps(element_configs)
        }
        response = requests.post(
            f"{BASE_URL}/api/layout-configurator/options/{TestVariantConditions.option1_id}/variants",
            data=form_data
        )
        assert response.status_code == 200
        print(f"✓ Created variant 'Wewnętrzny'")
    
    def test_05_add_variant_zewnetrzny(self):
        """Add variant 'Zewnętrzny' (external) to Typ pieca"""
        element_configs = [{
            "elementType": "heater",
            "matchBy": "type",
            "properties": {"left": 50, "top": 50, "visible": True}
        }]
        form_data = {
            "name": "TEST_Zewnętrzny",
            "namePl": "TEST_Zewnętrzny",
            "nameRu": "TEST_Внешний",
            "elementConfigs": json.dumps(element_configs)
        }
        response = requests.post(
            f"{BASE_URL}/api/layout-configurator/options/{TestVariantConditions.option1_id}/variants",
            data=form_data
        )
        assert response.status_code == 200
        data = response.json()
        TestVariantConditions.variant_external_id = data["variant"]["id"]
        print(f"✓ Created variant 'Zewnętrzny' with id: {data['variant']['id']}")
    
    def test_06_add_position_variants(self):
        """Add position variants: Prosto, Lewo, Prawo"""
        positions = [
            ("TEST_Prosto", {"left": 200, "top": 200}),
            ("TEST_Lewo", {"left": 100, "top": 200}),
            ("TEST_Prawo", {"left": 300, "top": 200})
        ]
        
        for name, props in positions:
            element_configs = [{
                "elementType": "heater",
                "matchBy": "type",
                "properties": {**props, "visible": True}
            }]
            form_data = {
                "name": name,
                "namePl": name,
                "elementConfigs": json.dumps(element_configs)
            }
            response = requests.post(
                f"{BASE_URL}/api/layout-configurator/options/{TestVariantConditions.option2_id}/variants",
                data=form_data
            )
            assert response.status_code == 200
            
            if name == "TEST_Lewo":
                TestVariantConditions.variant_left_id = response.json()["variant"]["id"]
        
        print(f"✓ Created position variants: Prosto, Lewo, Prawo")
    
    def test_07_create_variant_with_conditions(self):
        """Create variant with conditions (Zewnętrzny + Lewo)"""
        option1_id = TestVariantConditions.option1_id
        option2_id = TestVariantConditions.option2_id
        variant_external_id = TestVariantConditions.variant_external_id
        variant_left_id = TestVariantConditions.variant_left_id
        
        # Conditions: Typ pieca = Zewnętrzny AND Położenie = Lewo
        conditions = [
            {"optionId": option1_id, "variantId": variant_external_id},
            {"optionId": option2_id, "variantId": variant_left_id}
        ]
        
        element_configs = [{
            "elementType": "wood_holder",
            "matchBy": "type",
            "properties": {"left": 150, "top": 150, "visible": True}
        }]
        
        form_data = {
            "name": "TEST_Pozycja 1",
            "namePl": "TEST_Pozycja 1",
            "nameRu": "TEST_Позиция 1",
            "elementConfigs": json.dumps(element_configs),
            "conditions": json.dumps(conditions)
        }
        
        response = requests.post(
            f"{BASE_URL}/api/layout-configurator/options/{TestVariantConditions.option3_id}/variants",
            data=form_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}. Body: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "variant" in data
        variant = data["variant"]
        
        # Verify conditions were saved
        assert "conditions" in variant, "Variant should have 'conditions' field"
        assert len(variant["conditions"]) == 2, f"Expected 2 conditions, got {len(variant['conditions'])}"
        
        # Verify condition structure
        for cond in variant["conditions"]:
            assert "optionId" in cond, "Condition should have 'optionId'"
            assert "variantId" in cond, "Condition should have 'variantId'"
        
        TestVariantConditions.variant_with_conditions_id = variant["id"]
        print(f"✓ Created variant with 2 conditions: {variant['id']}")
    
    def test_08_verify_conditions_persisted(self):
        """GET options and verify conditions are returned correctly"""
        response = requests.get(f"{BASE_URL}/api/layout-configurator/options")
        assert response.status_code == 200
        
        options = response.json()["options"]
        
        # Find option3 (Pozycja zakładki)
        option3 = next((o for o in options if o["id"] == TestVariantConditions.option3_id), None)
        assert option3 is not None, "Option 'Pozycja zakładki' not found"
        
        # Find variant with conditions
        variant = next(
            (v for v in option3.get("variants", []) if v["id"] == TestVariantConditions.variant_with_conditions_id),
            None
        )
        assert variant is not None, "Variant with conditions not found"
        
        # Verify conditions
        assert "conditions" in variant
        assert len(variant["conditions"]) == 2
        
        # Check condition values
        condition_option_ids = [c["optionId"] for c in variant["conditions"]]
        assert TestVariantConditions.option1_id in condition_option_ids, "Typ pieca condition missing"
        assert TestVariantConditions.option2_id in condition_option_ids, "Położenie condition missing"
        
        print(f"✓ Conditions persisted and returned correctly")
    
    def test_09_update_variant_conditions(self):
        """Update variant to change conditions"""
        option3_id = TestVariantConditions.option3_id
        variant_id = TestVariantConditions.variant_with_conditions_id
        
        # New conditions - only one condition now
        new_conditions = [
            {"optionId": TestVariantConditions.option1_id, "variantId": TestVariantConditions.variant_external_id}
        ]
        
        form_data = {
            "conditions": json.dumps(new_conditions)
        }
        
        response = requests.put(
            f"{BASE_URL}/api/layout-configurator/options/{option3_id}/variants/{variant_id}",
            data=form_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}. Body: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        print(f"✓ Variant conditions updated")
    
    def test_10_verify_updated_conditions(self):
        """Verify conditions were updated"""
        response = requests.get(f"{BASE_URL}/api/layout-configurator/options")
        assert response.status_code == 200
        
        options = response.json()["options"]
        option3 = next((o for o in options if o["id"] == TestVariantConditions.option3_id), None)
        variant = next(
            (v for v in option3.get("variants", []) if v["id"] == TestVariantConditions.variant_with_conditions_id),
            None
        )
        
        assert variant is not None
        assert len(variant["conditions"]) == 1, f"Expected 1 condition, got {len(variant['conditions'])}"
        assert variant["conditions"][0]["optionId"] == TestVariantConditions.option1_id
        
        print(f"✓ Updated conditions verified (now 1 condition)")
    
    def test_11_create_variant_without_conditions(self):
        """Create variant without conditions - should work normally"""
        element_configs = [{
            "elementType": "wood_holder",
            "matchBy": "type",
            "properties": {"left": 200, "top": 200, "visible": True}
        }]
        
        form_data = {
            "name": "TEST_Pozycja 2 (bez warunków)",
            "namePl": "TEST_Pozycja 2 (bez warunków)",
            "elementConfigs": json.dumps(element_configs)
            # No conditions field
        }
        
        response = requests.post(
            f"{BASE_URL}/api/layout-configurator/options/{TestVariantConditions.option3_id}/variants",
            data=form_data
        )
        assert response.status_code == 200
        
        data = response.json()
        variant = data["variant"]
        
        # Conditions should be empty array or not present
        conditions = variant.get("conditions", [])
        assert isinstance(conditions, list)
        assert len(conditions) == 0, "Variant without conditions should have empty conditions array"
        
        print(f"✓ Variant without conditions created successfully")
    
    def test_12_cleanup_test_data(self):
        """Delete all test options"""
        for option_id in [TestVariantConditions.option1_id, TestVariantConditions.option2_id, TestVariantConditions.option3_id]:
            if option_id:
                response = requests.delete(f"{BASE_URL}/api/layout-configurator/options/{option_id}")
                assert response.status_code == 200, f"Failed to delete option {option_id}"
        
        # Verify cleanup
        response = requests.get(f"{BASE_URL}/api/layout-configurator/options")
        options = response.json()["options"]
        test_options = [o for o in options if o["name"].startswith("TEST_")]
        assert len(test_options) == 0, f"Test options not cleaned up: {[o['name'] for o in test_options]}"
        
        print(f"✓ All test data cleaned up")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
