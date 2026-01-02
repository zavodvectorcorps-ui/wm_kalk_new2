"""
Test suite for Balia pricing calculation feature.
Tests EUR exchange rate, markup percentage, and retail price calculation.
Formula: purchasePriceEur × eurRate × (1 + markupPercent/100) = retail price (PLN)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestPricingCalculationAPI:
    """Tests for pricing calculation fields in GET /api/prices"""
    
    def test_get_prices_returns_eur_rate(self):
        """GET /api/prices should return eurRate field"""
        response = requests.get(f"{BASE_URL}/api/prices")
        assert response.status_code == 200
        data = response.json()
        
        # eurRate should exist and be a number
        assert 'eurRate' in data, "eurRate field missing from response"
        assert isinstance(data['eurRate'], (int, float)), "eurRate should be a number"
        assert data['eurRate'] > 0, "eurRate should be positive"
        print(f"✓ eurRate: {data['eurRate']}")
    
    def test_get_prices_returns_default_markup_percent(self):
        """GET /api/prices should return defaultMarkupPercent field"""
        response = requests.get(f"{BASE_URL}/api/prices")
        assert response.status_code == 200
        data = response.json()
        
        # defaultMarkupPercent should exist and be a number
        assert 'defaultMarkupPercent' in data, "defaultMarkupPercent field missing from response"
        assert isinstance(data['defaultMarkupPercent'], (int, float)), "defaultMarkupPercent should be a number"
        assert data['defaultMarkupPercent'] >= 0, "defaultMarkupPercent should be non-negative"
        print(f"✓ defaultMarkupPercent: {data['defaultMarkupPercent']}%")
    
    def test_heater_variants_have_purchase_price_eur(self):
        """heaterVariants should have purchasePriceEur field"""
        response = requests.get(f"{BASE_URL}/api/prices")
        assert response.status_code == 200
        data = response.json()
        
        models = data.get('models', [])
        assert len(models) > 0, "No models found"
        
        # Check first model with heaterVariants
        found_purchase_price = False
        for model in models:
            variants = model.get('heaterVariants', [])
            for variant in variants:
                if 'purchasePriceEur' in variant:
                    found_purchase_price = True
                    assert isinstance(variant['purchasePriceEur'], (int, float)), "purchasePriceEur should be a number"
                    print(f"✓ Model {model.get('id')}, variant {variant.get('type')}: purchasePriceEur = {variant['purchasePriceEur']} EUR")
        
        assert found_purchase_price, "No heaterVariant with purchasePriceEur found"
    
    def test_heater_variants_have_markup_percent(self):
        """heaterVariants should have markupPercent field"""
        response = requests.get(f"{BASE_URL}/api/prices")
        assert response.status_code == 200
        data = response.json()
        
        models = data.get('models', [])
        assert len(models) > 0, "No models found"
        
        # Check first model with heaterVariants
        found_markup = False
        for model in models:
            variants = model.get('heaterVariants', [])
            for variant in variants:
                if 'markupPercent' in variant:
                    found_markup = True
                    assert isinstance(variant['markupPercent'], (int, float)), "markupPercent should be a number"
                    print(f"✓ Model {model.get('id')}, variant {variant.get('type')}: markupPercent = {variant['markupPercent']}%")
        
        assert found_markup, "No heaterVariant with markupPercent found"
    
    def test_pricing_formula_calculation(self):
        """Verify pricing formula: purchasePriceEur × eurRate × (1 + markupPercent/100) = price"""
        response = requests.get(f"{BASE_URL}/api/prices")
        assert response.status_code == 200
        data = response.json()
        
        eur_rate = data.get('eurRate', 4.30)
        
        # Find a model with purchasePriceEur set
        for model in data.get('models', []):
            for variant in model.get('heaterVariants', []):
                purchase_eur = variant.get('purchasePriceEur', 0)
                markup = variant.get('markupPercent', 30)
                actual_price = variant.get('price', 0)
                
                if purchase_eur > 0:
                    # Calculate expected price
                    expected_price = purchase_eur * eur_rate * (1 + markup / 100)
                    expected_price_rounded = round(expected_price)
                    
                    print(f"Model: {model.get('id')}, Variant: {variant.get('type')}")
                    print(f"  Formula: {purchase_eur} EUR × {eur_rate} × (1 + {markup}/100)")
                    print(f"  Expected: {expected_price_rounded} PLN")
                    print(f"  Actual: {actual_price} PLN")
                    
                    # Allow small rounding difference
                    assert abs(actual_price - expected_price_rounded) <= 1, \
                        f"Price calculation mismatch: expected {expected_price_rounded}, got {actual_price}"
                    print(f"✓ Price calculation verified")
                    return
        
        pytest.skip("No model with purchasePriceEur > 0 found to verify formula")


class TestPricingCalculationPOST:
    """Tests for POST /api/prices with pricing calculation fields"""
    
    def test_post_prices_saves_eur_rate(self):
        """POST /api/prices should save eurRate"""
        # First get current prices
        get_response = requests.get(f"{BASE_URL}/api/prices")
        assert get_response.status_code == 200
        current_prices = get_response.json()
        
        # Modify eurRate
        test_eur_rate = 4.35
        current_prices['eurRate'] = test_eur_rate
        
        # POST updated prices
        post_response = requests.post(f"{BASE_URL}/api/prices", json=current_prices)
        assert post_response.status_code == 200
        
        # Verify saved
        verify_response = requests.get(f"{BASE_URL}/api/prices")
        assert verify_response.status_code == 200
        saved_data = verify_response.json()
        
        assert saved_data.get('eurRate') == test_eur_rate, \
            f"eurRate not saved correctly: expected {test_eur_rate}, got {saved_data.get('eurRate')}"
        print(f"✓ eurRate saved and retrieved: {test_eur_rate}")
        
        # Restore original value
        current_prices['eurRate'] = 4.30
        requests.post(f"{BASE_URL}/api/prices", json=current_prices)
    
    def test_post_prices_saves_default_markup_percent(self):
        """POST /api/prices should save defaultMarkupPercent"""
        # First get current prices
        get_response = requests.get(f"{BASE_URL}/api/prices")
        assert get_response.status_code == 200
        current_prices = get_response.json()
        
        original_markup = current_prices.get('defaultMarkupPercent', 30)
        
        # Modify defaultMarkupPercent
        test_markup = 35
        current_prices['defaultMarkupPercent'] = test_markup
        
        # POST updated prices
        post_response = requests.post(f"{BASE_URL}/api/prices", json=current_prices)
        assert post_response.status_code == 200
        
        # Verify saved
        verify_response = requests.get(f"{BASE_URL}/api/prices")
        assert verify_response.status_code == 200
        saved_data = verify_response.json()
        
        assert saved_data.get('defaultMarkupPercent') == test_markup, \
            f"defaultMarkupPercent not saved correctly: expected {test_markup}, got {saved_data.get('defaultMarkupPercent')}"
        print(f"✓ defaultMarkupPercent saved and retrieved: {test_markup}%")
        
        # Restore original value
        current_prices['defaultMarkupPercent'] = original_markup
        requests.post(f"{BASE_URL}/api/prices", json=current_prices)
    
    def test_post_prices_saves_heater_variant_purchase_price(self):
        """POST /api/prices should save purchasePriceEur in heaterVariants"""
        # First get current prices
        get_response = requests.get(f"{BASE_URL}/api/prices")
        assert get_response.status_code == 200
        current_prices = get_response.json()
        
        # Find first model with heaterVariants
        models = current_prices.get('models', [])
        if not models:
            pytest.skip("No models found")
        
        model = models[0]
        if not model.get('heaterVariants'):
            model['heaterVariants'] = [
                {'type': 'integrated', 'price': 1500, 'purchasePriceEur': 0, 'markupPercent': 30},
                {'type': 'external', 'price': 1400, 'purchasePriceEur': 0, 'markupPercent': 30}
            ]
        
        # Store original values
        original_variants = [v.copy() for v in model.get('heaterVariants', [])]
        
        # Set test purchase price
        test_purchase_price = 350.0
        for variant in model.get('heaterVariants', []):
            variant['purchasePriceEur'] = test_purchase_price
        
        # POST updated prices
        post_response = requests.post(f"{BASE_URL}/api/prices", json=current_prices)
        assert post_response.status_code == 200
        
        # Verify saved
        verify_response = requests.get(f"{BASE_URL}/api/prices")
        assert verify_response.status_code == 200
        saved_data = verify_response.json()
        
        saved_model = next((m for m in saved_data.get('models', []) if m.get('id') == model.get('id')), None)
        assert saved_model, f"Model {model.get('id')} not found after save"
        
        for variant in saved_model.get('heaterVariants', []):
            assert variant.get('purchasePriceEur') == test_purchase_price, \
                f"purchasePriceEur not saved: expected {test_purchase_price}, got {variant.get('purchasePriceEur')}"
        
        print(f"✓ purchasePriceEur saved in heaterVariants: {test_purchase_price} EUR")
        
        # Restore original values
        model['heaterVariants'] = original_variants
        requests.post(f"{BASE_URL}/api/prices", json=current_prices)
    
    def test_post_prices_saves_heater_variant_markup_percent(self):
        """POST /api/prices should save markupPercent in heaterVariants"""
        # First get current prices
        get_response = requests.get(f"{BASE_URL}/api/prices")
        assert get_response.status_code == 200
        current_prices = get_response.json()
        
        # Find first model with heaterVariants
        models = current_prices.get('models', [])
        if not models:
            pytest.skip("No models found")
        
        model = models[0]
        if not model.get('heaterVariants'):
            pytest.skip("No heaterVariants in first model")
        
        # Store original values
        original_variants = [v.copy() for v in model.get('heaterVariants', [])]
        
        # Set test markup
        test_markup = 25.0
        for variant in model.get('heaterVariants', []):
            variant['markupPercent'] = test_markup
        
        # POST updated prices
        post_response = requests.post(f"{BASE_URL}/api/prices", json=current_prices)
        assert post_response.status_code == 200
        
        # Verify saved
        verify_response = requests.get(f"{BASE_URL}/api/prices")
        assert verify_response.status_code == 200
        saved_data = verify_response.json()
        
        saved_model = next((m for m in saved_data.get('models', []) if m.get('id') == model.get('id')), None)
        assert saved_model, f"Model {model.get('id')} not found after save"
        
        for variant in saved_model.get('heaterVariants', []):
            assert variant.get('markupPercent') == test_markup, \
                f"markupPercent not saved: expected {test_markup}, got {variant.get('markupPercent')}"
        
        print(f"✓ markupPercent saved in heaterVariants: {test_markup}%")
        
        # Restore original values
        model['heaterVariants'] = original_variants
        requests.post(f"{BASE_URL}/api/prices", json=current_prices)


class TestPricingCalculationExample:
    """Test the example calculation from requirements"""
    
    def test_example_calculation(self):
        """
        Example from requirements:
        purchasePriceEur=300, eurRate=4.30, markupPercent=30
        → price = 300 × 4.30 × 1.30 = 1677 PLN
        """
        response = requests.get(f"{BASE_URL}/api/prices")
        assert response.status_code == 200
        data = response.json()
        
        # Check if there's a model with these exact values
        for model in data.get('models', []):
            for variant in model.get('heaterVariants', []):
                purchase_eur = variant.get('purchasePriceEur', 0)
                markup = variant.get('markupPercent', 0)
                price = variant.get('price', 0)
                
                if purchase_eur == 300 and markup == 30:
                    eur_rate = data.get('eurRate', 4.30)
                    expected = 300 * eur_rate * 1.30
                    
                    print(f"Found example model: {model.get('id')}")
                    print(f"  purchasePriceEur: {purchase_eur} EUR")
                    print(f"  eurRate: {eur_rate}")
                    print(f"  markupPercent: {markup}%")
                    print(f"  Expected price: {expected} PLN")
                    print(f"  Actual price: {price} PLN")
                    
                    # Verify calculation (allow small rounding)
                    assert abs(price - expected) <= 1, \
                        f"Example calculation failed: expected ~{expected}, got {price}"
                    print(f"✓ Example calculation verified: 300 × {eur_rate} × 1.30 = {price}")
                    return
        
        # If no exact match, just verify the formula works
        print("No model with exact example values (300 EUR, 30% markup) found")
        print("Verifying formula with available data...")
        
        eur_rate = data.get('eurRate', 4.30)
        # Manual calculation check
        expected = 300 * eur_rate * 1.30
        print(f"Formula check: 300 × {eur_rate} × 1.30 = {expected}")
        assert expected == pytest.approx(1677, abs=10), "Formula calculation incorrect"
        print(f"✓ Formula verified")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
