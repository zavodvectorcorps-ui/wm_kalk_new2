"""
Test suite for Sauna CRM module - Kanban board for sauna leads management
Tests: CRUD operations for leads, settings management, stage changes, calculator integration
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSaunaCRMSettings:
    """Test CRM settings endpoints"""
    
    def test_get_settings(self):
        """GET /api/sauna-crm/settings - should return settings with fields and stages"""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/settings")
        assert response.status_code == 200
        
        data = response.json()
        # Verify settings structure
        assert "fields" in data
        assert "stages" in data
        assert isinstance(data["fields"], list)
        assert isinstance(data["stages"], list)
        
        # Verify we have 10 fields
        assert len(data["fields"]) == 10
        
        # Verify we have at least 3 stages
        assert len(data["stages"]) >= 3
        
        # Verify field structure
        for field in data["fields"]:
            assert "id" in field
            assert "name" in field
            assert "enabled" in field
            assert "amoFieldId" in field
        
        # Verify stage structure
        for stage in data["stages"]:
            assert "id" in stage
            assert "name" in stage
            assert "color" in stage
            assert "amoStageId" in stage
            assert "amoPipelineId" in stage
        
        print(f"Settings retrieved: {len(data['fields'])} fields, {len(data['stages'])} stages")
    
    def test_update_settings(self):
        """POST /api/sauna-crm/settings - should update settings"""
        # First get current settings
        get_response = requests.get(f"{BASE_URL}/api/sauna-crm/settings")
        current_settings = get_response.json()
        
        # Update settings (just re-save with same data)
        response = requests.post(
            f"{BASE_URL}/api/sauna-crm/settings",
            json={
                "fields": current_settings["fields"],
                "stages": current_settings["stages"],
                "autoSyncEnabled": True
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "ok"
        print("Settings updated successfully")


class TestSaunaCRMLeads:
    """Test CRM leads CRUD operations"""
    
    def test_get_all_leads(self):
        """GET /api/sauna-crm/leads - should return leads and settings"""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads")
        assert response.status_code == 200
        
        data = response.json()
        # Verify response structure
        assert "leads" in data
        assert "byStage" in data
        assert "settings" in data
        assert isinstance(data["leads"], list)
        assert isinstance(data["byStage"], dict)
        
        print(f"Retrieved {len(data['leads'])} leads")
    
    def test_create_lead(self):
        """POST /api/sauna-crm/leads - should create a new lead"""
        lead_data = {
            "id": f"TEST-CRM-{int(time.time())}",
            "stageId": "new",
            "clientName": "TEST_Тестовый клиент",
            "phone": "+7 999 888-77-66",
            "email": "test_crm@example.com",
            "address": "Тестовый адрес, д. 123",
            "notes": "Тестовая заявка для проверки CRM",
            "isImportant": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/sauna-crm/leads",
            json=lead_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "ok"
        assert "lead" in data
        
        created_lead = data["lead"]
        assert created_lead["clientName"] == lead_data["clientName"]
        assert created_lead["phone"] == lead_data["phone"]
        assert created_lead["stageId"] == "new"
        assert created_lead["isImportant"] == True
        assert "createdAt" in created_lead
        assert "stageHistory" in created_lead
        
        # Store lead ID for other tests
        self.__class__.test_lead_id = created_lead["id"]
        print(f"Created lead: {created_lead['id']}")
        return created_lead["id"]
    
    def test_get_single_lead(self):
        """GET /api/sauna-crm/leads/{lead_id} - should return single lead"""
        # First create a lead if not exists
        if not hasattr(self.__class__, 'test_lead_id'):
            self.test_create_lead()
        
        lead_id = self.__class__.test_lead_id
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{lead_id}")
        assert response.status_code == 200
        
        lead = response.json()
        assert lead["id"] == lead_id
        assert "clientName" in lead
        assert "stageId" in lead
        print(f"Retrieved lead: {lead['id']} - {lead['clientName']}")
    
    def test_get_nonexistent_lead(self):
        """GET /api/sauna-crm/leads/{lead_id} - should return 404 for nonexistent lead"""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/NONEXISTENT-LEAD-ID")
        assert response.status_code == 404
        print("Correctly returned 404 for nonexistent lead")
    
    def test_update_lead(self):
        """PUT /api/sauna-crm/leads/{lead_id} - should update lead"""
        # First create a lead if not exists
        if not hasattr(self.__class__, 'test_lead_id'):
            self.test_create_lead()
        
        lead_id = self.__class__.test_lead_id
        
        # Get current lead
        get_response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{lead_id}")
        current_lead = get_response.json()
        
        # Update lead
        updated_data = {
            **current_lead,
            "clientName": "TEST_Обновленный клиент",
            "notes": "Обновленные примечания",
            "field_1": "Значение поля 1"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/sauna-crm/leads/{lead_id}",
            json=updated_data
        )
        assert response.status_code == 200
        
        updated_lead = response.json()
        assert updated_lead["clientName"] == "TEST_Обновленный клиент"
        assert updated_lead["notes"] == "Обновленные примечания"
        assert updated_lead["field_1"] == "Значение поля 1"
        assert "updatedAt" in updated_lead
        print(f"Updated lead: {updated_lead['id']}")
    
    def test_change_lead_stage(self):
        """PUT /api/sauna-crm/leads/{lead_id}/stage - should change lead stage"""
        # First create a lead if not exists
        if not hasattr(self.__class__, 'test_lead_id'):
            self.test_create_lead()
        
        lead_id = self.__class__.test_lead_id
        
        # Change stage to "qualified"
        response = requests.put(
            f"{BASE_URL}/api/sauna-crm/leads/{lead_id}/stage?stage_id=qualified"
        )
        assert response.status_code == 200
        
        updated_lead = response.json()
        assert updated_lead["stageId"] == "qualified"
        assert "stageHistory" in updated_lead
        
        # Verify stage history was updated
        history = updated_lead["stageHistory"]
        assert len(history) >= 1
        
        # Find the stage change entry
        stage_changes = [h for h in history if h.get("action") == "stage_changed"]
        assert len(stage_changes) >= 1
        
        print(f"Changed lead stage to: {updated_lead['stageId']}")
    
    def test_change_stage_to_kp_created(self):
        """PUT /api/sauna-crm/leads/{lead_id}/stage - should change to kp_created stage"""
        if not hasattr(self.__class__, 'test_lead_id'):
            self.test_create_lead()
        
        lead_id = self.__class__.test_lead_id
        
        # Change stage to "kp_created"
        response = requests.put(
            f"{BASE_URL}/api/sauna-crm/leads/{lead_id}/stage?stage_id=kp_created"
        )
        assert response.status_code == 200
        
        updated_lead = response.json()
        assert updated_lead["stageId"] == "kp_created"
        print(f"Changed lead stage to: {updated_lead['stageId']}")


class TestSaunaCRMCalculatorIntegration:
    """Test calculator integration endpoints"""
    
    def test_open_calculator_data(self):
        """POST /api/sauna-crm/leads/{lead_id}/open-calculator - should return calculator data"""
        # First get an existing lead
        leads_response = requests.get(f"{BASE_URL}/api/sauna-crm/leads")
        leads = leads_response.json()["leads"]
        
        if not leads:
            # Create a test lead
            lead_data = {
                "id": f"TEST-CALC-{int(time.time())}",
                "stageId": "new",
                "clientName": "TEST_Калькулятор клиент",
                "phone": "+7 999 111-22-33",
                "email": "calc_test@example.com",
                "address": "Адрес для калькулятора"
            }
            create_response = requests.post(
                f"{BASE_URL}/api/sauna-crm/leads",
                json=lead_data
            )
            lead_id = create_response.json()["lead"]["id"]
        else:
            lead_id = leads[0]["id"]
        
        # Get calculator data
        response = requests.post(f"{BASE_URL}/api/sauna-crm/leads/{lead_id}/open-calculator")
        assert response.status_code == 200
        
        data = response.json()
        assert "calculatorData" in data
        
        calc_data = data["calculatorData"]
        assert "crmLeadId" in calc_data
        assert calc_data["crmLeadId"] == lead_id
        
        print(f"Calculator data retrieved for lead: {lead_id}")
    
    def test_save_calculator_data(self):
        """PUT /api/sauna-crm/leads/{lead_id}/calculator-data - should save calculator data"""
        # Get an existing lead
        leads_response = requests.get(f"{BASE_URL}/api/sauna-crm/leads")
        leads = leads_response.json()["leads"]
        
        if not leads:
            pytest.skip("No leads available for testing")
        
        lead_id = leads[0]["id"]
        
        # Save calculator data
        calc_data = {
            "calculatorData": {
                "saunaType": "barrel",
                "size": "2x2",
                "heaterType": "electric",
                "price": 15000
            },
            "pdfUrl": "https://example.com/test-pdf.pdf"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/sauna-crm/leads/{lead_id}/calculator-data",
            json=calc_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "ok"
        
        # Verify data was saved
        get_response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{lead_id}")
        updated_lead = get_response.json()
        assert updated_lead.get("calculatorPdfUrl") == calc_data["pdfUrl"]
        
        print(f"Calculator data saved for lead: {lead_id}")


class TestSaunaCRMAmoCRMSync:
    """Test amoCRM sync endpoints (will skip if not configured)"""
    
    def test_sync_from_amocrm(self):
        """POST /api/sauna-crm/sync-from-amocrm - should attempt sync"""
        response = requests.post(f"{BASE_URL}/api/sauna-crm/sync-from-amocrm")
        
        # May return 400 if amoCRM not configured, which is expected
        if response.status_code == 400:
            data = response.json()
            assert "amoCRM not configured" in data.get("detail", "")
            print("amoCRM sync skipped - not configured (expected)")
        else:
            assert response.status_code == 200
            data = response.json()
            assert "imported" in data
            print(f"amoCRM sync completed: {data.get('imported', 0)} leads imported")


class TestSaunaCRMDeleteLead:
    """Test lead deletion (run last)"""
    
    def test_delete_lead(self):
        """DELETE /api/sauna-crm/leads/{lead_id} - should delete lead"""
        # Create a lead to delete
        lead_data = {
            "id": f"TEST-DELETE-{int(time.time())}",
            "stageId": "new",
            "clientName": "TEST_Удаляемый клиент",
            "phone": "+7 999 000-00-00"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/sauna-crm/leads",
            json=lead_data
        )
        assert create_response.status_code == 200
        lead_id = create_response.json()["lead"]["id"]
        
        # Delete the lead
        response = requests.delete(f"{BASE_URL}/api/sauna-crm/leads/{lead_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "ok"
        
        # Verify lead is deleted
        get_response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{lead_id}")
        assert get_response.status_code == 404
        
        print(f"Deleted lead: {lead_id}")
    
    def test_delete_nonexistent_lead(self):
        """DELETE /api/sauna-crm/leads/{lead_id} - should return 404 for nonexistent lead"""
        response = requests.delete(f"{BASE_URL}/api/sauna-crm/leads/NONEXISTENT-DELETE-ID")
        assert response.status_code == 404
        print("Correctly returned 404 for deleting nonexistent lead")


class TestSaunaCRMCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_leads(self):
        """Clean up TEST_ prefixed leads"""
        leads_response = requests.get(f"{BASE_URL}/api/sauna-crm/leads")
        leads = leads_response.json()["leads"]
        
        deleted_count = 0
        for lead in leads:
            if lead.get("clientName", "").startswith("TEST_"):
                delete_response = requests.delete(f"{BASE_URL}/api/sauna-crm/leads/{lead['id']}")
                if delete_response.status_code == 200:
                    deleted_count += 1
        
        print(f"Cleaned up {deleted_count} test leads")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
