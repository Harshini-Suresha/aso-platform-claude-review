"use client";

import PagePlaceholder from "@/components/PagePlaceholder";
import { Crosshair } from "lucide-react";

export default function TargetsPage() {
  return (
    <PagePlaceholder
      title="Target Discovery"
      description="Gene-centric workspace for target exploration"
      icon={Crosshair}
      sections={[
        {
          label: "Gene Overview",
          items: ["Gene summary", "Function", "Aliases", "Genomic location"],
        },
        {
          label: "Transcript & Protein",
          items: [
            "Transcript explorer",
            "Protein structure",
            "Expression data",
            "Domain architecture",
          ],
        },
        {
          label: "Disease & Variants",
          items: [
            "Disease associations",
            "Known variants",
            "Clinical significance",
            "Drug landscape",
          ],
        },
        {
          label: "Evidence",
          items: [
            "Literature",
            "Pathways",
            "Protein interactions",
            "Constraint metrics",
            "Existing therapies",
            "Therapeutic opportunity",
          ],
        },
      ]}
    />
  );
}
