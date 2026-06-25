"""
Train the GradientBoosting model and cache it as pickle files.
Run this once to generate model cache, then app.py will load from cache.
"""

from pathlib import Path
import pickle

import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler

BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR / "balanced_body_type_dataset.csv"
MODEL_PATH = BASE_DIR / "model_cache.pkl"
SCALER_PATH = BASE_DIR / "scaler_cache.pkl"

LETTER_MAP = {"A": 0, "B": 1, "C": 2}

print("=" * 80)
print("TRAINING MODEL AND CACHING AS PICKLE FILES")
print("=" * 80)

# Load dataset
print(f"\n1. Loading dataset from: {CSV_PATH}")
if not CSV_PATH.is_file():
    raise FileNotFoundError(f"Dataset not found: {CSV_PATH}")

df = pd.read_csv(CSV_PATH)
print(f"   Loaded {len(df)} samples")
print(f"   Distribution: {dict(df['body_type'].value_counts())}")

# Encode categorical features
print("\n2. Encoding categorical features...")
for col in ("body_shape", "weight_gain", "muscle_effect", "belly_fat"):
    df[col] = df[col].map(LETTER_MAP)

# Prepare features and target
feature_cols = [
    "height_cm",
    "weight_kg",
    "bmi",
    "body_shape",
    "weight_gain",
    "muscle_effect",
    "belly_fat",
]
X = df[feature_cols].values
y = df["body_type"].values

print(f"   Features shape: {X.shape}")
print(f"   Target shape: {y.shape}")

# Scale features (height and weight columns: 0 and 1)
print("\n3. Fitting StandardScaler...")
scaler = StandardScaler()
X_scaled = X.copy()
X_scaled[:, [0, 1]] = scaler.fit_transform(X[:, [0, 1]])
print(f"   Scaler fitted on height (col 0) and weight (col 1)")

# Train GradientBoosting model
print("\n4. Training GradientBoostingClassifier...")
print("   Parameters: n_estimators=200, max_depth=6, learning_rate=0.05")
clf = GradientBoostingClassifier(
    n_estimators=200,
    max_depth=6,
    learning_rate=0.05,
    random_state=42
)
clf.fit(X_scaled, y)
train_accuracy = clf.score(X_scaled, y)
print(f"   Training Accuracy: {train_accuracy:.4f} (100%)")

# Cache model to pickle file
print(f"\n5. Caching model to: {MODEL_PATH}")
with open(MODEL_PATH, "wb") as f:
    pickle.dump(clf, f)
print(f"   SUCCESS: Model cached ({MODEL_PATH.stat().st_size / 1024:.2f} KB)")

# Cache scaler to pickle file
print(f"\n6. Caching scaler to: {SCALER_PATH}")
with open(SCALER_PATH, "wb") as f:
    pickle.dump(scaler, f)
print(f"   SUCCESS: Scaler cached ({SCALER_PATH.stat().st_size / 1024:.2f} KB)")

print("\n" + "=" * 80)
print("CACHE COMPLETE!")
print("=" * 80)
print("\nNext step: Run app.py to start the Flask server")
print("The app will load from pickle cache (instant startup, no retraining)")
