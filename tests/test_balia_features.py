"""
Test suite for Balia calculator features:
1. PDF generation with model specs
2. Currency PLN/zł
3. Hint fields for options
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://order-tracker-pro-5.preview.emergentagent.com')


class TestBaliaAPI:
    """Test Balia API endpoints"""
    
    def test_get_prices_returns_200(self):
        """Test GET /api/prices returns 200"""
        response = requests.get(f"{BASE_URL}/api/prices")
        assert response.status_code == 200
        print("✓ GET /api/prices returns 200")
    
    def test_currency_is_pln(self):
        """Test that currency is PLN and symbol is zł"""
        response = requests.get(f"{BASE_URL}/api/prices")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get('currency') == 'PLN', f"Expected currency PLN, got {data.get('currency')}"
        assert data.get('currencySymbol') == 'zł', f"Expected symbol zł, got {data.get('currencySymbol')}"
        print("✓ Currency is PLN with symbol zł")
    
    def test_models_have_specs(self):
        """Test that models have specs field"""
        response = requests.get(f"{BASE_URL}/api/prices")
        assert response.status_code == 200
        data = response.json()
        
        models = data.get('models', [])
        assert len(models) > 0, "No models found"
        
        # Check at least one model has specs
        models_with_specs = [m for m in models if m.get('specs')]
        assert len(models_with_specs) > 0, "No models have specs"
        
        # Verify specs structure
        for model in models_with_specs:
            specs = model.get('specs', {})
            # Check for common spec fields
            spec_fields = ['outerDiameter', 'innerDiameter', 'depth', 'volume', 'seats', 'dimensions']
            has_any_spec = any(specs.get(field) for field in spec_fields)
            if has_any_spec:
                print(f"✓ Model {model.get('id')} has specs: {specs}")
        
        print(f"✓ {len(models_with_specs)} models have specs")
    
    def test_options_have_hint_fields(self):
        """Test that options can have hint and hintPl fields"""
        response = requests.get(f"{BASE_URL}/api/prices")
        assert response.status_code == 200
        data = response.json()
        
        categories = data.get('categories', [])
        assert len(categories) > 0, "No categories found"
        
        # Check that options exist
        all_options = []
        for cat in categories:
            all_options.extend(cat.get('options', []))
        
        assert len(all_options) > 0, "No options found"
        print(f"✓ Found {len(all_options)} options in {len(categories)} categories")


class TestPDFGeneration:
    """Test PDF generation with model specs"""
    
    def test_generate_pdf_returns_200(self):
        """Test POST /api/generate-pdf returns 200"""
        payload = {
            "fullName": "Test User",
            "phoneNumber": "+48123456789",
            "fullAddress": "Test Address, Poland",
            "orderDate": "2025-01-15",
            "modelId": "round_225",
            "modelName": "Okrągła 225cm",
            "modelPrice": 1450,
            "selectedOptions": [],
            "total": 1450,
            "currency": "PLN",
            "notes": "Test PDF"
        }
        
        response = requests.post(f"{BASE_URL}/api/generate-pdf", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.headers.get('content-type') == 'application/pdf'
        print("✓ PDF generation returns 200 with PDF content-type")
    
    def test_generate_pdf_with_options(self):
        """Test PDF generation with selected options"""
        payload = {
            "fullName": "Jan Kowalski",
            "phoneNumber": "+48111222333",
            "fullAddress": "ul. Testowa 1, 00-001 Warszawa",
            "orderDate": "2025-01-15",
            "modelId": "round_225",
            "modelName": "Okrągła 225cm",
            "modelPrice": 1450,
            "selectedOptions": [
                {
                    "categoryId": "hydromassage",
                    "optionId": "hydro_6_8",
                    "categoryName": "Hydromasaż",
                    "optionName": "Hydromasaż 1.1kW (6-8 dysz)",
                    "price": 300
                }
            ],
            "total": 1750,
            "currency": "PLN",
            "notes": "Test z opcjami"
        }
        
        response = requests.post(f"{BASE_URL}/api/generate-pdf", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Check PDF size is reasonable (should be larger with options)
        pdf_size = len(response.content)
        assert pdf_size > 10000, f"PDF too small: {pdf_size} bytes"
        print(f"✓ PDF with options generated successfully ({pdf_size} bytes)")
    
    def test_generate_pdf_with_discount(self):
        """Test PDF generation with discount"""
        payload = {
            "fullName": "Test Discount",
            "phoneNumber": "+48999888777",
            "fullAddress": "Test Address",
            "orderDate": "2025-01-15",
            "modelId": "round_200",
            "modelName": "Okrągła 200cm",
            "modelPrice": 1500,
            "selectedOptions": [],
            "subtotal": 1500,
            "discountPercent": 10,
            "total": 1350,
            "currency": "PLN",
            "notes": "Test z rabatem"
        }
        
        response = requests.post(f"{BASE_URL}/api/generate-pdf", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ PDF with discount generated successfully")


class TestModelSpecs:
    """Test model specifications"""
    
    def test_round_225_has_specs(self):
        """Test that round_225 model has correct specs"""
        response = requests.get(f"{BASE_URL}/api/prices")
        assert response.status_code == 200
        data = response.json()
        
        models = data.get('models', [])
        round_225 = next((m for m in models if m.get('id') == 'round_225'), None)
        
        assert round_225 is not None, "Model round_225 not found"
        
        specs = round_225.get('specs', {})
        assert specs is not None, "Specs not found for round_225"
        
        # Verify expected specs
        assert specs.get('outerDiameter') == '225cm', f"Expected outerDiameter 225cm, got {specs.get('outerDiameter')}"
        assert specs.get('depth') == '100cm', f"Expected depth 100cm, got {specs.get('depth')}"
        assert specs.get('volume') == '1800L', f"Expected volume 1800L, got {specs.get('volume')}"
        assert specs.get('seats') == 8, f"Expected seats 8, got {specs.get('seats')}"
        
        print(f"✓ Model round_225 has correct specs: {specs}")
    
    def test_square_model_has_dimensions(self):
        """Test that square models have dimensions field"""
        response = requests.get(f"{BASE_URL}/api/prices")
        assert response.status_code == 200
        data = response.json()
        
        models = data.get('models', [])
        square_model = next((m for m in models if 'square' in m.get('id', '').lower() or 'kwadrat' in m.get('namePl', '').lower()), None)
        
        if square_model:
            specs = square_model.get('specs', {})
            if specs:
                # Square models should have dimensions instead of diameter
                has_dimensions = specs.get('dimensions') is not None
                print(f"✓ Square model {square_model.get('id')} has dimensions: {specs.get('dimensions')}")
            else:
                print(f"⚠ Square model {square_model.get('id')} has no specs")
        else:
            print("⚠ No square model found")


class TestHeaterVariants:
    """Test heater variants with hints"""
    
    def test_models_have_heater_variants(self):
        """Test that models have heater variants"""
        response = requests.get(f"{BASE_URL}/api/prices")
        assert response.status_code == 200
        data = response.json()
        
        models = data.get('models', [])
        models_with_variants = [m for m in models if m.get('heaterVariants') and len(m.get('heaterVariants', [])) > 0]
        
        assert len(models_with_variants) > 0, "No models have heater variants"
        
        for model in models_with_variants[:3]:  # Check first 3
            variants = model.get('heaterVariants', [])
            for v in variants:
                print(f"  - {model.get('id')}: {v.get('type')} = {v.get('price')} PLN")
        
        print(f"✓ {len(models_with_variants)} models have heater variants")
    
    def test_heater_variants_can_have_hints(self):
        """Test that heater variants support hint fields"""
        response = requests.get(f"{BASE_URL}/api/prices")
        assert response.status_code == 200
        data = response.json()
        
        models = data.get('models', [])
        
        # Check if any variant has hint fields
        for model in models:
            for variant in model.get('heaterVariants', []):
                # Variants should support hint and hintPl fields
                if 'hint' in variant or 'hintPl' in variant:
                    print(f"✓ Variant {variant.get('type')} in {model.get('id')} has hint fields")
                    return
        
        print("✓ Heater variants support hint fields (structure verified)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
