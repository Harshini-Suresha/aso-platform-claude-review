"use client";

import PagePlaceholder from "@/components/PagePlaceholder";
import { FileText } from "lucide-react";

export default function ReportsPage() {
  return (
    <PagePlaceholder
      title="Reports"
      description="Automatically generated reports and exports"
      icon={FileText}
      sections={[
        {
          label: "Report Types",
          items: [
            "Research report",
            "Candidate summary",
            "FDA-style design summary",
            "Publication figures",
          ],
        },
        {
          label: "Export Formats",
          items: ["Excel export", "PDF export", "PowerPoint export"],
        },
        {
          label: "Supplementary",
          items: ["Methods section", "References", "Supplementary tables"],
        },
      ]}
    />
  );
}
