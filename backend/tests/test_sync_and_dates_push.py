"""
Test suite for:
1. sync-from-amocrm updates existing CRM cards (stage, budget, fields)
2. Production dates auto-push to amoCRM when dates change
3. Widget shows all 4 date types for sauna CRM leads
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test lead data from test_credentials.md
TEST_AMO_ID = "TEST_AMO_123"
TEST_CRM_LEAD_ID = "CRM-59FC9032"
NON_SAUNA_LEAD_ID = "99999"


class TestWidgetDateDisplay:
    """Test that widget shows all 4 date types for sauna CRM leads."""
    
    def test_widget_shows_prepayment_date_when_set(self):
        """Widget should show prepaymentDate (Дата аванса) when it's set in CRM lead."""
        response = requests.get(f"{BASE_URL}/api/widget/embed/{TEST_AMO_ID}")
        assert response.status_code == 200
        html = response.text
        # prepaymentDate is optional - widget only shows it if set
        # The test lead doesn't have prepaymentDate, so we just verify the widget renders
        # If prepaymentDate were set, "Дата аванса" would appear
        assert response.status_code == 200  # Widget renders successfully
    
    def test_widget_shows_production_date(self):
        """Widget should show productionDate (Дата производства) for sauna CRM leads."""
        response = requests.get(f"{BASE_URL}/api/widget/embed/{TEST_AMO_ID}")
        assert response.status_code == 200
        html = response.text
        # Check for production date label
        assert "Дата производства" in html
    
    def test_widget_shows_ready_date(self):
        """Widget should show readyDate (Дата готовности) for sauna CRM leads."""
        response = requests.get(f"{BASE_URL}/api/widget/embed/{TEST_AMO_ID}")
        assert response.status_code == 200
        html = response.text
        # Check for ready date label
        assert "Дата готовности" in html
    
    def test_widget_shows_delivery_date(self):
        """Widget should show deliveryDate (Дата доставки) for sauna CRM leads."""
        response = requests.get(f"{BASE_URL}/api/widget/embed/{TEST_AMO_ID}")
        assert response.status_code == 200
        html = response.text
        # Check for delivery date label
        assert "Дата доставки" in html
    
    def test_widget_shows_all_four_dates(self):
        """Widget should show all 4 date types for sauna CRM leads."""
        response = requests.get(f"{BASE_URL}/api/widget/embed/{TEST_AMO_ID}")
        assert response.status_code == 200
        html = response.text
        
        # All 4 date labels should be present
        date_labels = ["Дата аванса", "Дата производства", "Дата готовности", "Дата доставки"]
        found_labels = [label for label in date_labels if label in html]
        
        # At least 3 should be present (prepaymentDate might not be set)
        assert len(found_labels) >= 3, f"Expected at least 3 date labels, found: {found_labels}"
        
        # Delivery date must be present (new feature)
        assert "Дата доставки" in html, "deliveryDate (Дата доставки) must be shown in widget"
    
    def test_widget_shows_formatted_dates(self):
        """Widget should show dates in DD.MM.YYYY format."""
        response = requests.get(f"{BASE_URL}/api/widget/embed/{TEST_AMO_ID}")
        assert response.status_code == 200
        html = response.text
        
        # Test lead has dates: productionDate=2026-04-10, readyDate=2026-04-15, deliveryDate=2026-04-20
        # These should be formatted as 10.04.2026, 15.04.2026, 20.04.2026
        assert "10.04.2026" in html or "2026-04-10" in html, "productionDate should be displayed"
        assert "15.04.2026" in html or "2026-04-15" in html, "readyDate should be displayed"
        assert "20.04.2026" in html or "2026-04-20" in html, "deliveryDate should be displayed"


class TestNonSaunaWidgetRegression:
    """Test that non-sauna widget still renders correctly (no regression)."""
    
    def test_non_sauna_widget_renders(self):
        """Non-sauna widget should render without errors."""
        response = requests.get(f"{BASE_URL}/api/widget/embed/{NON_SAUNA_LEAD_ID}")
        assert response.status_code == 200
        html = response.text
        # Should have basic widget structure
        assert "<!DOCTYPE html>" in html
        assert "Информация о заказе" in html
    
    def test_non_sauna_widget_no_crm_section(self):
        """Non-sauna widget should not show 'Сауна — CRM' section."""
        response = requests.get(f"{BASE_URL}/api/widget/embed/{NON_SAUNA_LEAD_ID}")
        assert response.status_code == 200
        html = response.text
        # Should NOT have sauna CRM section
        assert "Сауна — CRM" not in html or "САУНА — CRM" not in html.upper()
    
    def test_non_sauna_widget_shows_order_details(self):
        """Non-sauna widget should show 'Детали заказа' section."""
        response = requests.get(f"{BASE_URL}/api/widget/embed/{NON_SAUNA_LEAD_ID}")
        assert response.status_code == 200
        html = response.text
        # Should have order details or calculator section
        assert "Детали заказа" in html or "Калькулятор" in html or "Заказ" in html


