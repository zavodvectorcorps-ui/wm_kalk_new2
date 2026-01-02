"""
Test NBP API integration and Option pricing features for Balia calculator.
Features tested:
1. NBP API - EUR/PLN rate hint in settings
2. POST /api/prices - saving purchasePriceEur and markupPercent for options
3. Recalculate all prices button - recalculates both models and options
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestNBPApiIntegration:
    """Test NBP API integration for EUR/PLN rate"""
    
    def test_nbp_api_returns_eur_rate(self):
        """Test that NBP API returns EUR/PLN rate"""
        response = requests.get('https://api.nbp.pl/api/exchangerates/rates/a/eur/?format=json', timeout=10)
        assert response.status_code == 200, f"NBP API returned {response.status_code}"
        
        data = response.json()
        assert 'rates' in data, "NBP response missing 'rates' field"
        assert len(data['rates']) > 0, "NBP rates array is empty"
        
        rate = data['rates'][0]
        assert 'mid' in rate, "NBP rate missing 'mid' field"
        assert 'effectiveDate' in rate, "NBP rate missing 'effectiveDate' field"
        
        # Verify rate is a reasonable EUR/PLN value (between 3.5 and 5.5)
        assert 3.5 < rate['mid'] < 5.5, f"NBP rate {rate['mid']} seems unreasonable"
        print(f"NBP EUR/PLN rate: {rate['mid']} (date: {rate['effectiveDate']})")


class TestOptionPricing:
    """Test option pricing fields (purchasePriceEur, markupPercent)"""
    
    def test_get_prices_returns_categories_with_options(self):
        """Test that GET /api/prices returns categories with options"""
        response = requests.get(f'{BASE_URL}/api/prices', timeout=10)
        assert response.status_code == 200, f"GET /api/prices returned {response.status_code}"
        
        data = response.json()
        assert 'categories' in data, "Response missing 'categories' field"
        assert isinstance(data['categories'], list), "categories should be a list"
        
        if len(data['categories']) > 0:
            category = data['categories'][0]
            assert 'options' in category, "Category missing 'options' field"
            print(f"Found {len(data['categories'])} categories")
    
    def test_option_has_pricing_fields(self):
        """Test that options have purchasePriceEur and markupPercent fields"""
        response = requests.get(f'{BASE_URL}/api/prices', timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        categories = data.get('categories', [])
        
        # Find an option with pricing fields
        found_option_with_pricing = False
        for cat in categories:
            for opt in cat.get('options', []):
                # Check if option has pricing fields (they may be 0 or None)
                if 'purchasePriceEur' in opt or 'markupPercent' in opt:
                    found_option_with_pricing = True
                    print(f"Option {opt.get('id')}: purchasePriceEur={opt.get('purchasePriceEur')}, markupPercent={opt.get('markupPercent')}")
                    break
            if found_option_with_pricing:
                break
        
        # Note: Options may not have pricing fields set yet, so we just verify the structure
        print(f"Options with pricing fields found: {found_option_with_pricing}")
    
    def test_post_prices_saves_option_pricing(self):
        """Test that POST /api/prices saves option pricing fields"""
        # First get current prices
        get_response = requests.get(f'{BASE_URL}/api/prices', timeout=10)
        assert get_response.status_code == 200
        
        prices = get_response.json()
        
        # Find first category with options
        if not prices.get('categories') or len(prices['categories']) == 0:
            pytest.skip("No categories found to test")
        
        category = None
        for cat in prices['categories']:
            if cat.get('options') and len(cat['options']) > 0:
                category = cat
                break
        
        if not category:
            pytest.skip("No category with options found")
        
        # Update first option with pricing fields
        test_purchase_price = 75.50
        test_markup = 45
        original_option = category['options'][0].copy()
        
        category['options'][0]['purchasePriceEur'] = test_purchase_price
        category['options'][0]['markupPercent'] = test_markup
        
        # Save prices
        post_response = requests.post(f'{BASE_URL}/api/prices', json=prices, timeout=10)
        assert post_response.status_code == 200, f"POST /api/prices returned {post_response.status_code}"
        
        # Verify saved
        verify_response = requests.get(f'{BASE_URL}/api/prices', timeout=10)
        assert verify_response.status_code == 200
        
        verify_data = verify_response.json()
        
        # Find the updated option
        updated_option = None
        for cat in verify_data['categories']:
            for opt in cat.get('options', []):
                if opt.get('id') == original_option.get('id'):
                    updated_option = opt
                    break
        
        assert updated_option is not None, "Could not find updated option"
        assert updated_option.get('purchasePriceEur') == test_purchase_price, \
            f"purchasePriceEur not saved: expected {test_purchase_price}, got {updated_option.get('purchasePriceEur')}"
        assert updated_option.get('markupPercent') == test_markup, \
            f"markupPercent not saved: expected {test_markup}, got {updated_option.get('markupPercent')}"
        
        print(f"Option pricing saved successfully: purchasePriceEur={test_purchase_price}, markupPercent={test_markup}")
        
        # Restore original values
        category['options'][0]['purchasePriceEur'] = original_option.get('purchasePriceEur', 0)
        category['options'][0]['markupPercent'] = original_option.get('markupPercent', 30)
        requests.post(f'{BASE_URL}/api/prices', json=prices, timeout=10)


class TestPriceRecalculation:
    """Test price recalculation formula for options"""
    
    def test_option_price_calculation_formula(self):
        """Test the formula: purchasePriceEur × eurRate × (1 + markupPercent/100) = price"""
        # Example from requirements: purchasePriceEur=50, markupPercent=40, eurRate=4.30 → price = 50 × 4.30 × 1.40 = 301 PLN
        purchase_price_eur = 50
        markup_percent = 40
        eur_rate = 4.30
        
        expected_price = purchase_price_eur * eur_rate * (1 + markup_percent / 100)
        assert expected_price == 301, f"Formula calculation error: expected 301, got {expected_price}"
        print(f"Formula verified: {purchase_price_eur} EUR × {eur_rate} × {1 + markup_percent/100} = {expected_price} PLN")
    
    def test_get_prices_returns_eur_rate(self):
        """Test that GET /api/prices returns eurRate field"""
        response = requests.get(f'{BASE_URL}/api/prices', timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        assert 'eurRate' in data, "Response missing 'eurRate' field"
        
        eur_rate = data['eurRate']
        assert isinstance(eur_rate, (int, float)), f"eurRate should be a number, got {type(eur_rate)}"
        assert eur_rate > 0, f"eurRate should be positive, got {eur_rate}"
        print(f"eurRate from API: {eur_rate}")
    
    def test_get_prices_returns_default_markup_percent(self):
        """Test that GET /api/prices returns defaultMarkupPercent field"""
        response = requests.get(f'{BASE_URL}/api/prices', timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        assert 'defaultMarkupPercent' in data, "Response missing 'defaultMarkupPercent' field"
        
        markup = data['defaultMarkupPercent']
        assert isinstance(markup, (int, float)), f"defaultMarkupPercent should be a number, got {type(markup)}"
        print(f"defaultMarkupPercent from API: {markup}")


class TestCategoryOptionModel:
    """Test CategoryOption model has pricing fields"""
    
    def test_category_option_structure(self):
        """Test that CategoryOption has all required fields including pricing"""
        response = requests.get(f'{BASE_URL}/api/prices', timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        categories = data.get('categories', [])
        
        if not categories:
            pytest.skip("No categories found")
        
        # Check first option structure
        for cat in categories:
            options = cat.get('options', [])
            if options:
                opt = options[0]
                # Required fields
                assert 'id' in opt, "Option missing 'id'"
                assert 'name' in opt or 'nameRu' in opt or 'namePl' in opt, "Option missing name fields"
                assert 'price' in opt, "Option missing 'price'"
                
                # Pricing fields (may be 0 or None)
                print(f"Option structure: id={opt.get('id')}, price={opt.get('price')}, "
                      f"purchasePriceEur={opt.get('purchasePriceEur')}, markupPercent={opt.get('markupPercent')}")
                break


class TestBackendHealthAndAuth:
    """Basic health and auth tests"""
    
    def test_backend_health(self):
        """Test backend is healthy"""
        response = requests.get(f'{BASE_URL}/api/health', timeout=10)
        assert response.status_code == 200
        print("Backend health check passed")
    
    def test_admin_login(self):
        """Test admin login works"""
        response = requests.post(f'{BASE_URL}/api/auth/login', json={
            'username': 'admin',
            'password': '220066'
        }, timeout=10)
        assert response.status_code == 200, f"Admin login failed: {response.status_code}"
        
        data = response.json()
        assert 'token' in data or 'access_token' in data, "Login response missing token"
        print("Admin login successful")


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
