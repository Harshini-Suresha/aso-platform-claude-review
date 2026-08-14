"use client";

import PagePlaceholder from "@/components/PagePlaceholder";
import { BookOpen } from "lucide-react";

export default function KnowledgePage() {
  return (
    <PagePlaceholder
      title="Knowledge Base"
      description="Integrated biological encyclopedia and design guidelines"
      icon={BookOpen}
      sections={[
        {
          label: "Searchable Topics",
          items: [
            "Genes",
            "Diseases",
            "Mechanisms",
            "Proteins",
            "Databases",
            "Protocols",
          ],
        },
        {
          label: "Drug & Clinical",
          items: [
            "Drug approvals",
            "Clinical trials",
            "RNA chemistry",
            "Design guidelines",
          ],
        },
        {
          label: "ASO Chemistry",
          items: [
            "ASO modification guide",
            "PMO",
            "2'-MOE",
            "LNA",
            "Gapmers",
          ],
        },
      ]}
    />
  );
}
