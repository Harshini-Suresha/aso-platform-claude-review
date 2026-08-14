from backend.datasets.huesken import HueskenDataset
from backend.features.extractor import FeatureExtractor

dataset = HueskenDataset("OligoFormer/data/Hu.csv")

sample = dataset[0]

print(sample)

features = FeatureExtractor.extract(sample)

print(features)
print(f"AU content: {FeatureExtractor.au_content(sample['mrna_sequence'])}")
print(f"GC ratio: {FeatureExtractor.gc_ratio(sample['mrna_sequence'])}")
print(f"Has poly-U: {FeatureExtractor.has_poly_u(sample['mrna_sequence'])}")
print(f"Has poly-G: {FeatureExtractor.has_poly_g(sample['mrna_sequence'])}")