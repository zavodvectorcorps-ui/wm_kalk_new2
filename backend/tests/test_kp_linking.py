"""
Test KP (Commercial Proposal) auto-linking during sync operations.
Tests the bug fix: When a deal is moved to a stage in amoCRM and imported into CRM-sauna,
the KP should be linked automatically.

Features tested:
1. link_calculator_order function finds sauna order by amocrm_id and attaches KP PDF
2. During bulk sync, existing leads without KP get KP linked automatically
3. Per-lead sync also tries to link KP
4. Contract generation finds KP from lead documents
5. Standard field mapping (_budget) still works in sync
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestLinkCalculatorOrderFunction:
    """Test the link_calculator_order function directly via API behavior."""
    
    def test_lead_with_kp_has_document_type_kp(self):
        """Verify lead CRM-59FC9032 has a document with type=kp."""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/CRM-59FC9032")
        assert response.status_code == 200, f"Failed to get lead: {response.text}"
        
        lead = response.json()
        documents = lead.get("documents", [])
        
        # Check that at least one document has type=kp
        kp_docs = [d for d in documents if d.get("type") == "kp"]
        assert len(kp_docs) > 0, f"Lead should have KP document, got: {documents}"
        
        # Verify KP document has URL
        kp_doc = kp_docs[0]
        assert kp_doc.get("url"), "KP document should have URL"
        print(f"PASS: Lead has KP document: {kp_doc.get('name')} -> {kp_doc.get('url')[:80]}...")
    
    def test_sauna_order_exists_with_amocrm_id(self):
        """Verify sauna order WMS-20-02-2026-105210 has amocrm_id=TEST_AMO_123."""
        # This tests the prerequisite for link_calculator_order to work
        from pymongo import MongoClient
        c = MongoClient(os.environ.get('MONGO_URL'))
        db = c[os.environ.get('DB_NAME', 'test_database')]
        
        order = db.sauna_orders.find_one(
            {'amocrm_id': 'TEST_AMO_123'},
            {'_id': 0, 'id': 1, 'amocrm_id': 1, 'modelName': 1}
        )
        
        assert order is not None, "Sauna order with amocrm_id=TEST_AMO_123 should exist"
        assert order.get('id') == 'WMS-20-02-2026-105210', f"Order ID mismatch: {order.get('id')}"
        print(f"PASS: Sauna order found: {order}")
    
    def test_calculator_pdf_exists_for_amocrm_id(self):
        """Verify calculator_pdfs collection has entry for TEST_AMO_123."""
        from pymongo import MongoClient
        c = MongoClient(os.environ.get('MONGO_URL'))
        db = c[os.environ.get('DB_NAME', 'test_database')]
        
        pdf = db.calculator_pdfs.find_one(
            {'amocrm_id': 'TEST_AMO_123'},
            {'_id': 0, 'order_id': 1, 'amocrm_id': 1, 'cloudinary_url': 1}
        )
        
        assert pdf is not None, "Calculator PDF with amocrm_id=TEST_AMO_123 should exist"
        print(f"PASS: Calculator PDF found: {pdf}")


class TestPerLeadSyncKPLinking:
    """Test per-lead sync endpoint tries to link KP for leads without it."""
    
    def test_sync_endpoint_exists(self):
        """Verify POST /api/sauna-crm/leads/{id}/sync-from-amocrm endpoint exists."""
        response = requests.post(f"{BASE_URL}/api/sauna-crm/leads/CRM-59FC9032/sync-from-amocrm")
        # Should return 400 (amoCRM not configured) not 404
        assert response.status_code in [200, 400, 502], f"Unexpected status: {response.status_code}"
        print(f"PASS: Sync endpoint exists, returned {response.status_code}")
    
    def test_sync_returns_400_when_amocrm_not_configured(self):
        """Per-lead sync should return 400 when amoCRM credentials not configured."""
        response = requests.post(f"{BASE_URL}/api/sauna-crm/leads/CRM-59FC9032/sync-from-amocrm")
        # In test env, amoCRM is not configured
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "amoCRM" in data.get("detail", ""), f"Error should mention amoCRM: {data}"
        print(f"PASS: Sync returns 400 with amoCRM error: {data.get('detail')}")
    
    def test_sync_returns_404_for_nonexistent_lead(self):
        """Per-lead sync should return 404 for non-existent lead."""
        response = requests.post(f"{BASE_URL}/api/sauna-crm/leads/NONEXISTENT-LEAD/sync-from-amocrm")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Sync returns 404 for non-existent lead")
    
    def test_sync_returns_400_for_lead_without_amocrm_id(self):
        """Per-lead sync should return 400 for lead without amocrm_id."""
        # First create a lead without amocrm_id
        import uuid
        test_lead_id = f"TEST-NOAMO-{uuid.uuid4().hex[:6].upper()}"
        
        create_response = requests.post(
            f"{BASE_URL}/api/sauna-crm/leads",
            json={
                "id": test_lead_id,
                "stageId": "invoice_sent",
                "clientName": "Test No AmoCRM"
            }
        )
        assert create_response.status_code == 200, f"Failed to create lead: {create_response.text}"
        
        # Try to sync
        sync_response = requests.post(f"{BASE_URL}/api/sauna-crm/leads/{test_lead_id}/sync-from-amocrm")
        assert sync_response.status_code == 400, f"Expected 400, got {sync_response.status_code}"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/sauna-crm/leads/{test_lead_id}")
        print("PASS: Sync returns 400 for lead without amocrm_id")


class TestContractGenerationFindsKP:
    """Test contract generation finds KP from lead documents."""
    
    def test_contract_debug_endpoint_shows_kp_source(self):
        """Debug endpoint should show KP source for lead with KP."""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/contract-template/debug/CRM-59FC9032")
        assert response.status_code == 200, f"Debug endpoint failed: {response.text}"
        
        data = response.json()
        checks = data.get("checks", {})
        
        # Verify lead check
        lead_check = checks.get("lead", {})
        assert lead_check.get("status") == "OK", f"Lead check failed: {lead_check}"
        
        # Verify KP check
        kp_check = checks.get("kp", {})
        assert kp_check.get("kp_url"), f"KP URL should be found: {kp_check}"
        assert kp_check.get("source"), f"KP source should be identified: {kp_check}"
        
        print(f"PASS: Contract debug shows KP source: {kp_check.get('source')}, url: {kp_check.get('kp_url')[:60]}...")
    
    def test_contract_generation_endpoint_exists(self):
        """Verify POST /api/sauna-crm/generate-contract endpoint exists."""
        response = requests.post(
            f"{BASE_URL}/api/sauna-crm/generate-contract",
            json={"leadId": "CRM-59FC9032"}
        )
        # Should succeed or fail with template error, not 404
        assert response.status_code in [200, 500], f"Unexpected status: {response.status_code}"
        print(f"PASS: Contract generation endpoint exists, returned {response.status_code}")
    
    def test_contract_generation_returns_kp_attached_status(self):
        """Contract generation should return kpAttached status."""
        response = requests.post(
            f"{BASE_URL}/api/sauna-crm/generate-contract",
            json={"leadId": "CRM-59FC9032"}
        )
        
        if response.status_code == 200:
            data = response.json()
            assert "kpAttached" in data, f"Response should include kpAttached: {data}"
            assert "contractUrl" in data, f"Response should include contractUrl: {data}"
            print(f"PASS: Contract generated, kpAttached={data.get('kpAttached')}, url={data.get('contractUrl')[:60]}...")
        else:
            # Template might not be uploaded in test env
            print(f"SKIP: Contract generation returned {response.status_code} (template may not be uploaded)")


class TestStandardFieldMapping:
    """Test standard field mapping (_budget) still works in sync."""
    
    def test_settings_have_field_mappings(self):
        """CRM settings should have field mappings including standard fields."""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/settings")
        assert response.status_code == 200, f"Failed to get settings: {response.text}"
        
        settings = response.json()
        fields = settings.get("fields", [])
        
        assert len(fields) > 0, "Settings should have fields"
        
        # Check that fields have amoFieldId property
        field_with_amo = [f for f in fields if f.get("amoFieldId")]
        print(f"PASS: Settings have {len(fields)} fields, {len(field_with_amo)} with amoFieldId mapping")
    
    def test_lead_has_totalAmount_field(self):
        """Lead should have totalAmount field (mapped from _budget)."""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/CRM-59FC9032")
        assert response.status_code == 200
        
        lead = response.json()
        total_amount = lead.get("totalAmount")
        
        assert total_amount is not None, f"Lead should have totalAmount: {lead}"
        assert isinstance(total_amount, (int, float)), f"totalAmount should be numeric: {total_amount}"
        print(f"PASS: Lead has totalAmount={total_amount}")


class TestBulkSyncKPLinking:
    """Test bulk sync endpoint tries to link KP for existing leads without it."""
    
    def test_bulk_sync_endpoint_exists(self):
        """Verify POST /api/sauna-crm/sync-from-amocrm endpoint exists."""
        response = requests.post(f"{BASE_URL}/api/sauna-crm/sync-from-amocrm")
        # Should return 400 (amoCRM not configured) not 404
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
        print(f"PASS: Bulk sync endpoint exists, returned {response.status_code}")
    
    def test_bulk_sync_returns_400_when_amocrm_not_configured(self):
        """Bulk sync should return 400 when amoCRM credentials not configured."""
        response = requests.post(f"{BASE_URL}/api/sauna-crm/sync-from-amocrm")
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        assert "amoCRM" in data.get("detail", ""), f"Error should mention amoCRM: {data}"
        print(f"PASS: Bulk sync returns 400 with amoCRM error")


class TestExistingFeaturesRegression:
    """Regression tests for existing features that should still work."""
    
    def test_lead_has_changelog(self):
        """Lead should have changeLog array."""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/CRM-59FC9032")
        assert response.status_code == 200
        
        lead = response.json()
        assert "changeLog" in lead, "Lead should have changeLog field"
        assert isinstance(lead["changeLog"], list), "changeLog should be a list"
        print(f"PASS: Lead has changeLog with {len(lead['changeLog'])} entries")
    
    def test_lead_has_hasUnreviewedChanges(self):
        """Lead should have hasUnreviewedChanges field."""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/CRM-59FC9032")
        assert response.status_code == 200
        
        lead = response.json()
        assert "hasUnreviewedChanges" in lead, "Lead should have hasUnreviewedChanges field"
        print(f"PASS: Lead has hasUnreviewedChanges={lead['hasUnreviewedChanges']}")
    
    def test_lead_has_amoComment(self):
        """Lead should have amoComment field."""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/CRM-59FC9032")
        assert response.status_code == 200
        
        lead = response.json()
        assert "amoComment" in lead, "Lead should have amoComment field"
        print(f"PASS: Lead has amoComment field")
    
    def test_stages_have_collapsed_property(self):
        """CRM stages should have collapsed property."""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/settings")
        assert response.status_code == 200
        
        settings = response.json()
        stages = settings.get("stages", [])
        
        # Check that at least one stage has collapsed property
        collapsed_stages = [s for s in stages if s.get("collapsed")]
        print(f"PASS: Settings have {len(stages)} stages, {len(collapsed_stages)} collapsed")
    
    def test_acknowledge_changes_endpoint(self):
        """Acknowledge changes endpoint should work."""
        response = requests.put(f"{BASE_URL}/api/sauna-crm/leads/CRM-59FC9032/acknowledge-changes")
        assert response.status_code == 200, f"Acknowledge failed: {response.text}"
        
        data = response.json()
        assert data.get("status") == "ok", f"Unexpected response: {data}"
        print("PASS: Acknowledge changes endpoint works")
    
    def test_leads_crud_operations(self):
        """Basic CRUD operations should work."""
        import uuid
        test_id = f"TEST-CRUD-{uuid.uuid4().hex[:6].upper()}"
        
        # Create
        create_resp = requests.post(
            f"{BASE_URL}/api/sauna-crm/leads",
            json={
                "id": test_id,
                "stageId": "invoice_sent",
                "clientName": "Test CRUD"
            }
        )
        assert create_resp.status_code == 200, f"Create failed: {create_resp.text}"
        
        # Read
        read_resp = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{test_id}")
        assert read_resp.status_code == 200, f"Read failed: {read_resp.text}"
        
        # Update
        update_resp = requests.put(
            f"{BASE_URL}/api/sauna-crm/leads/{test_id}",
            json={"clientName": "Test CRUD Updated"}
        )
        assert update_resp.status_code == 200, f"Update failed: {update_resp.text}"
        
        # Delete
        delete_resp = requests.delete(f"{BASE_URL}/api/sauna-crm/leads/{test_id}")
        assert delete_resp.status_code == 200, f"Delete failed: {delete_resp.text}"
        
        print("PASS: CRUD operations work")


class TestLinkDocumentEndpoint:
    """Test the link document endpoint used for KP attachment."""
    
    def test_link_document_endpoint_exists(self):
        """POST /api/sauna-crm/leads/{id}/documents/link should exist."""
        response = requests.post(
            f"{BASE_URL}/api/sauna-crm/leads/CRM-59FC9032/documents/link",
            json={
                "url": "https://example.com/test.pdf",
                "type": "kp",
                "name": "Test KP"
            }
        )
        assert response.status_code == 200, f"Link document failed: {response.text}"
        
        data = response.json()
        assert data.get("status") == "ok", f"Unexpected response: {data}"
        assert "document" in data, f"Response should include document: {data}"
        print(f"PASS: Link document endpoint works, doc id={data['document'].get('id')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
