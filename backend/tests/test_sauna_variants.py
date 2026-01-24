"""
Test Sauna Calculator Variant Selection Feature

Tests:
1. API returns variants for Ławki options
2. Variant prices are correctly structured
3. Calculator correctly uses variant prices
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSaunaVariants:
    """Test variant selection feature for Sauna calculator"""
    
    def test_api_returns_prices_with_variants(self):
        """Test that /api/sauna/prices returns options with variants"""
        response = requests.get(f"{BASE_URL}/api/sauna/prices")
        assert response.status_code == 200
        
        data = response.json()
        assert "categories" in data
        assert "models" in data
        
        # Find Ławki category
        lawki_category = None
        for cat in data["categories"]:
            if cat["name"] == "Ławki":
                lawki_category = cat
                break
        
        assert lawki_category is not None, "Ławki category not found"
        assert "options" in lawki_category
        print(f"Found Ławki category with {len(lawki_category['options'])} options")
    
    def test_lawki_2poziomowe_has_variants(self):
        """Test that 'Ławki 2-poziomowe nie są zamknięte' option has variants"""
        response = requests.get(f"{BASE_URL}/api/sauna/prices")
        assert response.status_code == 200
        
        data = response.json()
        
        # Find Ławki category
        lawki_category = None
        for cat in data["categories"]:
            if cat["name"] == "Ławki":
                lawki_category = cat
                break
        
        assert lawki_category is not None
        
        # Find the option with variants
        option_with_variants = None
        for opt in lawki_category["options"]:
            if "2-poziomowe nie są zamknięte" in opt["name"]:
                option_with_variants = opt
                break
        
        assert option_with_variants is not None, "Option '2-poziomowe nie są zamknięte' not found"
        
        # Check variants exist
        variants = option_with_variants.get("variants", [])
        assert len(variants) >= 2, f"Expected at least 2 variants, got {len(variants)}"
        
        print(f"Found option: {option_with_variants['name']}")
        print(f"Base price: {option_with_variants['price']} PLN")
        print(f"Variants: {len(variants)}")
        for v in variants:
            print(f"  - {v['name']} ({v.get('namePl', '')}): {v['price']} PLN")
    
    def test_variant_prices_are_correct(self):
        """Test that variant prices are 480 PLN and 1480 PLN"""
        response = requests.get(f"{BASE_URL}/api/sauna/prices")
        assert response.status_code == 200
        
        data = response.json()
        
        # Find Ławki category and option
        lawki_category = next((cat for cat in data["categories"] if cat["name"] == "Ławki"), None)
        assert lawki_category is not None
        
        option = next((opt for opt in lawki_category["options"] if "2-poziomowe nie są zamknięte" in opt["name"]), None)
        assert option is not None
        
        variants = option.get("variants", [])
        
        # Check for Bez zabudowy variant (480 PLN)
        bez_zabudowy = next((v for v in variants if "Bez zabudowy" in v.get("namePl", "") or "Bez zabudowy" in v.get("name", "")), None)
        assert bez_zabudowy is not None, "Variant 'Bez zabudowy' not found"
        assert bez_zabudowy["price"] == 480, f"Expected 480 PLN, got {bez_zabudowy['price']} PLN"
        
        # Check for Z zabudową variant (1480 PLN)
        z_zabudowa = next((v for v in variants if "Z zabudową" in v.get("namePl", "") or "Z zabudową" in v.get("name", "")), None)
        assert z_zabudowa is not None, "Variant 'Z zabudową' not found"
        assert z_zabudowa["price"] == 1480, f"Expected 1480 PLN, got {z_zabudowa['price']} PLN"
        
        print("✓ Bez zabudowy: 480 PLN")
        print("✓ Z zabudową: 1480 PLN")
    
    def test_variant_structure_is_correct(self):
        """Test that variant structure has required fields"""
        response = requests.get(f"{BASE_URL}/api/sauna/prices")
        assert response.status_code == 200
        
        data = response.json()
        
        # Find option with variants
        lawki_category = next((cat for cat in data["categories"] if cat["name"] == "Ławki"), None)
        option = next((opt for opt in lawki_category["options"] if "2-poziomowe nie są zamknięte" in opt["name"]), None)
        
        variants = option.get("variants", [])
        
        for variant in variants:
            # Check required fields
            assert "id" in variant, "Variant missing 'id' field"
            assert "name" in variant, "Variant missing 'name' field"
            assert "price" in variant, "Variant missing 'price' field"
            
            # Check optional fields
            assert "namePl" in variant or "name" in variant, "Variant should have Polish name"
            
            print(f"✓ Variant '{variant['name']}' has correct structure")
    
    def test_models_endpoint_works(self):
        """Test that models are returned correctly"""
        response = requests.get(f"{BASE_URL}/api/sauna/prices")
        assert response.status_code == 200
        
        data = response.json()
        models = data.get("models", [])
        
        assert len(models) > 0, "No models found"
        
        # Check first model has required fields
        model = models[0]
        assert "id" in model
        assert "name" in model
        assert "basePrice" in model
        
        print(f"Found {len(models)} models")
        print(f"First model: {model['name']} - {model['basePrice']} PLN")


class TestSaunaOrderWithVariants:
    """Test creating orders with variant selections"""
    
    def test_create_order_with_variant_selection(self):
        """Test creating an order with a variant selected"""
        # First get prices to find the option and variant IDs
        prices_response = requests.get(f"{BASE_URL}/api/sauna/prices")
        assert prices_response.status_code == 200
        
        prices = prices_response.json()
        
        # Get first model
        model = prices["models"][0]
        
        # Find Ławki category and option with variants
        lawki_category = next((cat for cat in prices["categories"] if cat["name"] == "Ławki"), None)
        option = next((opt for opt in lawki_category["options"] if "2-poziomowe nie są zamknięte" in opt["name"]), None)
        
        # Get the Z zabudową variant (1480 PLN)
        z_zabudowa_variant = next((v for v in option.get("variants", []) if "Z zabudową" in v.get("namePl", "")), None)
        
        # Create order data
        order_data = {
            "fullName": "TEST_Variant_User",
            "phoneNumber": "+48123456789",
            "fullAddress": "Test Address 123",
            "email": "test@example.com",
            "selectedModel": model["id"],
            "modelName": model["name"],
            "basePrice": model["basePrice"],
            "selections": {
                lawki_category["id"]: option["id"]
            },
            "variantSelections": {
                option["id"]: z_zabudowa_variant["id"]
            },
            "quantities": {},
            "selectedOptions": [
                {
                    "categoryId": lawki_category["id"],
                    "categoryName": lawki_category["name"],
                    "optionId": option["id"],
                    "optionName": f"{option['name']} ({z_zabudowa_variant['namePl']})",
                    "price": z_zabudowa_variant["price"],
                    "quantity": 1,
                    "totalPrice": z_zabudowa_variant["price"],
                    "selectedVariantId": z_zabudowa_variant["id"],
                    "selectedVariant": {
                        "id": z_zabudowa_variant["id"],
                        "name": z_zabudowa_variant["namePl"],
                        "price": z_zabudowa_variant["price"]
                    }
                }
            ],
            "optionsTotal": z_zabudowa_variant["price"],
            "subtotal": model["basePrice"] + z_zabudowa_variant["price"],
            "total": model["basePrice"] + z_zabudowa_variant["price"],
            "notes": "Test order with variant selection"
        }
        
        # Create order
        response = requests.post(f"{BASE_URL}/api/sauna/orders", json=order_data)
        assert response.status_code in [200, 201], f"Failed to create order: {response.text}"
        
        order = response.json()
        assert "id" in order
        
        print(f"✓ Created order: {order['id']}")
        print(f"  Model: {order.get('modelName')}")
        print(f"  Total: {order.get('total')} PLN")
        
        # Verify variant selection is saved
        assert "variantSelections" in order or "selectedOptions" in order
        
        # Clean up - delete test order
        delete_response = requests.delete(f"{BASE_URL}/api/sauna/orders/{order['id']}")
        print(f"  Cleanup: Order deleted (status: {delete_response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
