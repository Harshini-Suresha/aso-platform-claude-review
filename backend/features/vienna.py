# backend/features/vienna.py
"""ViennaRNA (RNA) folding feature helpers.

Centralises calls to the ViennaRNA Python bindings so folding logic is not
scattered across the codebase. All methods return plain dicts so callers do
not need to know the RNA module API.
"""

import RNA


class ViennaRNAFeatures:
    @staticmethod
    def mfe(sequence: str) -> dict:
        """Minimum free energy (MFE) structure for a sequence."""
        structure, energy = RNA.fold(sequence)

        return {
            "structure": structure,
            "mfe": energy,
        }

    @staticmethod
    def ensemble(sequence: str) -> dict:
        """Equilibrium (partition function) features for a sequence."""
        fc = RNA.fold_compound(sequence)

        structure, mfe = fc.mfe()

        _, ensemble_energy = fc.pf()

        centroid, dist = fc.centroid()

        return {
            "mfe_structure": structure,
            "mfe": mfe,
            "ensemble_energy": ensemble_energy,
            "centroid_structure": centroid,
            "centroid_distance": dist,
        }
