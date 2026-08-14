# backend/services/rulebook_service.py
import json
import os

class RulebookService:
    def __init__(self, compiled_db_path="backend/database/compiled_rulebooks.json"):
        self.db_path = compiled_db_path
        self.data = self._load_db()

    def _load_db(self):
        if os.path.exists(self.db_path):
            with open(self.db_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {"goals": [], "mappings": {}, "mechanisms": {}}

    def get_mechanisms_for_goal(self, goal_id: str) -> list:
        """Returns all detailed mechanisms linked to a selected therapeutic goal."""
        mech_ids = self.data.get("mappings", {}).get(goal_id, [])
        return [self.data["mechanisms"][m_id] for m_id in mech_ids if m_id in self.data["mechanisms"]]

    def validate_biological_eligibility(self, mechanism_id: str, variant_type: str) -> dict:
        """
        Module 1 Execution Logic
        Validates if user context fits design boundaries of specific mechanism sheets
        """
        mechanism = self.data.get("mechanisms", {}).get(mechanism_id)
        if not mechanism:
            return {"eligible": False, "reason": "Mechanism rulebook entry not found."}

        # Case-insensitive validation against allowed array
        allowed_variants = [v.lower() for v in mechanism.get("suitableVariantTypes", [])]
        
        if any(variant_type.lower() in v for v in allowed_variants) or not allowed_variants:
            return {
                "eligible": True,
                "mechanismName": mechanism.get("mechanismName"),
                "chemistry": mechanism.get("chemistry"),
                "designRules": mechanism.get("designRules")
            }
        
        return {
            "eligible": False,
            "reason": f"Variant track '{variant_type}' does not meet safety constraints for {mechanism.get('mechanismName')}."
        }