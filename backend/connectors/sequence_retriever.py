import os
import requests
from Bio import Entrez, SeqIO

# Provide your email to NCBI so they can contact you if there's an issue/traffic spike
Entrez.email = os.getenv("NCBI_EMAIL", "harshinisuresha7@gmail.com")
Entrez.tool = "RNATherapeuticsPipeline"


class SequenceRetriever:
    """
    Handles dynamic connection to NCBI and Ensembl to retrieve authentic
    transcript metadata, full FASTA sequences, and precise exon-intron coordinate maps.
    """

    @staticmethod
    def get_transcript_id_from_symbol(gene_symbol: str, organism: str = "Homo sapiens") -> str:
        """
        Queries NCBI Gene to find the primary RefSeq transcript accession (e.g., NM_004006 for DMD).
        """
        try:
            term = f"{gene_symbol}[Gene Name] AND {organism}[Organism] AND RefSeq[Filter]"
            handle = Entrez.esearch(db="gene", term=term, retmode="xml")
            record = Entrez.read(handle)
            handle.close()

            if not record["IdList"]:
                raise ValueError(f"No NCBI gene entry found for symbol: {gene_symbol}")

            gene_id = record["IdList"][0]
            
            # Fetch summary to extract the RefSeq transcript list
            summary_handle = Entrez.esummary(db="gene", id=gene_id, retmode="xml")
            summary_record = Entrez.read(summary_handle)
            summary_handle.close()

            # Navigate the NCBI Document Summary to find the preferred NM_ or NR_ transcript
            doc_summary = summary_record["DocumentSummarySet"]["DocumentSummary"][0]
            # Try to grab the genomic/transcript details
            for accession in doc_summary.get("GenomicInfo", []):
                # Fallback extraction logic or direct search on nucleotide db
                pass

            # A highly reliable secondary fallback: search Nucleotide directly for the mRNA
            refseq_term = f"{gene_symbol}[Gene] AND {organism}[Organism] AND mRNA[Filter] AND RefSeq[Filter]"
            nt_handle = Entrez.esearch(db="nucleotide", term=refseq_term, retmode="xml")
            nt_record = Entrez.read(nt_handle)
            nt_handle.close()

            if nt_record["IdList"]:
                # Fetch summary of the top nucleotide result to get its NM_ access code
                feat_handle = Entrez.esummary(db="nucleotide", id=nt_record["IdList"][0], retmode="xml")
                feat_rec = Entrez.read(feat_handle)
                feat_handle.close()
                accession = feat_rec[0]['Caption']
                return accession
            
            raise ValueError(f"No RefSeq mRNA transcripts found for {gene_symbol}")

        except Exception as e:
            raise RuntimeError(f"NCBI Lookup failed for {gene_symbol}: {str(e)}")

    @staticmethod
    def fetch_ncbi_transcript_sequence(transcript_id: str) -> dict:
        """
        Fetches the complete nucleotide sequence and description for a RefSeq transcript ID (e.g. NM_004006.3).
        """
        try:
            handle = Entrez.efetch(db="nucleotide", id=transcript_id, rettype="fasta", retmode="text")
            seq_record = SeqIO.read(handle, "fasta")
            handle.close()
            
            return {
                "transcript_id": transcript_id,
                "sequence": str(seq_record.seq),
                "length": len(seq_record.seq),
                "description": seq_record.description
            }
        except Exception as e:
            raise RuntimeError(f"Failed to fetch FASTA sequence from NCBI for {transcript_id}: {str(e)}")

    @staticmethod
    def fetch_ensembl_exons(gene_symbol: str, species: str = "human") -> list:
        """
        Uses the Ensembl REST API to retrieve the exact genomic coordinates,
        chromosome, strand, and sequence boundaries for all exons of the target gene.
        """
        server = "https://rest.ensembl.org"
        
        # Step 1: Lookup Gene ID by Symbol
        ext_lookup = f"/lookup/symbol/{species}/{gene_symbol}?expand=1"
        r = requests.get(server + ext_lookup, headers={"Content-Type": "application/json"})
        
        if not r.ok:
            r.raise_for_status()
            
        gene_data = r.json()
        gene_id = gene_data.get("id")
        
        # Step 2: Fetch Exons for the Canonical/Primary Transcript
        # We will parse the transcripts nested under this gene lookup
        transcripts = gene_data.get("Transcript", [])
        if not transcripts:
            raise ValueError(f"No transcripts found in Ensembl for {gene_symbol}")
            
        # Select the canonical or the longest transcript for complete mapping
        primary_transcript = next((t for t in transcripts if t.get("is_canonical") == 1), transcripts[0])
        
        exons_raw = primary_transcript.get("Exon", [])
        
        # Parse into a clean, structured coordinate map sorted by rank (5' to 3')
        exons_parsed = []
        for index, exon in enumerate(exons_raw):
            exons_parsed.append({
                "exon_number": index + 1,
                "exon_id": exon.get("id"),
                "chromosome": exon.get("seq_region_name"),
                "start": exon.get("start"),
                "end": exon.get("end"),
                "strand": exon.get("strand"),
                "length": exon.get("end") - exon.get("start") + 1
            })
            
        # Ensure they are sorted numerically by their biological progression
        exons_parsed.sort(key=lambda x: x["exon_number"])
        return exons_parsed