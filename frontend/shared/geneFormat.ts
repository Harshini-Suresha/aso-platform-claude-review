/**
 * Organism-specific gene symbol formatting conventions.
 *
 * After Ensembl returns the official symbol, apply the correct
 * display casing for the selected organism.
 */

type FormatRule = "upper" | "title" | "lower";

const ORGANISM_FORMAT: Record<string, FormatRule> = {
  // Tier 1 — Clinical
  human: "upper",
  mouse: "title",
  rat: "title",
  cynomolgus: "title",
  rhesus: "title",

  // Tier 2 — Model
  zebrafish: "lower",
  fruitfly: "lower",
  celegans: "lower",
  yeast: "upper",
  fissionyeast: "upper",

  // Tier 3 — Veterinary
  dog: "title",
  cat: "title",
  pig: "title",
  cow: "title",
  horse: "title",
  sheep: "title",
  goat: "title",
  chicken: "title",

  // Tier 4 — Plants
  arabidopsis: "upper",
  rice: "upper",
  maize: "upper",
  wheat: "upper",
  tomato: "upper",

  // Tier 6 — Bacteria
  ecoli: "upper",
  saureus: "upper",
  mtuberculosis: "upper",
  paeruginosa: "upper",
};

function applyRule(symbol: string, rule: FormatRule): string {
  switch (rule) {
    case "upper":
      return symbol.toUpperCase();
    case "lower":
      return symbol.toLowerCase();
    case "title":
      return symbol.charAt(0).toUpperCase() + symbol.slice(1).toLowerCase();
  }
}

/**
 * Format an official gene symbol according to the organism's naming convention.
 * Falls back to Title Case for unknown organisms.
 */
export function formatGeneSymbol(symbol: string, organismId: string): string {
  const clean = symbol.trim();
  if (!clean) return "";
  const rule = ORGANISM_FORMAT[organismId] ?? "title";
  return applyRule(clean, rule);
}

/**
 * Returns true if the organism typically uses ALL-CAPS gene symbols.
 */
export function isUpperOrganism(organismId: string): boolean {
  return ORGANISM_FORMAT[organismId] === "upper";
}
