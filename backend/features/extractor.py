from backend.features.vienna import ViennaRNAFeatures
from backend.features.accessibility import AccessibilityFeatures


class FeatureExtractor:
    @staticmethod
    def gc_content(sequence: str):
        sequence = sequence.upper()
        gc = sequence.count("G") + sequence.count("C")
        return gc / len(sequence)

    @staticmethod
    def sequence_length(sequence: str):
        return len(sequence)

    @staticmethod
    def au_content(sequence):
        au = sequence.count("A") + sequence.count("U")
        return au / len(sequence)

    @staticmethod
    def gc_ratio(sequence):
        gc = sequence.count("G") + sequence.count("C")
        return gc / len(sequence)

    @staticmethod
    def has_poly_u(sequence):
        return "UUUU" in sequence

    @staticmethod
    def has_poly_g(sequence):
        return "GGGG" in sequence

    @staticmethod
    def extract(sample):
        thermo = ViennaRNAFeatures.ensemble(sample["mrna_sequence"])

        base = {
            "gc_content": FeatureExtractor.gc_content(sample["mrna_sequence"]),
            "length": FeatureExtractor.sequence_length(sample["mrna_sequence"]),
            "au_content": FeatureExtractor.au_content(sample["mrna_sequence"]),
            "gc_ratio": FeatureExtractor.gc_ratio(sample["mrna_sequence"]),
            "has_poly_u": FeatureExtractor.has_poly_u(sample["mrna_sequence"]),
            "has_poly_g": FeatureExtractor.has_poly_g(sample["mrna_sequence"]),
            "mfe": thermo["mfe"],
            "ensemble_energy": thermo["ensemble_energy"],
            "centroid_distance": thermo["centroid_distance"],
        }

        acc = AccessibilityFeatures.compute(
            sample["mrna_sequence"],
            sample["aso_sequence"],
        )
        base.update(acc)

        return base