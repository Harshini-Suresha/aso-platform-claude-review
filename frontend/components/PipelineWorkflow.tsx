"use client";

import { useState } from "react";
import BasicInfoForm from "./BasicInfoForm";

export default function PipelineWorkflow() {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Match the exact state structure from your editor screenshot:
  const [form, setForm] = useState({
    organism: "Homo sapiens (Human)",
    diseaseName: "",
    geneSymbol: "",
  });

  // Keep track of dynamically retrieved biological details
  const [retrievedData, setRetrievedData] = useState<any>(null);

  // Helper setters for individual sub-properties of the single form state object
  const setOrganism = (val: string) => {
    setForm((prev) => ({ ...prev, organism: val }));
  };

  const setDiseaseName = (val: string) => {
    setForm((prev) => ({ ...prev, diseaseName: val }));
  };

  const setGeneSymbol = (val: string) => {
    setForm((prev) => ({ ...prev, geneSymbol: val }));
  };

  // Triggers when user clicks 'Load Gene'
  const handleLoadGene = async () => {
    if (!form.geneSymbol.trim()) return;
    setLoading(true);
    setError(null);

    try {
      // Connect to the python sequence retriever backend
      const response = await fetch("http://localhost:8000/api/pipeline/initialize-target", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gene_symbol: form.geneSymbol.trim(),
          organism: form.organism,
        }),
      });

      if (!response.ok) {
        const errDetail = await response.json();
        throw new Error(errDetail.detail || "Failed to retrieve transcript sequence.");
      }

      const data = await response.json();

      setRetrievedData({
        ...form,
        geneSymbol: data.gene_symbol,
        primaryTranscript: data.primary_transcript,
        transcriptDetails: data.transcript_details,
        exonCoordinates: data.exon_coordinates,
        totalExons: data.total_exons,
      });

      setIsSubmitted(true);
      setCurrentStep(4); // Advance forward in the step hierarchy
    } catch (err: any) {
      console.error("Workflow initialization error:", err);
      setError(err.message || "An error occurred fetching gene information.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">ASO Design Studio</h1>
        <p className="text-sm text-slate-500">Step {currentStep} of your therapeutic workflow</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <BasicInfoForm
            organism={form.organism}
            setOrganism={setOrganism}
            diseaseName={form.diseaseName}
            setDiseaseName={setDiseaseName}
            geneSymbol={form.geneSymbol}
            setGeneSymbol={setGeneSymbol}
            onLoadGene={handleLoadGene}
            loading={loading}
          />

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-[13px] font-medium text-red-600 border border-red-100">
              {error}
            </div>
          )}
        </div>

        {/* Sidebar Info/Status block */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-slate-800 text-sm">Target Status</h3>
            {!isSubmitted ? (
              <p className="mt-2 text-[13px] text-slate-400">
                Provide organism, disease, and gene symbol to auto-retrieve sequences.
              </p>
            ) : (
              <div className="mt-4 space-y-3 text-[13px]">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500">Target resolved:</span>
                  <span className="font-semibold text-slate-800">{retrievedData?.geneSymbol}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500">Transcript:</span>
                  <span className="font-mono bg-slate-50 border px-1 rounded text-slate-700">
                    {retrievedData?.primaryTranscript}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500">Exon count:</span>
                  <span className="font-medium text-slate-800">{retrievedData?.totalExons} exons</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}