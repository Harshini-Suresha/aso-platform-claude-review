"use client";

import PagePlaceholder from "@/components/PagePlaceholder";
import { FlaskConical } from "lucide-react";

export default function ValidationPage() {
  return (
    <PagePlaceholder
      title="Experimental Validation"
      description="Bridge computational predictions to wet-lab experiments"
      icon={FlaskConical}
      sections={[
        {
          label: "Computational Validation",
          items: [
            "Literature evidence",
            "Existing ASOs",
            "Benchmarking",
            "Cross-reference databases",
          ],
        },
        {
          label: "Wet Lab Validation",
          items: [
            "RT-qPCR",
            "Western blot",
            "RNA-seq",
            "Cell viability",
            "Splicing efficiency",
            "Immunofluorescence",
            "Dose response",
            "IC50",
          ],
        },
        {
          label: "Integration",
          items: [
            "Upload experimental results",
            "Compare predictions vs experiment",
            "Efficacy correlation",
          ],
        },
      ]}
    />
  );
}
