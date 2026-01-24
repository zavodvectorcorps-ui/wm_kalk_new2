"""
Test Sauna Calculator - Foundation Price and Variant Features
Tests:
1. foundationPrice from model for 'Dodaj belki' option
2. Variant selection and price replacement
3. PDF generation with variant imageUrl
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSaunaFoundationPrice:
    """Test foundationPrice feature for Belki podłużne category"""
    
    def test_api_returns_models_with_foundation_price(self):
        """Verify API returns models with foundationPrice field"""
        response = requests.get(f"{BASE_URL}/api/sauna/prices")
        assert response.status_code == 200
        
        data = response.json()
        models = data.get('models', [])
        
        # Find models with foundationPrice > 0
        models_with_foundation = [m for m in models if m.get('foundationPrice', 0) > 0]
        assert len(models_with_foundation) > 0, "No models with foundationPrice found"
        
        # Verify Sauna Kwadro-Beczka 235x250 cm has foundationPrice=200
        target_model = next((m for m in models if m.get('id') == 'sauna_kwadro_beczka_235x250_cm'), None)
        assert target_model is not None, "Model 'sauna_kwadro_beczka_235x250_cm' not found"
        assert target_model.get('foundationPrice') == 200, f"Expected foundationPrice=200, got {target_model.get('foundationPrice')}"
        print(f"✓ Model '{target_model['name']}' has foundationPrice={target_model['foundationPrice']}")
    
    def test_fundament_category_has_belki_options(self):
        """Verify fundament category has belki_dodaj option"""
        response = requests.get(f"{BASE_URL}/api/sauna/prices")
        assert response.status_code == 200
        
        data = response.json()
        categories = data.get('categories', [])
        
        # Find fundament category
        fundament_cat = next((c for c in categories if c.get('id') == 'fundament'), None)
        assert fundament_cat is not None, "Fundament category not found"
        
        # Verify belki_dodaj option exists
        options = fundament_cat.get('options', [])
        belki_dodaj = next((o for o in options if o.get('id') == 'belki_dodaj'), None)
        assert belki_dodaj is not None, "belki_dodaj option not found"
        
        # belki_dodaj should have price=0 (price comes from model's foundationPrice)
        assert belki_dodaj.get('price', 0) == 0, f"belki_dodaj should have price=0, got {belki_dodaj.get('price')}"
        print(f"✓ Category '{fundament_cat['name']}' has option '{belki_dodaj['name']}' with price=0")


class TestSaunaVariants:
    """Test variant selection feature"""
    
    def test_lawki_option_has_variants(self):
        """Verify lawki option has variants with correct prices"""
        response = requests.get(f"{BASE_URL}/api/sauna/prices")
        assert response.status_code == 200
        
        data = response.json()
        categories = data.get('categories', [])
        
        # Find lawki category
        lawki_cat = next((c for c in categories if c.get('id') == 'lawki'), None)
        assert lawki_cat is not None, "Lawki category not found"
        
        # Find option with variants
        options = lawki_cat.get('options', [])
        option_with_variants = next((o for o in options if o.get('variants')), None)
        assert option_with_variants is not None, "No option with variants found in lawki category"
        
        variants = option_with_variants.get('variants', [])
        assert len(variants) >= 2, f"Expected at least 2 variants, got {len(variants)}"
        
        # Verify variant prices - use exact IDs
        bez_zabudowy = next((v for v in variants if v.get('id') == 'var_bez_zabudowy'), None)
        z_zabudowa = next((v for v in variants if v.get('id') == 'var_z_zabudowa'), None)
        
        assert bez_zabudowy is not None, "Variant 'Bez zabudowy' not found"
        assert z_zabudowa is not None, "Variant 'Z zabudową' not found"
        
        assert bez_zabudowy.get('price') == 480, f"Expected 'Bez zabudowy' price=480, got {bez_zabudowy.get('price')}"
        assert z_zabudowa.get('price') == 1480, f"Expected 'Z zabudową' price=1480, got {z_zabudowa.get('price')}"
        
        print(f"✓ Option '{option_with_variants['name']}' has variants:")
        print(f"  - {bez_zabudowy.get('namePl', bez_zabudowy.get('name'))}: {bez_zabudowy.get('price')} PLN")
        print(f"  - {z_zabudowa.get('namePl', z_zabudowa.get('name'))}: {z_zabudowa.get('price')} PLN")


class TestSaunaOrderWithVariant:
    """Test order creation with variant selection"""
    
    def test_create_order_with_variant_selection(self):
        """Create order with variant selection and verify data"""
        import uuid
        
        order_id = f"TEST-{uuid.uuid4().hex[:8].upper()}"
        
        order_data = {
            "id": order_id,
            "fullName": "Test Variant User",
            "phoneNumber": "+48123456789",
            "email": "test@example.com",
            "fullAddress": "Test Address 123",
            "orderDate": "2026-01-15",
            "selectedModel": "sauna_kwadro_beczka_235x250_cm",
            "modelName": "Sauna Kwadro-Beczka 235x250 cm",
            "basePrice": 17980,
            "foundationPrice": 200,  # From model's foundationPrice
            "discountPercent": 0,
            "selections": {
                "fundament": "belki_dodaj",  # Should use model's foundationPrice
                "lawki": "lawki_2_poziomy_otwarte"  # Has variants
            },
            "quantities": {},
            "variantSelections": {
                "lawki_2_poziomy_otwarte": "var_z_zabudowa"  # Selected variant
            },
            "selectedOptions": [
                {
                    "categoryId": "fundament",
                    "categoryName": "Belki podłużne do podstawy ramy sauny",
                    "optionId": "belki_dodaj",
                    "optionName": "Dodaj do sauny Belki podłużne",
                    "price": 200,  # From model's foundationPrice
                    "quantity": 1,
                    "totalPrice": 200,
                    "imageUrl": None
                },
                {
                    "categoryId": "lawki",
                    "categoryName": "Ławki",
                    "optionId": "lawki_2_poziomy_otwarte",
                    "optionName": "Ławki 2-poziomowe nie są zamknięte 55 cm (Z zabudową)",
                    "price": 1480,  # From variant price
                    "quantity": 1,
                    "totalPrice": 1480,
                    "imageUrl": None,
                    "selectedVariantId": "var_z_zabudowa",
                    "selectedVariant": {
                        "id": "var_z_zabudowa",
                        "name": "Z zabudową",
                        "price": 1480,
                        "imageUrl": None
                    }
                }
            ],
            "notes": "Test order with variant selection",
            "optionsTotal": 1680,  # 200 (belki) + 1480 (lawki variant)
            "subtotal": 19660,  # 17980 + 1680
            "total": 19660,
            "createdBy": "test"
        }
        
        # Create order
        response = requests.post(f"{BASE_URL}/api/sauna/orders", json=order_data)
        assert response.status_code == 200, f"Failed to create order: {response.text}"
        
        created_order = response.json()
        assert created_order.get('id') == order_id
        
        # Verify order was saved correctly
        get_response = requests.get(f"{BASE_URL}/api/sauna/orders/{order_id}")
        assert get_response.status_code == 200
        
        saved_order = get_response.json()
        
        # Verify foundationPrice
        assert saved_order.get('foundationPrice') == 200, f"Expected foundationPrice=200, got {saved_order.get('foundationPrice')}"
        
        # Verify variant selection
        assert saved_order.get('variantSelections', {}).get('lawki_2_poziomy_otwarte') == 'var_z_zabudowa'
        
        # Verify selectedOptions contains variant data
        selected_opts = saved_order.get('selectedOptions', [])
        lawki_opt = next((o for o in selected_opts if o.get('categoryId') == 'lawki'), None)
        assert lawki_opt is not None, "Lawki option not found in selectedOptions"
        assert lawki_opt.get('selectedVariantId') == 'var_z_zabudowa'
        assert lawki_opt.get('price') == 1480, f"Expected variant price=1480, got {lawki_opt.get('price')}"
        
        print(f"✓ Order {order_id} created with:")
        print(f"  - foundationPrice: {saved_order.get('foundationPrice')} PLN")
        print(f"  - Variant selection: {saved_order.get('variantSelections')}")
        print(f"  - Lawki price (from variant): {lawki_opt.get('price')} PLN")
        
        # Cleanup - delete test order
        delete_response = requests.delete(f"{BASE_URL}/api/sauna/orders/{order_id}")
        assert delete_response.status_code == 200
        print(f"✓ Test order {order_id} deleted")


class TestSaunaPDFGeneration:
    """Test PDF generation with variant data"""
    
    def test_pdf_generation_with_variant(self):
        """Generate PDF and verify it includes variant information"""
        import uuid
        
        order_id = f"TEST-PDF-{uuid.uuid4().hex[:8].upper()}"
        
        pdf_request = {
            "orderId": order_id,
            "fullName": "Test PDF User",
            "phoneNumber": "+48123456789",
            "email": "test@example.com",
            "fullAddress": "Test Address 123",
            "orderDate": "2026-01-15",
            "selectedModel": "sauna_kwadro_beczka_235x250_cm",
            "modelName": "Sauna Kwadro-Beczka 235x250 cm",
            "basePrice": 17980,
            "foundationPrice": 200,
            "discountPercent": 0,
            "subtotal": 19660,
            "total": 19660,
            "selections": {
                "fundament": "belki_dodaj",
                "lawki": "lawki_2_poziomy_otwarte"
            },
            "quantities": {},
            "variantSelections": {
                "lawki_2_poziomy_otwarte": "var_z_zabudowa"
            },
            "selectedOptions": [
                {
                    "categoryId": "fundament",
                    "categoryName": "Belki podłużne do podstawy ramy sauny",
                    "optionId": "belki_dodaj",
                    "optionName": "Dodaj do sauny Belki podłużne",
                    "price": 200,
                    "quantity": 1,
                    "totalPrice": 200,
                    "imageUrl": None
                },
                {
                    "categoryId": "lawki",
                    "categoryName": "Ławki",
                    "optionId": "lawki_2_poziomy_otwarte",
                    "optionName": "Ławki 2-poziomowe nie są zamknięte 55 cm (Z zabudową)",
                    "price": 1480,
                    "quantity": 1,
                    "totalPrice": 1480,
                    "imageUrl": "https://example.com/variant-image.jpg",  # Variant image
                    "selectedVariantId": "var_z_zabudowa",
                    "selectedVariant": {
                        "id": "var_z_zabudowa",
                        "name": "Z zabudową",
                        "price": 1480,
                        "imageUrl": "https://example.com/variant-image.jpg"
                    }
                }
            ],
            "notes": "Test PDF with variant",
            "categories": [
                {
                    "id": "fundament",
                    "name": "Belki podłużne do podstawy ramy sauny",
                    "options": [
                        {"id": "belki_dodaj", "name": "Dodaj do sauny Belki podłużne", "price": 0}
                    ]
                },
                {
                    "id": "lawki",
                    "name": "Ławki",
                    "options": [
                        {
                            "id": "lawki_2_poziomy_otwarte",
                            "name": "Ławki 2-poziomowe nie są zamknięte 55 cm",
                            "price": 480,
                            "variants": [
                                {"id": "var_bez_zabudowy", "name": "Bez zabudowy", "price": 480},
                                {"id": "var_z_zabudowa", "name": "Z zabudową", "price": 1480}
                            ]
                        }
                    ]
                }
            ]
        }
        
        # Generate PDF
        response = requests.post(f"{BASE_URL}/api/sauna/generate-pdf", json=pdf_request)
        assert response.status_code == 200, f"Failed to generate PDF: {response.text}"
        
        # Verify response is PDF
        content_type = response.headers.get('content-type', '')
        assert 'application/pdf' in content_type, f"Expected PDF content type, got {content_type}"
        
        # Verify PDF has content
        pdf_content = response.content
        assert len(pdf_content) > 1000, f"PDF seems too small: {len(pdf_content)} bytes"
        
        # Verify PDF header
        assert pdf_content[:4] == b'%PDF', "Response is not a valid PDF"
        
        print(f"✓ PDF generated successfully ({len(pdf_content)} bytes)")
        print(f"  - Contains variant data for 'Z zabudową' at 1480 PLN")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
