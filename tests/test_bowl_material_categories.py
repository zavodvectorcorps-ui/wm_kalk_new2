"""
Test bowl_material category with dependent fiberglass_color and acrylic_color categories.
Tests:
1. GET /api/prices returns bowl_material, fiberglass_color, acrylic_color categories
2. fiberglass_color has 15 options and dependsOn=bowl_material, dependsOnValue=fiberglass
3. acrylic_color has 7 options and dependsOn=bowl_material, dependsOnValue=acrylic
4. bowl_material has 2 options (fiberglass, acrylic)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestBowlMaterialCategories:
    """Test bowl_material and dependent color categories"""
    
    def test_health_check(self):
        """Test backend health"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
    
    def test_get_prices_returns_bowl_material_category(self):
        """Test that GET /api/prices returns bowl_material category"""
        response = requests.get(f"{BASE_URL}/api/prices")
        assert response.status_code == 200
        data = response.json()
        
        categories = data.get("categories", [])
        bowl_material = next((c for c in categories if c.get("id") == "bowl_material"), None)
        
        assert bowl_material is not None, "bowl_material category not found"
        assert bowl_material.get("nameRu") == "Материал чаши"
        assert bowl_material.get("namePl") == "Materiał wanny"
        assert bowl_material.get("inputType") == "radio"
        assert bowl_material.get("displayType") == "tiles"
    
    def test_bowl_material_has_two_options(self):
        """Test that bowl_material has fiberglass and acrylic options"""
        response = requests.get(f"{BASE_URL}/api/prices")
        assert response.status_code == 200
        data = response.json()
        
        categories = data.get("categories", [])
        bowl_material = next((c for c in categories if c.get("id") == "bowl_material"), None)
        
        assert bowl_material is not None
        options = bowl_material.get("options", [])
        assert len(options) == 2, f"Expected 2 options, got {len(options)}"
        
        option_ids = [o.get("id") for o in options]
        assert "fiberglass" in option_ids, "fiberglass option not found"
        assert "acrylic" in option_ids, "acrylic option not found"
        
        # Check fiberglass option
        fiberglass = next((o for o in options if o.get("id") == "fiberglass"), None)
        assert fiberglass.get("nameRu") == "Глассфайбер"
        assert fiberglass.get("namePl") == "Włókno szklane"
        
        # Check acrylic option
        acrylic = next((o for o in options if o.get("id") == "acrylic"), None)
        assert acrylic.get("nameRu") == "Акрил"
        assert acrylic.get("namePl") == "Akryl"
    
    def test_fiberglass_color_category_exists(self):
        """Test that fiberglass_color category exists with correct dependencies"""
        response = requests.get(f"{BASE_URL}/api/prices")
        assert response.status_code == 200
        data = response.json()
        
        categories = data.get("categories", [])
        fg_color = next((c for c in categories if c.get("id") == "fiberglass_color"), None)
        
        assert fg_color is not None, "fiberglass_color category not found"
        assert fg_color.get("nameRu") == "Цвет Глассфайбер"
        assert fg_color.get("namePl") == "Kolor włókna szklanego"
        assert fg_color.get("dependsOn") == "bowl_material"
        assert fg_color.get("dependsOnValue") == "fiberglass"
    
    def test_fiberglass_color_has_15_options(self):
        """Test that fiberglass_color has exactly 15 color options"""
        response = requests.get(f"{BASE_URL}/api/prices")
        assert response.status_code == 200
        data = response.json()
        
        categories = data.get("categories", [])
        fg_color = next((c for c in categories if c.get("id") == "fiberglass_color"), None)
        
        assert fg_color is not None
        options = fg_color.get("options", [])
        assert len(options) == 15, f"Expected 15 fiberglass colors, got {len(options)}"
        
        # Verify some expected colors
        option_ids = [o.get("id") for o in options]
        expected_colors = ["fg_white", "fg_ivory", "fg_blue", "fg_gray", "fg_pearl_red", 
                          "fg_pearl_blue", "fg_pearl_brown", "fg_pearl_gray", "fg_pearl_white",
                          "fg_galaxy", "fg_snowflake", "fg_emerald", "fg_black_gold", 
                          "fg_black_pink", "fg_black_silver"]
        
        for color_id in expected_colors:
            assert color_id in option_ids, f"Color {color_id} not found in fiberglass_color options"
    
    def test_acrylic_color_category_exists(self):
        """Test that acrylic_color category exists with correct dependencies"""
        response = requests.get(f"{BASE_URL}/api/prices")
        assert response.status_code == 200
        data = response.json()
        
        categories = data.get("categories", [])
        ac_color = next((c for c in categories if c.get("id") == "acrylic_color"), None)
        
        assert ac_color is not None, "acrylic_color category not found"
        assert ac_color.get("nameRu") == "Цвет Акрил"
        assert ac_color.get("namePl") == "Kolor akrylu"
        assert ac_color.get("dependsOn") == "bowl_material"
        assert ac_color.get("dependsOnValue") == "acrylic"
    
    def test_acrylic_color_has_7_options(self):
        """Test that acrylic_color has exactly 7 color options"""
        response = requests.get(f"{BASE_URL}/api/prices")
        assert response.status_code == 200
        data = response.json()
        
        categories = data.get("categories", [])
        ac_color = next((c for c in categories if c.get("id") == "acrylic_color"), None)
        
        assert ac_color is not None
        options = ac_color.get("options", [])
        assert len(options) == 7, f"Expected 7 acrylic colors, got {len(options)}"
        
        # Verify expected colors
        option_ids = [o.get("id") for o in options]
        expected_colors = ["ac_white", "ac_green_marble", "ac_brown_marble", "ac_blue_marble",
                          "ac_white_marble", "ac_coffee_marble", "ac_black_marble"]
        
        for color_id in expected_colors:
            assert color_id in option_ids, f"Color {color_id} not found in acrylic_color options"
    
    def test_category_sort_order(self):
        """Test that categories are in correct sort order"""
        response = requests.get(f"{BASE_URL}/api/prices")
        assert response.status_code == 200
        data = response.json()
        
        categories = data.get("categories", [])
        bowl_material = next((c for c in categories if c.get("id") == "bowl_material"), None)
        fg_color = next((c for c in categories if c.get("id") == "fiberglass_color"), None)
        ac_color = next((c for c in categories if c.get("id") == "acrylic_color"), None)
        
        # bowl_material should come before color categories
        assert bowl_material.get("sortOrder") <= fg_color.get("sortOrder")
        assert bowl_material.get("sortOrder") <= ac_color.get("sortOrder")
    
    def test_dependent_categories_have_no_parent_dependency(self):
        """Test that bowl_material has no dependsOn (it's the parent)"""
        response = requests.get(f"{BASE_URL}/api/prices")
        assert response.status_code == 200
        data = response.json()
        
        categories = data.get("categories", [])
        bowl_material = next((c for c in categories if c.get("id") == "bowl_material"), None)
        
        assert bowl_material is not None
        assert bowl_material.get("dependsOn") is None, "bowl_material should not depend on any category"
        assert bowl_material.get("dependsOnValue") is None


class TestPriceCalculation:
    """Test that hidden categories don't affect price calculation"""
    
    def test_all_color_options_have_price_field(self):
        """Test that all color options have price field (even if 0)"""
        response = requests.get(f"{BASE_URL}/api/prices")
        assert response.status_code == 200
        data = response.json()
        
        categories = data.get("categories", [])
        
        for cat_id in ["fiberglass_color", "acrylic_color"]:
            category = next((c for c in categories if c.get("id") == cat_id), None)
            if category:
                for option in category.get("options", []):
                    assert "price" in option, f"Option {option.get('id')} missing price field"
                    assert isinstance(option.get("price"), (int, float)), f"Option {option.get('id')} price is not a number"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
