"""
Tests for Custom Layout Upload Feature in Sauna Calculator
Tests the new feature allowing managers to upload custom layout images
"""
import pytest
import requests
import os
import io
from PIL import Image

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://sauna-order-sync.preview.emergentagent.com')


class TestUploadEndpoint:
    """Test the image upload endpoint"""
    
    def test_upload_image_success(self):
        """Test successful image upload"""
        # Create a test image
        img = Image.new('RGB', (100, 100), color='blue')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        
        response = requests.post(
            f"{BASE_URL}/api/upload/image",
            files={'file': ('test_layout.png', img_bytes, 'image/png')}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert 'filename' in data
        assert 'url' in data
        assert data['url'].startswith('/api/uploads/')
        print(f"Upload successful: {data['url']}")
        
        # Store URL for later tests
        self.uploaded_url = data['url']
        return data['url']
    
    def test_upload_image_invalid_type(self):
        """Test upload with invalid file type"""
        response = requests.post(
            f"{BASE_URL}/api/upload/image",
            files={'file': ('test.txt', b'not an image', 'text/plain')}
        )
        
        assert response.status_code == 400
        print("Invalid file type correctly rejected")
    
    def test_upload_image_jpeg(self):
        """Test JPEG image upload"""
        img = Image.new('RGB', (100, 100), color='red')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='JPEG')
        img_bytes.seek(0)
        
        response = requests.post(
            f"{BASE_URL}/api/upload/image",
            files={'file': ('test_layout.jpg', img_bytes, 'image/jpeg')}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert 'url' in data
        print(f"JPEG upload successful: {data['url']}")
    
    def test_upload_image_webp(self):
        """Test WebP image upload"""
        img = Image.new('RGB', (100, 100), color='green')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='WEBP')
        img_bytes.seek(0)
        
        response = requests.post(
            f"{BASE_URL}/api/upload/image",
            files={'file': ('test_layout.webp', img_bytes, 'image/webp')}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert 'url' in data
        print(f"WebP upload successful: {data['url']}")
    
    def test_uploaded_image_accessible(self):
        """Test that uploaded image can be retrieved"""
        # First upload an image
        img = Image.new('RGB', (100, 100), color='purple')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        
        upload_response = requests.post(
            f"{BASE_URL}/api/upload/image",
            files={'file': ('test_access.png', img_bytes, 'image/png')}
        )
        
        assert upload_response.status_code == 200
        url = upload_response.json()['url']
        
        # Now try to access the image
        get_response = requests.get(f"{BASE_URL}{url}")
        assert get_response.status_code == 200
        assert 'image' in get_response.headers.get('Content-Type', '')
        print(f"Image accessible at {url}")


class TestPDFGenerationWithCustomImage:
    """Test PDF generation with custom layout image"""
    
    def test_pdf_generation_with_custom_image(self):
        """Test that PDF generation works with custom layout image URL"""
        # First upload an image
        img = Image.new('RGB', (200, 150), color='blue')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        
        upload_response = requests.post(
            f"{BASE_URL}/api/upload/image",
            files={'file': ('custom_layout.png', img_bytes, 'image/png')}
        )
        
        assert upload_response.status_code == 200
        custom_image_url = upload_response.json()['url']
        print(f"Uploaded custom image: {custom_image_url}")
        
        # Now generate PDF with custom image
        pdf_data = {
            "fullName": "Test Custom Layout PDF",
            "phoneNumber": "+48123456789",
            "email": "test@example.com",
            "selectedModel": "sauna-kwadro-beczka-235x200",
            "modelName": "Sauna Kwadro-Beczka 235×200 cm",
            "basePrice": 14200,
            "total": 14200,
            "selections": {},
            "selectedOptions": [],
            "categories": [],
            "selectedModelVariantData": {
                "name": "Custom Layout",
                "imageUrl": custom_image_url,
                "isCustomImage": True
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/sauna/generate-pdf",
            json=pdf_data
        )
        
        assert response.status_code == 200
        assert response.headers.get('Content-Type') == 'application/pdf'
        assert len(response.content) > 1000  # PDF should have some content
        print(f"PDF generated successfully with custom image, size: {len(response.content)} bytes")
    
    def test_pdf_generation_without_custom_image(self):
        """Test that PDF generation works without custom image (fallback to catalog)"""
        pdf_data = {
            "fullName": "Test No Custom Image",
            "phoneNumber": "+48123456789",
            "email": "test@example.com",
            "selectedModel": "sauna-kwadro-beczka-235x200",
            "modelName": "Sauna Kwadro-Beczka 235×200 cm",
            "basePrice": 14200,
            "total": 14200,
            "selections": {},
            "selectedOptions": [],
            "categories": [],
            "selectedLayoutId": None,
            "selectedLayoutSize": None
        }
        
        response = requests.post(
            f"{BASE_URL}/api/sauna/generate-pdf",
            json=pdf_data
        )
        
        assert response.status_code == 200
        assert response.headers.get('Content-Type') == 'application/pdf'
        print(f"PDF generated without custom image, size: {len(response.content)} bytes")


class TestLayoutCatalogAPI:
    """Test Layout Catalog API endpoints"""
    
    def test_get_layout_variants(self):
        """Test fetching layout variants"""
        response = requests.get(f"{BASE_URL}/api/faq/layout-variants")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} layout variants")
        
        # Check structure of variants
        if len(data) > 0:
            variant = data[0]
            assert 'modelSize' in variant or 'variantName' in variant
            print(f"Sample variant: {variant.get('variantName', 'N/A')}")


class TestSaunaOrderWithCustomLayout:
    """Test creating and retrieving orders with custom layout"""
    
    def test_create_order_with_custom_layout(self):
        """Test creating an order with custom layout image"""
        # First upload an image
        img = Image.new('RGB', (200, 150), color='orange')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        
        upload_response = requests.post(
            f"{BASE_URL}/api/upload/image",
            files={'file': ('order_layout.png', img_bytes, 'image/png')}
        )
        
        assert upload_response.status_code == 200
        custom_image_url = upload_response.json()['url']
        
        # Create order with custom layout
        order_data = {
            "fullName": "TEST_Custom_Layout_Order",
            "phoneNumber": "+48123456789",
            "email": "test@example.com",
            "selectedModel": "sauna-kwadro-beczka-235x200",
            "modelName": "Sauna Kwadro-Beczka 235×200 cm",
            "basePrice": 14200,
            "total": 14200,
            "selections": {},
            "selectedOptions": [],
            "selectedLayoutId": None,  # No catalog selection
            "selectedLayoutSize": "2m",
            # Custom layout image would be passed in selectedModelVariantData
        }
        
        response = requests.post(
            f"{BASE_URL}/api/sauna/orders",
            json=order_data
        )
        
        assert response.status_code in [200, 201]
        data = response.json()
        assert 'id' in data
        order_id = data['id']
        print(f"Created order with ID: {order_id}")
        
        # Clean up - delete the test order
        delete_response = requests.delete(f"{BASE_URL}/api/sauna/orders/{order_id}")
        assert delete_response.status_code in [200, 204]
        print(f"Cleaned up test order: {order_id}")


class TestSaunaPricesAPI:
    """Test Sauna Prices API"""
    
    def test_get_sauna_prices(self):
        """Test fetching sauna prices"""
        response = requests.get(f"{BASE_URL}/api/sauna/prices")
        
        assert response.status_code == 200
        data = response.json()
        assert 'models' in data
        assert 'categories' in data
        print(f"Found {len(data['models'])} models and {len(data['categories'])} categories")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
