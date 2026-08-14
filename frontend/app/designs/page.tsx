"use client";

import PagePlaceholder from "@/components/PagePlaceholder";
import { PenSquare } from "lucide-react";

export default function DesignsPage() {
  return (
    <PagePlaceholder
      title="ASO Design"
      description="Generate, rank, and compare ASO candidates"
      icon={PenSquare}
      sections={[
        {
          label: "ASO Generator",
          items: [
            "Sequence generation",
            "Length optimization",
            "Tm calculation",
            "GC% analysis",
            "Target exon selection",
          ],
        },
        {
          label: "Candidate Properties",
          items: [
            "Secondary structure",
            "Accessibility score",
            "Specificity rating",
            "Off-target score",
            "Immunogenicity prediction",
            "Chemical modifications",
          ],
        },
        {
          label: "Comparison & Export",
          items: [
            "Rank candidates",
            "Side-by-side comparison",
            "Export sequences",
            "Save to project",
          ],
        },
        {
          label: "Quick Analysis",
          items: ["Upload Sequence — raw FASTA analysis"],
        },
      ]}
    />
  );
}
