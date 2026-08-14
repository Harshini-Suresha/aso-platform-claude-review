# backend/database/parser.py
import os
import csv
import json

class ASOPlatformParser:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir

    def parse_therapeutic_goals(self) -> list:
        """Parses TG.csv into a structured list of goals."""
        goals = []
        tg_path = os.path.join(self.data_dir, "ASO mechanisms.xlsx - TG.csv")
        if not os.path.exists(tg_path):
            return goals

        with open(tg_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                goals.append({
                    "goalId": row.get("Goal ID", "").strip(),
                    "name": row.get("Therapeutic Goal", "").strip(),
                    "description": row.get("Description", "").strip()
                })
        return goals

    def parse_mappings(self) -> dict:
        """Parses Mapping.csv to see which 'A' rules fit under which 'TG' track."""
        mappings = {}
        mapping_path = os.path.join(self.data_dir, "ASO mechanisms.xlsx - Mapping.csv")
        if not os.path.exists(mapping_path):
            return mappings

        with open(mapping_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                goal = row.get("Therapeutic Goal", "")
                # Extract the key ID prefix (e.g., 'TG01')
                goal_id = goal.split("–")[0].strip() if "–" in goal else goal.strip()
                
                mechanisms_raw = row.get("Mechanisms", "")
                # Handle cases wrapped in quotes or comma separated strings
                mech_ids = [m.strip().replace('"', '') for m in mechanisms_raw.split(",") if m.strip()]
                mappings[goal_id] = mech_ids
        return mappings

    def parse_single_mechanism(self, mech_id: str) -> dict:
        """Dynamically ingests individual files from A1.csv to A26.csv."""
        file_name = f"ASO mechanisms.xlsx - {mech_id}.csv"
        file_path = os.path.join(self.data_dir, file_name)
        if not os.path.exists(file_path):
            return None

        rulebook = {
            "mechanismId": mech_id,
            "suitableVariantTypes": [],
            "typicalDiseases": [],
            "designRules": [],
            "fdaApprovedDrugs": [],
            "clinicalTrialExamples": [],
            "references": []
        }

        with open(file_path, mode='r', encoding='utf-8') as f:
            reader = csv.reader(f)
            for row in reader:
                if not row or len(row) < 2:
                    continue
                
                field_key = row[0].strip()
                field_val = row[1].strip()

                # Core Metadata Fields mapping
                if field_key == "Mechanism Name":
                    rulebook["mechanismName"] = field_val
                elif field_key == "Platform":
                    rulebook["platform"] = field_val
                elif field_key == "Molecule Type":
                    rulebook["moleculeType"] = field_val
                elif field_key == "Mechanism Category":
                    rulebook["mechanismCategory"] = field_val
                elif field_key == "Therapeutic Goal":
                    rulebook["therapeuticGoal"] = field_val
                elif field_key == "Molecular Defect":
                    rulebook["molecularDefect"] = field_val
                elif field_key == "Disease Mechanism":
                    rulebook["diseaseMechanism"] = field_val
                elif field_key == "RNA Target Region":
                    rulebook["rnaTargetRegion"] = field_val
                elif field_key == "Transcript Requirement":
                    rulebook["transcriptRequirement"] = field_val
                elif field_key in ["Chemistry", "Chemistry / Therapeutic Molecule", "Therapeutic Molecule / Chemistry"]:
                    rulebook["chemistry"] = field_val
                elif field_key == "Typical Length":
                    rulebook["typicalLength"] = field_val
                elif field_key == "Secondary Structure Requirement":
                    rulebook["secondaryStructureRequirement"] = field_val
                elif field_key == "Off-target Considerations":
                    rulebook["offTargetConsiderations"] = field_val
                elif field_key == "Advantages":
                    rulebook["advantages"] = field_val
                elif field_key == "Limitations":
                    rulebook["limitations"] = field_val
                elif field_key == "Evidence Level":
                    rulebook["evidenceLevel"] = field_val
                
                # Arrays Parsing
                elif field_key == "Suitable Variant Types" or field_key == "Suitable Target Types":
                    rulebook["suitableVariantTypes"] = [v.strip() for v in field_val.split(";") if v.strip()]
                elif field_key == "Typical Diseases":
                    rulebook["typicalDiseases"] = [d.strip() for d in field_val.split(";") if d.strip()]
                elif field_key == "Design Rules":
                    rulebook["designRules"] = [r.strip() for r in field_val.split(";") if r.strip()]
                elif field_key == "FDA-approved Drugs":
                    rulebook["fdaApprovedDrugs"] = [d.strip() for d in field_val.split(";") if d.strip()]
                elif field_key == "Clinical Trial Examples":
                    rulebook["clinicalTrialExamples"] = [c.strip() for c in field_val.split(";") if c.strip()]

                # Capture embedded literature lines if they match standard sheet layouts
                if len(row) >= 11 and row[7].startswith("R"):
                    ref_id = row[7].strip()
                    paper = row[8].strip()
                    doi = row[9].strip()
                    usage = row[10].strip()
                    if paper and paper != "Paper":
                        rulebook["references"].append({
                            "refId": ref_id,
                            "paperName": paper,
                            "doiOrPmid": doi,
                            "usedFor": usage
                        })

        return rulebook

    def compile_full_knowledge_base(self, output_json_path: str):
        """Assembles all parsing arrays into one unified app rulebook bundle."""
        goals = self.parse_therapeutic_goals()
        mappings = self.parse_mappings()
        
        compiled_data = {
            "goals": goals,
            "mappings": mappings,
            "mechanisms": {}
        }

        # Gather every active rulebook mentioned in mapping paths
        all_mech_ids = set()
        for mechs in mappings.values():
            all_mech_ids.update(mechs)

        for m_id in sorted(all_mech_ids):
            parsed_mech = self.parse_single_mechanism(m_id)
            if parsed_mech:
                compiled_data["mechanisms"][m_id] = parsed_mech

        with open(output_json_path, 'w', encoding='utf-8') as out_f:
            json.dump(compiled_data, out_f, indent=2)
        print(f"✓ Successfully compiled target rulebooks into {output_json_path}")

# Quick script execute context
if __name__ == "__main__":
    # Assumes data sits at project root level or specify your path
    parser = ASOPlatformParser(data_dir=".")
    parser.compile_full_knowledge_base("backend/database/compiled_rulebooks.json")