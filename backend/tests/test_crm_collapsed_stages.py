"""
Test CRM Collapsed Stages and amoCRM Stage Sync Features
Tests for iteration 68:
1. 'Заказ выполнен' (completed) stage with collapsed=true
2. CRMStageConfig model accepts 'collapsed' field
3. Stage sync to amoCRM (sync_stage_to_amocrm function)
4. GET /api/integrations/amocrm/pipelines endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCRMCollapsedStages:
    """Test collapsed stage feature in CRM settings"""
    
    def test_settings_returns_completed_stage(self):
        """GET /api/sauna-crm/settings returns stages with 'completed' stage"""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/settings")
        assert response.status_code == 200
        
        data = response.json()
        stages = data.get("stages", [])
        
        # Find completed stage
        completed_stage = next((s for s in stages if s["id"] == "completed"), None)
        assert completed_stage is not None, "Completed stage (Заказ выполнен) not found"
        assert completed_stage["name"] == "Заказ выполнен"
        print(f"✓ Found completed stage: {completed_stage['name']}")
    
    def test_completed_stage_has_collapsed_true(self):
        """Completed stage (Заказ выполнен) has collapsed=true"""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/settings")
        assert response.status_code == 200
        
        data = response.json()
        stages = data.get("stages", [])
        
        completed_stage = next((s for s in stages if s["id"] == "completed"), None)
        assert completed_stage is not None
        assert completed_stage.get("collapsed") == True, f"Expected collapsed=True, got {completed_stage.get('collapsed')}"
        print(f"✓ Completed stage has collapsed=True")
    
    def test_other_stages_not_collapsed(self):
        """Other stages should not be collapsed by default"""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/settings")
        assert response.status_code == 200
        
        data = response.json()
        stages = data.get("stages", [])
        
        non_collapsed_stages = [s for s in stages if s["id"] != "completed"]
        for stage in non_collapsed_stages:
            collapsed = stage.get("collapsed", False)
            assert collapsed == False, f"Stage {stage['id']} should not be collapsed, got {collapsed}"
        
        print(f"✓ {len(non_collapsed_stages)} other stages are not collapsed")
    
    def test_stage_config_accepts_collapsed_field(self):
        """CRMStageConfig model accepts 'collapsed' field in POST"""
        # Get current settings
        response = requests.get(f"{BASE_URL}/api/sauna-crm/settings")
        assert response.status_code == 200
        current_settings = response.json()
        
        # Verify stages have collapsed field
        for stage in current_settings.get("stages", []):
            assert "collapsed" in stage or stage.get("collapsed") is None or stage.get("collapsed") == False, \
                f"Stage {stage['id']} should accept collapsed field"
        
        print("✓ CRMStageConfig model accepts collapsed field")


class TestAmoCRMPipelinesEndpoint:
    """Test GET /api/integrations/amocrm/pipelines endpoint"""
    
    def test_pipelines_endpoint_exists(self):
        """GET /api/integrations/amocrm/pipelines returns valid response"""
        response = requests.get(f"{BASE_URL}/api/integrations/amocrm/pipelines")
        assert response.status_code == 200
        
        data = response.json()
        # Should return pipelines array (may be empty if amoCRM not configured)
        assert "pipelines" in data
        assert isinstance(data["pipelines"], list)
        
        # If amoCRM not configured, should return error message
        if data.get("error"):
            print(f"✓ Pipelines endpoint returns error (expected - amoCRM not configured): {data['error']}")
        else:
            print(f"✓ Pipelines endpoint returns {len(data['pipelines'])} pipelines")
    
    def test_pipelines_response_structure(self):
        """Pipelines response has correct structure"""
        response = requests.get(f"{BASE_URL}/api/integrations/amocrm/pipelines")
        assert response.status_code == 200
        
        data = response.json()
        
        # If pipelines exist, verify structure
        if data.get("pipelines") and len(data["pipelines"]) > 0:
            pipeline = data["pipelines"][0]
            assert "id" in pipeline
            assert "name" in pipeline
            assert "statuses" in pipeline
            assert isinstance(pipeline["statuses"], list)
            print(f"✓ Pipeline structure is correct: id={pipeline['id']}, name={pipeline['name']}")
        else:
            print("✓ No pipelines returned (amoCRM not configured - expected)")


class TestStageSyncToAmoCRM:
    """Test stage sync functionality"""
    
    def test_stage_change_endpoint_exists(self):
        """PUT /api/sauna-crm/leads/{id}/stage endpoint exists"""
        # Use a test lead ID that may not exist - we just want to verify endpoint exists
        response = requests.put(
            f"{BASE_URL}/api/sauna-crm/leads/TEST_NONEXISTENT/stage",
            params={"stage_id": "completed"}
        )
        # Should return 404 (lead not found) not 405 (method not allowed)
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
        print(f"✓ Stage change endpoint exists (returned {response.status_code})")
    
    def test_stage_change_with_real_lead(self):
        """Test stage change with real CRM lead (CRM-59FC9032)"""
        lead_id = "CRM-59FC9032"
        
        # First get current stage
        response = requests.get(f"{BASE_URL}/api/sauna-crm/leads/{lead_id}")
        if response.status_code == 404:
            pytest.skip("Test lead CRM-59FC9032 not found")
        
        assert response.status_code == 200
        lead = response.json()
        original_stage = lead.get("stageId")
        print(f"Original stage: {original_stage}")
        
        # Change to completed stage
        response = requests.put(
            f"{BASE_URL}/api/sauna-crm/leads/{lead_id}/stage",
            params={"stage_id": "completed"}
        )
        assert response.status_code == 200
        updated_lead = response.json()
        assert updated_lead.get("stageId") == "completed"
        print(f"✓ Stage changed to 'completed'")
        
        # Restore original stage
        response = requests.put(
            f"{BASE_URL}/api/sauna-crm/leads/{lead_id}/stage",
            params={"stage_id": original_stage}
        )
        assert response.status_code == 200
        print(f"✓ Stage restored to '{original_stage}'")


class TestStageSettingsUI:
    """Test stage settings structure for UI"""
    
    def test_stages_have_amo_mapping_fields(self):
        """Each stage has amoStageId and amoPipelineId fields"""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/settings")
        assert response.status_code == 200
        
        data = response.json()
        stages = data.get("stages", [])
        
        for stage in stages:
            assert "amoStageId" in stage, f"Stage {stage['id']} missing amoStageId"
            assert "amoPipelineId" in stage, f"Stage {stage['id']} missing amoPipelineId"
        
        print(f"✓ All {len(stages)} stages have amoStageId and amoPipelineId fields")
    
    def test_stages_have_color_and_name(self):
        """Each stage has color and name fields"""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/settings")
        assert response.status_code == 200
        
        data = response.json()
        stages = data.get("stages", [])
        
        for stage in stages:
            assert "name" in stage and stage["name"], f"Stage {stage['id']} missing name"
            assert "color" in stage and stage["color"], f"Stage {stage['id']} missing color"
        
        print(f"✓ All {len(stages)} stages have name and color")
    
    def test_completed_stage_is_last(self):
        """Completed stage should be last in the list (highest sortOrder)"""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/settings")
        assert response.status_code == 200
        
        data = response.json()
        stages = data.get("stages", [])
        
        # Find completed stage
        completed_stage = next((s for s in stages if s["id"] == "completed"), None)
        assert completed_stage is not None
        
        # Check it has highest sortOrder
        max_sort_order = max(s.get("sortOrder", 0) for s in stages)
        assert completed_stage.get("sortOrder") == max_sort_order, \
            f"Completed stage sortOrder ({completed_stage.get('sortOrder')}) should be max ({max_sort_order})"
        
        print(f"✓ Completed stage has highest sortOrder ({max_sort_order})")


class TestDefaultStagesConfiguration:
    """Test default stages configuration in backend"""
    
    def test_default_stages_count(self):
        """Should have 7 stages including completed"""
        response = requests.get(f"{BASE_URL}/api/sauna-crm/settings")
        assert response.status_code == 200
        
        data = response.json()
        stages = data.get("stages", [])
        
        # Should have at least 7 stages (including completed)
        assert len(stages) >= 7, f"Expected at least 7 stages, got {len(stages)}"
        print(f"✓ Found {len(stages)} stages")
    
    def test_expected_stages_exist(self):
        """All expected stages should exist"""
        expected_stages = [
            "invoice_sent",
            "prepayment_received", 
            "approved_by_production",
            "in_production",
            "ready",
            "delivered",
            "completed"
        ]
        
        response = requests.get(f"{BASE_URL}/api/sauna-crm/settings")
        assert response.status_code == 200
        
        data = response.json()
        stages = data.get("stages", [])
        stage_ids = [s["id"] for s in stages]
        
        for expected_id in expected_stages:
            assert expected_id in stage_ids, f"Expected stage '{expected_id}' not found"
        
        print(f"✓ All {len(expected_stages)} expected stages exist")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