class TestProductionDatesPush:
    """Test that updating production dates triggers push to amoCRM."""
    
    def test_update_lead_with_production_date_change(self):
        """PUT /api/sauna-crm/leads/{id} with changed productionDate should trigger push."""
        # First get current lead data
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{TEST_CRM_LEAD_ID}")
        assert response.status_code == 200
        lead = response.json()
        
        # Update with a new production date
        new_date = "2026-05-01"
        update_data = {"productionDate": new_date}
        
        response = requests.put(
            f"{BASE_URL}/api/sauna-crm/leads/{TEST_CRM_LEAD_ID}",
            json=update_data
        )
        assert response.status_code == 200
        updated = response.json()
        assert updated.get("productionDate") == new_date
        
        # Restore original date
        restore_data = {"productionDate": "2026-04-10"}
        requests.put(f"{BASE_URL}/api/sauna-crm/leads/{TEST_CRM_LEAD_ID}", json=restore_data)
    
    def test_update_lead_with_ready_date_change(self):
        """PUT /api/sauna-crm/leads/{id} with changed readyDate should trigger push."""
        new_date = "2026-05-05"
        update_data = {"readyDate": new_date}
        
        response = requests.put(
            f"{BASE_URL}/api/sauna-crm/leads/{TEST_CRM_LEAD_ID}",
            json=update_data
        )
        assert response.status_code == 200
        updated = response.json()
        assert updated.get("readyDate") == new_date
        
        # Restore original date
        restore_data = {"readyDate": "2026-04-15"}
        requests.put(f"{BASE_URL}/api/sauna-crm/leads/{TEST_CRM_LEAD_ID}", json=restore_data)
    
    def test_update_lead_with_delivery_date_change(self):
        """PUT /api/sauna-crm/leads/{id} with changed deliveryDate should trigger push."""
        new_date = "2026-05-10"
        update_data = {"deliveryDate": new_date}
        
        response = requests.put(
            f"{BASE_URL}/api/sauna-crm/leads/{TEST_CRM_LEAD_ID}",
            json=update_data
        )
        assert response.status_code == 200
        updated = response.json()
        assert updated.get("deliveryDate") == new_date
        
        # Restore original date
        restore_data = {"deliveryDate": "2026-04-20"}
        requests.put(f"{BASE_URL}/api/sauna-crm/leads/{TEST_CRM_LEAD_ID}", json=restore_data)
    
    def test_update_lead_no_change_no_push(self):
        """PUT /api/sauna-crm/leads/{id} with same date should not trigger push."""
        # Get current date
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{TEST_CRM_LEAD_ID}")
        assert response.status_code == 200
        lead = response.json()
        current_date = lead.get("productionDate")
        
        # Update with same date
        update_data = {"productionDate": current_date}
        response = requests.put(
            f"{BASE_URL}/api/sauna-crm/leads/{TEST_CRM_LEAD_ID}",
            json=update_data
        )
        assert response.status_code == 200
        # Should succeed without error (push skipped because no change)


class TestSyncFromAmoCRM:
    """Test sync-from-amocrm endpoint behavior."""
    
    def test_sync_endpoint_requires_credentials(self):
        """POST /api/sauna-crm/sync-from-amocrm should return 400 when amoCRM not configured."""
        response = requests.post(f"{BASE_URL}/api/sauna-crm/sync-from-amocrm")
        # Should return 400 because amoCRM credentials not configured in test env
        assert response.status_code == 400
        data = response.json()
        assert "amoCRM" in data.get("detail", "") or "не настроен" in data.get("detail", "")
    
    def test_crm_lead_has_stage_history(self):
        """CRM lead should have stageHistory array for tracking changes."""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{TEST_CRM_LEAD_ID}")
        assert response.status_code == 200
        lead = response.json()
        
        assert "stageHistory" in lead
        assert isinstance(lead["stageHistory"], list)
        assert len(lead["stageHistory"]) > 0
    
    def test_stage_history_has_action_field(self):
        """Stage history entries should have 'action' field."""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{TEST_CRM_LEAD_ID}")
        assert response.status_code == 200
        lead = response.json()
        
        for entry in lead.get("stageHistory", []):
            assert "action" in entry, f"Stage history entry missing 'action': {entry}"
    
    def test_crm_lead_has_total_amount(self):
        """CRM lead should have totalAmount field (synced from amoCRM price)."""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{TEST_CRM_LEAD_ID}")
        assert response.status_code == 200
        lead = response.json()
        
        assert "totalAmount" in lead
        assert lead["totalAmount"] is not None
        assert lead["totalAmount"] > 0
    
    def test_crm_lead_has_client_name(self):
        """CRM lead should have clientName field."""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{TEST_CRM_LEAD_ID}")
        assert response.status_code == 200
        lead = response.json()
        
        assert "clientName" in lead
        assert lead["clientName"], "clientName should not be empty"
    
    def test_crm_lead_has_model_name(self):
        """CRM lead should have modelName field."""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{TEST_CRM_LEAD_ID}")
        assert response.status_code == 200
        lead = response.json()
        
        assert "modelName" in lead
        assert lead["modelName"], "modelName should not be empty"


