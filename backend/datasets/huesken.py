import pandas as pd
from pathlib import Path
from backend.features.extractor import FeatureExtractor


class HueskenDataset:
    def __init__(self, csv_path):
        self.csv_path = Path(csv_path)
        self.df = pd.read_csv(self.csv_path)

    @staticmethod
    def normalize_sequence(seq: str) -> str:
        """Convert DNA to RNA and normalize formatting."""
        return (
            seq.upper()
            .replace("T", "U")
            .replace(" ", "")
            .strip()
        )

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        row = self.df.iloc[idx]

        sample = {
            "aso_sequence": self.normalize_sequence(row["siRNA"]),
            "mrna_sequence": self.normalize_sequence(row["mRNA"]),
            "efficacy": float(row["label"]),
            "binary_label": int(row["y"]),
        }

        sample["features"] = FeatureExtractor.extract(sample)

        return sample
