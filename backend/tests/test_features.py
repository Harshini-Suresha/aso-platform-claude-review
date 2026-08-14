from backend.datasets.huesken import HueskenDataset
from backend.features.extractor import FeatureExtractor


def test_feature_extractor():
    dataset = HueskenDataset("OligoFormer/data/Hu.csv")

    sample = dataset[0]

    print("Sample:", sample)

    features = FeatureExtractor.extract(sample)

    print("Extracted features:", features)

    print(f"AU content: {FeatureExtractor.au_content(sample['mrna_sequence'])}")
    print(f"GC ratio: {FeatureExtractor.gc_ratio(sample['mrna_sequence'])}")
    print(f"Has poly-U: {FeatureExtractor.has_poly_u(sample['mrna_sequence'])}")
    print(f"Has poly-G: {FeatureExtractor.has_poly_g(sample['mrna_sequence'])}")

    assert "gc_content" in features
    assert "length" in features
    assert "au_content" in features
    assert "gc_ratio" in features
    assert "has_poly_u" in features
    assert "has_poly_g" in features
    assert "mfe" in features
    assert "ensemble_energy" in features
    assert "centroid_distance" in features

    print("All tests passed!")


if __name__ == "__main__":
    test_feature_extractor()
