export interface HgvsParseResult {
  parsed: boolean;
  type?: string;
  cdsStart?: number;
  cdsEnd?: number;
  length?: number;
  reason?: string;
}

// Regex-based subset of HGVS coding-DNA (c.) notation. This is a *simplified*
// parser that extracts a CDS position and variant type for the design pipeline;
// it is not a full HGVS-grammar implementation (no transcript/reference
// validation). It mirrors the backend parser in
// backend/services/gene_silencing_service.py.
// Groups: 1=start, 2=end, 3=ref, 4=alt, 5=del_seq, 6=dup_seq, 7=ins_seq,
// 8=delins_del, 9=delins_ins
const HGVS_C_PATTERN =
  /^c\.(\d+)(?:_(\d+))?(?:(?:([ACGT]+)>([ACGT]+))|del([ACGT]*)|dup([ACGT]*)|ins([ACGT]+)|del([ACGT]*)ins([ACGT]+))$/i;

// HGVS defines c.1 as the A of the ATG start codon, which maps directly to
// index 0 of the CDS sequence fetched by get_target_analysis() — no separate
// UTR-length lookup is needed.
export function parseHgvsC(raw: string): HgvsParseResult {
  const variant = raw.trim();
  if (!variant) return { parsed: false, reason: "No variant provided." };

  const lowered = variant.toLowerCase();

  // Intronic offsets, 5' UTR (c.-N), and 3' UTR (c.*N) positions cannot be
  // expressed against a CDS-only sequence.
  if (/^c\.\d+[+-]\d+/.test(lowered))
    return {
      parsed: false,
      reason: "Deep intronic position — not expressible against the fetched CDS-only sequence.",
    };
  if (/^c\.-\d+/.test(lowered))
    return { parsed: false, reason: "5' UTR position — outside the fetched CDS." };
  if (/^c\.\*\d+/.test(lowered))
    return { parsed: false, reason: "3' UTR position — outside the fetched CDS." };

  // Protein (p.) notation does not map to a CDS index without a codon-table
  // lookup — a separate feature, not silently ignored here.
  if (lowered.startsWith("p."))
    return {
      parsed: false,
      reason:
        "Protein-level (p.) notation is out of scope — provide the coding-DNA c. equivalent (e.g. c.1521_1523del) for CDS-based allele-specific design.",
    };

  const m = variant.match(HGVS_C_PATTERN);
  if (!m)
    return {
      parsed: false,
      reason:
        "Not a recognized c. notation pattern. Expected e.g. c.1521C>T or c.1521_1523del.",
    };

  const start = parseInt(m[1], 10) - 1; // HGVS is 1-based; convert to 0-based index
  const end = m[2] ? parseInt(m[2], 10) - 1 : start;

  if (m[3] && m[4])
    return { parsed: true, type: "substitution", cdsStart: start, cdsEnd: start, length: 1 };
  if (m[5] != null && !m[9])
    return { parsed: true, type: "deletion", cdsStart: start, cdsEnd: end, length: end - start + 1 };
  if (m[6] != null)
    return { parsed: true, type: "duplication", cdsStart: start, cdsEnd: end, length: end - start + 1 };
  if (m[7]) return { parsed: true, type: "insertion", cdsStart: start, cdsEnd: start, length: 0 };
  if (m[9]) return { parsed: true, type: "delins", cdsStart: start, cdsEnd: end, length: end - start + 1 };

  return { parsed: false, reason: "Unhandled variant type." };
}
