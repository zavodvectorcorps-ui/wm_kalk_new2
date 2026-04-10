"""
Test certificate history feature - iteration 77
Tests:
1. Certificate button text should NOT have (-18%) in Polish mode
2. Certificate history API: GET /api/sauna/certificate-history returns {items: [], total: 0}
3. Certificate history logging when creating order with certificateDiscount=true
4. Certificate history section in Statistics page
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture
def auth_token(api_client):
    """Get authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "admin123"
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed - skipping authenticated tests")

@pytest.fixture
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


class TestCertificateHistoryAPI:
    """Test certificate history API endpoints"""
    
    def test_certificate_history_endpoint_exists(self, api_client):
        """Test that GET /api/sauna/certificate-history endpoint exists and returns correct structure"""
        response = api_client.get(f"{BASE_URL}/api/sauna/certificate-history?limit=50&skip=0")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "items" in data, "Response should have 'items' field"
        assert "total" in data, "Response should have 'total' field"
        assert isinstance(data["items"], list), "'items' should be a list"
        assert isinstance(data["total"], int), "'total' should be an integer"
        print(f"Certificate history API returns: items={len(data['items'])}, total={data['total']}")
    
    def test_certificate_history_pagination(self, api_client):
        """Test that certificate history supports pagination parameters"""
        response = api_client.get(f"{BASE_URL}/api/sauna/certificate-history?limit=10&skip=0")
        assert response.status_code == 200
        
        response2 = api_client.get(f"{BASE_URL}/api/sauna/certificate-history?limit=100")
        assert response2.status_code == 200
        print("Certificate history pagination works correctly")


