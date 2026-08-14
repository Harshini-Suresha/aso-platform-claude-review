"use client";

import PagePlaceholder from "@/components/PagePlaceholder";
import { BarChart3, FlaskConical, Network, BookMarked, Shield } from "lucide-react";

export default function AnalysisPage() {
  return (
    <PagePlaceholder
      title="Computational Analysis"
      description="In-depth computational analyses of your sequences and target"
      icon={BarChart3}
      sections={[
        {
          label: "Pathway & Function",
          items: [
            "KEGG pathway mapping",
            "Reactome reaction networks",
            "Pathway Commons integration",
            "GO term enrichment (BP / MF / CC)",
            "STRING PPI network analysis",
          ],
        },
        {
          label: "Expression & Tissue",
          items: [
            "GTEx tissue expression (v8)",
            "Human Protein Atlas tissue map",
            "Single-cell prevalence (HPA)",
            "Expression stability (CV)",
            "Vital organ expression safety",
          ],
        },
        {
          label: "Target Vulnerability",
          items: [
            "gnomAD constraint metrics (pLI, LOEUF)",
            "ClinGen haploinsufficiency",
            "DepMap essentiality score",
            "RNA half-life prediction",
            "Preclinical conservation score",
          ],
        },
        {
          label: "Safety & Delivery",
          items: [
            "Nuclease sensitivity & half-life",
            "Immunogenicity risk (TLR7/8/9)",
            "Off-target hybridization risk",
            "Hemolysis potential",
          ],
        },
        {
          label: "Results",
          items: ["Interactive plots", "Export data", "Compare sequences"],
        },
      ]}
    />
  );
}
