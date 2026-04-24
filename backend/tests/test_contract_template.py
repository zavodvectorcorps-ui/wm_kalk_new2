"""
Contract Template Management API Tests
Tests for: template settings, upload, placeholders, and contract generation
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://manager-kpi-hub.preview.emergentagent.com')


class TestContractTemplateSettings:
    """Tests for GET/POST /api/sauna-crm/contract-template/settings"""
    
    def test_get_settings_returns_mappings_and_sources(self):
        """GET /api/sauna-crm/contract-template/settings returns settings with mappings and availableSources"""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/contract-template/settings")
        assert response.status_code == 200
        
        data = response.json()
        # Verify structure
        assert "mappings" in data, "Response should contain 'mappings'"
        assert "availableSources" in data, "Response should contain 'availableSources'"
        assert "attachKp" in data, "Response should contain 'attachKp'"
        assert "placeholders" in data, "Response should contain 'placeholders'"
        
        # Verify mappings structure
        assert isinstance(data["mappings"], list)
        if len(data["mappings"]) > 0:
            mapping = data["mappings"][0]
            assert "placeholder" in mapping
            assert "source" in mapping
            assert "defaultValue" in mapping
            assert "label" in mapping
        
        # Verify availableSources structure
        assert isinstance(data["availableSources"], list)
        assert len(data["availableSources"]) > 0
        source = data["availableSources"][0]
        assert "id" in source
        assert "label" in source
        assert "category" in source
    
    def test_save_settings_updates_mappings_and_attachkp(self):
        """POST /api/sauna-crm/contract-template/settings saves mappings and attachKp flag"""
        # Login first
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_resp.status_code == 200
        token = login_resp.json().get("token")
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        # Get current settings to restore later
        original = requests.get(f"{BASE_URL}/api/sauna-crm/contract-template/settings").json()
        
        # Save new settings
        test_mappings = [
            {"placeholder": "{{TEST_VAR}}", "source": "_static", "defaultValue": "test_value", "label": "Test Variable"}
        ]
        save_resp = requests.post(
            f"{BASE_URL}/api/sauna-crm/contract-template/settings",
            headers=headers,
            json={"mappings": test_mappings, "attachKp": False}
        )
        assert save_resp.status_code == 200
        assert save_resp.json().get("status") == "ok"
        
        # Verify settings were saved
        verify_resp = requests.get(f"{BASE_URL}/api/sauna-crm/contract-template/settings")
        verify_data = verify_resp.json()
        assert verify_data["attachKp"] == False
        assert len(verify_data["mappings"]) == 1
        assert verify_data["mappings"][0]["placeholder"] == "{{TEST_VAR}}"
        
        # Restore original settings
        requests.post(
            f"{BASE_URL}/api/sauna-crm/contract-template/settings",
            headers=headers,
            json={"mappings": original.get("mappings", []), "attachKp": original.get("attachKp", True)}
        )


class TestContractTemplatePlaceholders:
    """Tests for GET /api/sauna-crm/contract-template/placeholders"""
    
    def test_get_placeholders_returns_list(self):
        """GET /api/sauna-crm/contract-template/placeholders returns placeholders from current template"""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/contract-template/placeholders")
        assert response.status_code == 200
        
        data = response.json()
        assert "placeholders" in data
        assert isinstance(data["placeholders"], list)
        
        # Verify placeholders format (should be {{VARIABLE_NAME}})
        for ph in data["placeholders"]:
            assert ph.startswith("{{") and ph.endswith("}}")


class TestContractTemplateUpload:
    """Tests for POST /api/sauna-crm/contract-template/upload"""
    
    def test_upload_rejects_non_docx(self):
        """POST /api/sauna-crm/contract-template/upload rejects non-.docx files"""
        # Login first
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        token = login_resp.json().get("token")
        headers = {"Authorization": f"Bearer {token}"}
        
        # Try to upload a .txt file
        files = {"file": ("test.txt", b"test content", "text/plain")}
        response = requests.post(
            f"{BASE_URL}/api/sauna-crm/contract-template/upload",
            headers=headers,
            files=files
        )
        assert response.status_code == 400
        assert "docx" in response.json().get("detail", "").lower()


class TestContractGeneration:
    """Tests for POST /api/sauna-crm/generate-contract"""
    
    def test_generate_contract_with_valid_lead(self):
        """POST /api/sauna-crm/generate-contract with {leadId: 'CRM-TEST-001'} generates DOCX"""
        # Login first
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_resp.status_code == 200
        token = login_resp.json().get("token")
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        # Generate contract
        response = requests.post(
            f"{BASE_URL}/api/sauna-crm/generate-contract",
            headers=headers,
            json={"leadId": "CRM-TEST-001"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("status") == "ok"
        assert "contractUrl" in data
        assert data["contractUrl"] is not None
        assert "replacements" in data
        
        # Verify contract URL is accessible (either cloudinary or local)
        contract_url = data["contractUrl"]
        assert contract_url.endswith(".docx") or "docx" in contract_url
    
    def test_generate_contract_without_lead_id_fails(self):
        """POST /api/sauna-crm/generate-contract without leadId returns 400"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        token = login_resp.json().get("token")
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        response = requests.post(
            f"{BASE_URL}/api/sauna-crm/generate-contract",
            headers=headers,
            json={}
        )
        assert response.status_code == 400
        assert "leadid" in response.json().get("detail", "").lower()
    
    def test_generate_contract_with_invalid_lead_fails(self):
        """POST /api/sauna-crm/generate-contract with non-existent lead returns 404"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        token = login_resp.json().get("token")
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        response = requests.post(
            f"{BASE_URL}/api/sauna-crm/generate-contract",
            headers=headers,
            json={"leadId": "NON-EXISTENT-LEAD-12345"}
        )
        assert response.status_code == 404


class TestStaticTemplateDownload:
    """Tests for static template download"""
    
    def test_static_template_accessible(self):
        """GET /api/static/templates/contract_template.docx is accessible"""
        response = requests.get(f"{BASE_URL}/api/static/templates/contract_template.docx")
        assert response.status_code == 200
        # Verify it's a DOCX file (starts with PK for ZIP format)
        assert response.content[:2] == b'PK'


class TestAvailableSources:
    """Tests for available sources in settings"""
    
    def test_available_sources_categories(self):
        """Verify availableSources contains expected categories"""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/contract-template/settings")
        assert response.status_code == 200
        
        data = response.json()
        sources = data.get("availableSources", [])
        
        # Get unique categories
        categories = set(s.get("category") for s in sources)
        
        # Verify expected categories exist
        expected_categories = {"client", "payment", "production", "computed", "calculator"}
        for cat in expected_categories:
            assert cat in categories, f"Category '{cat}' should be in availableSources"
    
    def test_available_sources_has_lead_fields(self):
        """Verify availableSources contains lead fields like clientName, phone, etc."""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/contract-template/settings")
        data = response.json()
        sources = data.get("availableSources", [])
        
        source_ids = [s.get("id") for s in sources]
        
        # Verify key lead fields are available
        expected_fields = ["clientName", "phone", "email", "address", "totalAmount", "advancePayment"]
        for field in expected_fields:
            assert field in source_ids, f"Field '{field}' should be in availableSources"