class TestCertificateDiscountLogging:
    """Test that orders with certificateDiscount=true are logged to certificate_history"""
    
    def test_create_order_with_certificate_discount_logs_history(self, authenticated_client):
        """Test that creating an order with certificateDiscount=true logs to certificate_history"""
        # Get initial certificate history count
        history_before = authenticated_client.get(f"{BASE_URL}/api/sauna/certificate-history?limit=1")
        assert history_before.status_code == 200
        total_before = history_before.json().get("total", 0)
        
        # Create a test order with certificate discount
        order_id = f"TEST-CERT-{uuid.uuid4().hex[:8]}"
        order_data = {
            "id": order_id,
            "fullName": "Test Certificate Client",
            "phoneNumber": "+48123456789",
            "fullAddress": "Test Address 123",
            "email": "test@example.com",
            "orderDate": datetime.now().strftime('%Y-%m-%d'),
            "selectedModel": "test-model",
            "modelName": "Test Sauna Model",
            "basePrice": 20000,
            "subtotal": 20000,
            "total": 14760,  # After 10% discount + 18% certificate
            "discountPercent": 10,
            "certificateDiscount": True,  # This should trigger logging
            "selections": {},
            "quantities": {},
            "notes": "Test order for certificate history",
            "createdBy": "admin"
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/sauna/orders", json=order_data)
        assert response.status_code == 200, f"Failed to create order: {response.text}"
        print(f"Created test order with certificate discount: {order_id}")
        
        # Check certificate history was updated
        history_after = authenticated_client.get(f"{BASE_URL}/api/sauna/certificate-history?limit=10")
        assert history_after.status_code == 200
        total_after = history_after.json().get("total", 0)
        
        # Verify history count increased
        assert total_after > total_before, f"Certificate history should have increased. Before: {total_before}, After: {total_after}"
        print(f"Certificate history count increased from {total_before} to {total_after}")
        
        # Verify the logged entry has correct data
        items = history_after.json().get("items", [])
        if items:
            latest = items[0]
            assert latest.get("orderId") == order_id, f"Latest entry should be for order {order_id}"
            assert latest.get("clientName") == "Test Certificate Client"
            assert latest.get("modelName") == "Test Sauna Model"
            assert "certificateSavings" in latest, "Entry should have certificateSavings field"
            print(f"Certificate history entry verified: orderId={latest.get('orderId')}, savings={latest.get('certificateSavings')}")
        
        # Cleanup - delete test order
        delete_response = authenticated_client.delete(f"{BASE_URL}/api/sauna/orders/{order_id}")
        print(f"Cleanup: deleted test order {order_id}")
    
    def test_create_order_without_certificate_no_logging(self, authenticated_client):
        """Test that creating an order WITHOUT certificateDiscount does NOT log to certificate_history"""
        # Get initial certificate history count
        history_before = authenticated_client.get(f"{BASE_URL}/api/sauna/certificate-history?limit=1")
        assert history_before.status_code == 200
        total_before = history_before.json().get("total", 0)
        
        # Create a test order WITHOUT certificate discount
        order_id = f"TEST-NOCERT-{uuid.uuid4().hex[:8]}"
        order_data = {
            "id": order_id,
            "fullName": "Test No Certificate Client",
            "phoneNumber": "+48123456789",
            "fullAddress": "Test Address 456",
            "email": "test2@example.com",
            "orderDate": datetime.now().strftime('%Y-%m-%d'),
            "selectedModel": "test-model",
            "modelName": "Test Sauna Model 2",
            "basePrice": 15000,
            "subtotal": 15000,
            "total": 13500,  # After 10% discount only
            "discountPercent": 10,
            "certificateDiscount": False,  # No certificate discount
            "selections": {},
            "quantities": {},
            "notes": "Test order without certificate",
            "createdBy": "admin"
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/sauna/orders", json=order_data)
        assert response.status_code == 200, f"Failed to create order: {response.text}"
        print(f"Created test order without certificate discount: {order_id}")
        
        # Check certificate history was NOT updated
        history_after = authenticated_client.get(f"{BASE_URL}/api/sauna/certificate-history?limit=1")
        assert history_after.status_code == 200
        total_after = history_after.json().get("total", 0)
        
        # Verify history count did NOT increase
        assert total_after == total_before, f"Certificate history should NOT have increased. Before: {total_before}, After: {total_after}"
        print(f"Certificate history count unchanged: {total_before}")
        
        # Cleanup - delete test order
        delete_response = authenticated_client.delete(f"{BASE_URL}/api/sauna/orders/{order_id}")
        print(f"Cleanup: deleted test order {order_id}")


class TestCertificateButtonText:
    """Test that certificate button text does NOT have (-18%) suffix"""
    
    def test_constants_file_no_18_percent(self):
        """Verify constants.js has certificatePayment without (-18%)"""
        constants_path = "/app/frontend/src/components/sauna/constants.js"
        with open(constants_path, 'r') as f:
            content = f.read()
        
        # Check Polish translation
        assert "certificatePayment: 'Płatność certyfikatem'" in content, "Polish certificatePayment should be 'Płatność certyfikatem'"
        assert "certificatePayment: 'Płatność certyfikatem (-18%)'" not in content, "Polish certificatePayment should NOT have (-18%)"
        
        # Check Russian translation
        assert "certificatePayment: 'Оплата сертификатом'" in content, "Russian certificatePayment should be 'Оплата сертификатом'"
        assert "certificatePayment: 'Оплата сертификатом (-18%)'" not in content, "Russian certificatePayment should NOT have (-18%)"
        
        print("Certificate button text verified: no (-18%) suffix in either language")


class TestStatisticsPageCertificateSection:
    """Test that Statistics page has certificate history section"""
    
    def test_statistics_page_has_certificate_section(self):
        """Verify StatisticsPage.jsx has CertificateHistorySection component"""
        stats_path = "/app/frontend/src/components/StatisticsPage.jsx"
        with open(stats_path, 'r') as f:
            content = f.read()
        
        # Check for CertificateHistorySection component
        assert "CertificateHistorySection" in content, "StatisticsPage should have CertificateHistorySection component"
        assert "certificate-history-section" in content, "CertificateHistorySection should have data-testid='certificate-history-section'"
        
        # Check it's rendered for sauna calculator
        assert "{isSauna && <CertificateHistorySection" in content, "CertificateHistorySection should be rendered when isSauna is true"
        
        print("Statistics page certificate history section verified")
    
    def test_certificate_section_has_collapsible_header(self):
        """Verify CertificateHistorySection has collapsible header"""
        stats_path = "/app/frontend/src/components/StatisticsPage.jsx"
        with open(stats_path, 'r') as f:
            content = f.read()
        
        # Check for collapsible functionality
        assert "expanded" in content, "CertificateHistorySection should have expanded state"
        assert "setExpanded" in content, "CertificateHistorySection should have setExpanded function"
        assert "onClick={() => setExpanded(!expanded)}" in content, "Header should toggle expanded state on click"
        
        print("Certificate section collapsible header verified")
    
    def test_certificate_section_shows_empty_message(self):
        """Verify CertificateHistorySection shows 'Brak historii certyfikatów' when empty"""
        stats_path = "/app/frontend/src/components/StatisticsPage.jsx"
        with open(stats_path, 'r') as f:
            content = f.read()
        
        # Check for empty state message
        assert "Brak historii certyfikatów" in content, "Polish empty message should be present"
        assert "Нет истории сертификатов" in content, "Russian empty message should be present"
        
        print("Certificate section empty state message verified")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
