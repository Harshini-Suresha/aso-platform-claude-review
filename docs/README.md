# ASO Platform

A biological information retrieval and antisense oligonucleotide (ASO)
design platform.

## Build order

1. Phase 1 - Backend architecture (this scaffold), no APIs yet.
2. Phase 2 - Database connectors (backend/connectors/*), one connector per database.
3. Phase 3 - Biological Information Retrieval Engine (backend/services/retrieveGene.ts).
4. Phase 4 - Rulebook Engine (backend/rulebooks/A1..A26), one mechanism per folder.
5. Phase 5 - Design Engines (backend/engines/*).
6. Only then start connecting real APIs, in this order:
   1. Ensembl REST API (transcripts, exons, FASTA, coordinates)
   2. NCBI E-utilities (gene IDs, summaries, RefSeq, PubMed links)
   3. UniProt REST API (protein, protein FASTA, domains, function)
   4. ClinVar (variants, clinical significance)
   5. GTEx (expression)
   6. Reactome (pathways)
   7. STRING (protein interactions)
   8. PubMed (literature)

## First milestone

Typing a gene symbol (e.g. DMD) should return Gene Name, Transcript,
Protein, Transcript FASTA, Protein FASTA, Exon count, and Chromosome -
powered by the Ensembl connector only. Once this works, add NCBI, then
UniProt, then ClinVar, and so on.

## Recommended stack

- Frontend: Next.js 15 + React + TypeScript + Tailwind CSS + shadcn/ui
- Backend: FastAPI (Python)
- Database: PostgreSQL + SQLAlchemy
- Background jobs: Celery (later)
- Caching: Redis (later)
- Bioinformatics libs: Biopython, pandas, pysam, pyensembl
- Deployment: Docker + Vercel (frontend) + Railway/Render/AWS (backend)
