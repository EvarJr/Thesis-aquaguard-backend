import os
import pandas as pd
import numpy as np
import json
import joblib
import random
import sys
import traceback
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

# ====================================================
# 🔧 CONFIGURATION
# ====================================================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STORAGE_DIR = os.path.join(BASE_DIR, "storage", "app", "ml_models")

# File Paths
HISTORICAL_PATH = os.path.join(STORAGE_DIR, "historical_sensor_data.csv")
SIMULATOR_PATH = os.path.join(STORAGE_DIR, "pipeline_sensor_data.csv")
# ✅ NEW FILE: Human Feedback Data
VALIDATED_PATH = os.path.join(STORAGE_DIR, "validated_alerts.csv")

PROGRESS_PATH = os.path.join(STORAGE_DIR, "train_progress.json")
RESULT_PATH = os.path.join(STORAGE_DIR, "train_result.json")

# Output Model Paths
MODEL_DET_PATH = os.path.join(STORAGE_DIR, "rf_leak_detect_ga.joblib")
MODEL_LOC_PATH = os.path.join(STORAGE_DIR, "rf_leak_locate_ga.joblib")
FEATURES_PATH = os.path.join(STORAGE_DIR, "feature_cols.joblib")

os.makedirs(STORAGE_DIR, exist_ok=True)

# ====================================================
# 🛠 HELPER FUNCTIONS
# ====================================================
def update_progress(progress, message):
    """Write progress to JSON for Laravel to read."""
    with open(PROGRESS_PATH, "w") as f:
        json.dump({"progress": progress, "status": "training", "message": message}, f)

def fail_training(message):
    print(json.dumps({"status": "error", "message": message}))
    update_progress(0, f"Error: {message}")
    sys.exit(1)

# ====================================================
# 🚀 MAIN PROCESS
# ====================================================
try:
    update_progress(5, "Loading datasets...")

    data_frames = []

    # 1. Load Historical Data
    if os.path.exists(HISTORICAL_PATH):
        try:
            df = pd.read_csv(HISTORICAL_PATH)
            if not df.empty: data_frames.append(df)
        except: pass

    # 2. Load Simulator Data
    if os.path.exists(SIMULATOR_PATH):
        try:
            df = pd.read_csv(SIMULATOR_PATH)
            if not df.empty: data_frames.append(df)
        except: pass

    # 3. ✅ Load Validated Alerts (High Priority)
    if os.path.exists(VALIDATED_PATH):
        try:
            df = pd.read_csv(VALIDATED_PATH)
            if not df.empty:
                print(f"   - Loaded {len(df)} rows from Human Validation.")
                data_frames.append(df)
        except: pass

    if not data_frames:
        fail_training("No valid data found in any CSV files.")

    # 4. MERGE DATASETS
    update_progress(10, "Merging and cleaning data...")
    
    df_combined = pd.concat(data_frames, ignore_index=True)

    # ---------------------------------------------------------
    # ✅ AGGRESSIVE TYPE FIX: Force Targets to be Integers
    # ---------------------------------------------------------
    if 'leak_detected' in df_combined.columns:
        df_combined['leak_detected'] = pd.to_numeric(df_combined['leak_detected'], errors='coerce')
    else:
        df_combined['leak_detected'] = 0

    if 'leak_location' in df_combined.columns:
        df_combined['leak_location'] = pd.to_numeric(df_combined['leak_location'], errors='coerce')
    else:
        df_combined['leak_location'] = 0

    df_combined = df_combined.fillna(0)
    df_combined['leak_detected'] = df_combined['leak_detected'].astype(int)
    df_combined['leak_location'] = df_combined['leak_location'].astype(int)
    # ---------------------------------------------------------

    # Remove duplicates
    df_combined.drop_duplicates(inplace=True)

    # 5. Validate Columns
    features = [
        "f_main", "f_1", "f_2", "f_3",
        "p_main", "p_dma1", "p_dma2", "p_dma3",
        "pump_on", "comp_on", 
        "s1", "s2", "s3",
        "solenoid_active"
    ]
    
    for col in features:
        if col not in df_combined.columns:
            df_combined[col] = 0

    # 6. GENETIC ALGORITHM
    update_progress(20, "Running Genetic Algorithm for data optimization...")

    def fitness(fraction):
        try:
            if fraction <= 0.1: return 0
            sample = df_combined.sample(frac=fraction, random_state=42)
            X = sample[features]
            y = sample["leak_detected"]
            
            if len(y.unique()) < 2: return 0
            
            X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.25, random_state=42)
            clf = RandomForestClassifier(n_estimators=50, max_depth=5, random_state=42)
            clf.fit(X_tr, y_tr)
            return accuracy_score(y_te, clf.predict(X_te))
        except Exception:
            return 0

    population = [random.uniform(0.4, 0.9) for _ in range(6)] 
    generations = 5 

    for gen in range(generations):
        update_progress(20 + (gen * 5), f"GA Generation {gen+1}/{generations}...")
        population.sort(key=fitness, reverse=True)
        parents = population[:2]
        children = [
            (parents[0] + parents[1]) / 2 + random.uniform(-0.05, 0.05),
            (parents[0] + parents[1]) / 2 - random.uniform(-0.05, 0.05)
        ]
        population = parents + children
        population = [max(0.2, min(1.0, p)) for p in population]

    best_fraction = population[0]
    update_progress(50, f"GA Selected optimal data fraction: {best_fraction:.2f}")

    # 7. Select Final Training Data
    final_df = df_combined.sample(frac=best_fraction, random_state=42)

    # 8. TRAIN FINAL MODELS
    update_progress(60, "Training and validating final models...")
    
    X = final_df[features]
    y_det = final_df["leak_detected"].astype(int)
    y_loc = final_df["leak_location"].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(X, y_det, test_size=0.2, random_state=42)

    # A. Train Detection Model
    clf_det = RandomForestClassifier(n_estimators=150, random_state=42)
    clf_det.fit(X_train, y_train)
    
    y_pred = clf_det.predict(X_test)
    final_accuracy = accuracy_score(y_test, y_pred) * 100 

    clf_det.fit(X, y_det) 

    # B. Train Location Model
    clf_loc = RandomForestClassifier(n_estimators=150, random_state=42)
    clf_loc.fit(X, y_loc)

    # 9. SAVE ARTIFACTS
    update_progress(80, "Saving models and updating history...")

    joblib.dump(clf_det, MODEL_DET_PATH)
    joblib.dump(clf_loc, MODEL_LOC_PATH)
    joblib.dump(features, FEATURES_PATH)

    # Save combined history (so we don't lose the validated data)
    df_combined.to_csv(HISTORICAL_PATH, index=False)
    
    # Clear temporary files (Simulator only)
    # ⚠️ NOTE: We do NOT clear validated_alerts.csv so it persists forever
    if os.path.exists(SIMULATOR_PATH):
        open(SIMULATOR_PATH, 'w').close() 

    result = {
        "status": "success",
        "accuracy": round(final_accuracy, 2), 
        "trainedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "data_points_total": len(df_combined),
        "data_points_used": len(final_df),
        "ga_fraction": round(best_fraction, 2)
    }

    with open(RESULT_PATH, "w") as f:
        json.dump(result, f)

    update_progress(100, "GA Training Complete!")
    print(json.dumps(result))

except Exception as e:
    traceback.print_exc()
    fail_training(str(e))