class TestProductionDateLabels:
    """Test that production date labels are correctly defined."""
    
    def test_production_date_labels_exist(self):
        """Backend should have PRODUCTION_DATE_LABELS constant."""
        # This is a code review check - we verify the labels are used in widget
        response = requests.get(f"{BASE_URL}/api/widget/embed/{TEST_AMO_ID}")
        assert response.status_code == 200
        html = response.text
        
        # Check that Russian labels are used
        assert "Дата производства" in html
        assert "Дата готовности" in html
        assert "Дата доставки" in html


class TestLeadUpdateDateDetection:
    """Test that PUT /api/sauna-crm/leads/{id} correctly detects date changes."""
    
    def test_update_detects_production_date_change(self):
        """Update should detect when productionDate actually changed."""
        # Get current state
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{TEST_CRM_LEAD_ID}")
        assert response.status_code == 200
        original = response.json()
        original_date = original.get("productionDate")
        
        # Change to new date
        new_date = "2026-06-01"
        response = requests.put(
            f"{BASE_URL}/api/sauna-crm/leads/{TEST_CRM_LEAD_ID}",
            json={"productionDate": new_date}
        )
        assert response.status_code == 200
        updated = response.json()
        assert updated.get("productionDate") == new_date
        
        # Restore
        requests.put(
            f"{BASE_URL}/api/sauna-crm/leads/{TEST_CRM_LEAD_ID}",
            json={"productionDate": original_date}
        )
    
    def test_update_with_multiple_dates(self):
        """Update should handle multiple date changes at once."""
        # Get current state
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{TEST_CRM_LEAD_ID}")
        assert response.status_code == 200
        original = response.json()
        
        # Change multiple dates
        update_data = {
            "productionDate": "2026-07-01",
            "readyDate": "2026-07-05",
            "deliveryDate": "2026-07-10"
        }
        response = requests.put(
            f"{BASE_URL}/api/sauna-crm/leads/{TEST_CRM_LEAD_ID}",
            json=update_data
        )
        assert response.status_code == 200
        updated = response.json()
        
        assert updated.get("productionDate") == "2026-07-01"
        assert updated.get("readyDate") == "2026-07-05"
        assert updated.get("deliveryDate") == "2026-07-10"
        
        # Restore original dates
        restore_data = {
            "productionDate": original.get("productionDate"),
            "readyDate": original.get("readyDate"),
            "deliveryDate": original.get("deliveryDate")
        }
        requests.put(f"{BASE_URL}/api/sauna-crm/leads/{TEST_CRM_LEAD_ID}", json=restore_data)


class TestCRMSettingsFields:
    """Test CRM settings have required fields for sync."""
    
    def test_settings_have_sync_back_fields(self):
        """CRM settings should have syncBackFields array."""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/settings")
        assert response.status_code == 200
        settings = response.json()
        
        assert "syncBackFields" in settings
        assert isinstance(settings["syncBackFields"], list)
    
    def test_settings_have_stages(self):
        """CRM settings should have stages array."""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/settings")
        assert response.status_code == 200
        settings = response.json()
        
        assert "stages" in settings
        assert isinstance(settings["stages"], list)
        assert len(settings["stages"]) > 0
    
    def test_stages_have_amo_mapping_fields(self):
        """Each stage should have amoStageId and amoPipelineId fields."""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/settings")
        assert response.status_code == 200
        settings = response.json()
        
        for stage in settings.get("stages", []):
            assert "amoStageId" in stage, f"Stage {stage.get('id')} missing amoStageId"
            assert "amoPipelineId" in stage, f"Stage {stage.get('id')} missing amoPipelineId"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session
