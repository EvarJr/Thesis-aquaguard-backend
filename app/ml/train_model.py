import os
import pandas as pd
import numpy as np
import joblib
import json
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from datetime import datetime
import sys
import time
import traceback

# ============================
# CONFIGURATION
# ============================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, "storage", "app", "ml_models")
DATA_PATH = os.path.join(MODEL_DIR, "pipeline_sensor_data.csv")

PROGRESS_PATH = os.path.join(MODEL_DIR, "train_progress.json")
RESULT_PATH = os.path.join(MODEL_DIR, "train_result.json")

os.makedirs(MODEL_DIR, exist_ok=True)

MODEL_DET_PATH = os.path.join(MODEL_DIR, "rf_leak_detect.joblib")
MODEL_LOC_PATH = os.path.join(MODEL_DIR, "rf_leak_locate.joblib")
FEATURES_PATH = os.path.join(MODEL_DIR, "feature_cols.joblib")

# ============================
# HELPER FUNCTIONS
# ============================
def write_json(path, data):
    """Safely write a JSON file."""
    try:
        with open(path, "w") as f:
            json.dump(data, f, indent=4)
    except Exception as e:
        print(f"⚠️ Failed to write {path}: {e}")

def update_progress(progress, status="training", message=""):
    """Write training progress for Laravel to read."""
    progress_data = {
        "progress": progress,
        "status": status,
        "message": message,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    write_json(PROGRESS_PATH, progress_data)

def complete_training(result):
    """Save final training result."""
    write_json(RESULT_PATH, result)
    update_progress(100, "completed", "Training finished successfully")

def fail_training(error_message):
    """Handle and log training failure."""
    update_progress(0, "failed", error_message)
    print(json.dumps({"status": "error", "message": error_message}))
    sys.exit(1)

# ============================
# TRAINING PIPELINE
# ============================
try:
    update_progress(0, "training", "Checking dataset...")

    # --- Dataset check ---
    if not os.path.exists(DATA_PATH):
        fail_training(f"Dataset not found at {DATA_PATH}")

    df = pd.read_csv(DATA_PATH)
    features = [
        "f_main", "f_1", "f_2", "f_3",
        "p_main", "p_dma1", "p_dma2", "p_dma3",
        "pump_on", "comp_on", "s1", "s2", "s3"
    ]
    required_cols = features + ["leak_detected", "leak_location"]
    missing_cols = [c for c in required_cols if c not in df.columns]

    if missing_cols:
        fail_training(f"Dataset missing columns: {missing_cols}")

    update_progress(10, "training", "Dataset validated successfully.")

    # --- Split data ---
    update_progress(20, "training", "Splitting data into training and test sets...")
    X = df[features]
    y_detect = df["leak_detected"]
    y_loc = df["leak_location"]

    X_train, X_test, y_train_d, y_test_d = train_test_split(X, y_detect, test_size=0.2, random_state=42)
    X_train_l, X_test_l, y_train_l, y_test_l = train_test_split(X, y_loc, test_size=0.2, random_state=42)

    # --- Initialize models ---
    update_progress(30, "training", "Initializing models...")
    clf_det = RandomForestClassifier(n_estimators=150, random_state=42)
    clf_loc = RandomForestClassifier(n_estimators=150, random_state=42)

    # --- Train detection model ---
    update_progress(50, "training", "Training detection model (leak detection)...")
    clf_det.fit(X_train, y_train_d)
    time.sleep(2)  # simulate computation

    # --- Train location model ---
    update_progress(75, "training", "Training location model (leak location)...")
    clf_loc.fit(X_train_l, y_train_l)
    time.sleep(2)  # simulate computation

    # --- Evaluate models ---
    update_progress(90, "training", "Evaluating models...")
    pred_det = clf_det.predict(X_test)
    pred_loc = clf_loc.predict(X_test_l)

    acc_det = round(accuracy_score(y_test_d, pred_det) * 100, 2)
    acc_loc = round(accuracy_score(y_test_l, pred_loc) * 100, 2)

    # --- Save models ---
    joblib.dump(clf_det, MODEL_DET_PATH)
    joblib.dump(clf_loc, MODEL_LOC_PATH)
    joblib.dump(features, FEATURES_PATH)

    # --- Save final results ---
    result = {
        "status": "success",
        "trainedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "accuracy_detection": acc_det,
        "accuracy_location": acc_loc,
        "data_used": len(df),
        "features": features
    }
    complete_training(result)

    print(json.dumps(result))  # Optional: only final output

except Exception as e:
    error_msg = f"Training failed: {e}"
    traceback.print_exc()
    fail_training(error_msg)
