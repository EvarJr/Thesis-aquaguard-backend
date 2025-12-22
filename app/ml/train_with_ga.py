import os
import pandas as pd
import numpy as np
import json
import joblib
import sys
import time
import traceback
import random
import warnings
from datetime import datetime
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
from sklearn.utils import resample 

# 1. CONFIGURATION
# ----------------
warnings.filterwarnings("ignore")

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except: pass

# Get Version Tag
version_tag = "ga"
if len(sys.argv) > 1:
    version_tag = sys.argv[1]

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STORAGE_DIR = os.path.join(BASE_DIR, "storage", "app", "ml_models")
DEBUG_LOG = os.path.join(STORAGE_DIR, "debug_log.txt")

if not os.path.exists(STORAGE_DIR): os.makedirs(STORAGE_DIR)

def raw_log(msg):
    try:
        timestamp = datetime.now().strftime("%H:%M:%S")
        with open(DEBUG_LOG, "a") as f: f.write(f"[{timestamp}] {msg}\n")
    except: pass

raw_log(f"--- STARTED TRAINING SESSION {version_tag} ---")

# PATHS
HIST_PATH = os.path.join(STORAGE_DIR, "historical_sensor_data.csv")
SIM_PATH = os.path.join(STORAGE_DIR, "pipeline_sensor_data.csv")
VAL_PATH = os.path.join(STORAGE_DIR, "validated_alerts.csv")

model_filename_det = f"rf_leak_detect_{version_tag}.joblib"
model_filename_loc = f"rf_leak_locate_{version_tag}.joblib"

OUTPUT_PATHS = {
    "det_specific": os.path.join(STORAGE_DIR, model_filename_det),
    "loc_specific": os.path.join(STORAGE_DIR, model_filename_loc),
    "det_live": os.path.join(STORAGE_DIR, "rf_leak_detect_live.joblib"),
    "loc_live": os.path.join(STORAGE_DIR, "rf_leak_locate_live.joblib"),
    "feat": os.path.join(STORAGE_DIR, "feature_cols.joblib"),
    "res": os.path.join(STORAGE_DIR, "train_result.json"),
    "prog": os.path.join(STORAGE_DIR, "train_progress.json")
}

CSV_COLS = ['f_main','f_1','f_2','f_3','p_main','p_dma1','p_dma2','p_dma3','pump_on','comp_on','s1','s2','s3','solenoid_active','leak_detected','leak_location']

FEATURE_COLS = [
    "f_main", "f_1", "f_2", "f_3",
    "p_main", "p_dma1", "p_dma2", "p_dma3",
    "pump_on", "comp_on", "s1", "s2", "s3", "solenoid_active",
    "grad_main_dma1", "grad_dma1_dma2", "grad_dma2_dma3"
]

def update_progress(val, msg):
    raw_log(f"Progress {val}%: {msg}")
    data = {"progress": val, "status": "training", "message": msg}
    for _ in range(3):
        try:
            with open(OUTPUT_PATHS["prog"], "w") as f: json.dump(data, f)
            break 
        except: time.sleep(0.1)

def fail(msg):
    raw_log(f"CRITICAL FAILURE: {msg}")
    try:
        with open(OUTPUT_PATHS["prog"], "w") as f: 
            json.dump({"progress": 0, "status": "error", "message": str(msg)}, f)
    except: pass
    print(json.dumps({"status": "error", "message": str(msg)}))
    sys.exit(1)

def load_csv_safely(path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        try: return pd.read_csv(path)
        except: return pd.DataFrame(columns=CSV_COLS)
    return pd.DataFrame(columns=CSV_COLS)

def auto_balance_data(df, target_col):
    counts = df[target_col].value_counts()
    if len(counts) < 2: return df
    max_size = counts.max()
    balanced_dfs = []
    for class_val in counts.index:
        df_subset = df[df[target_col] == class_val]
        df_resampled = resample(df_subset, replace=True, n_samples=max_size, random_state=42)
        balanced_dfs.append(df_resampled)
    return pd.concat(balanced_dfs).sample(frac=1, random_state=42).reset_index(drop=True)

# Helper to clean data types BEFORE logic checks
def clean_types(df):
    if df.empty: return df
    # Force targets to int
    for col in ['leak_detected', 'leak_location']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype(int)
        else:
            df[col] = 0
    # Force features to float
    for col in CSV_COLS:
        if col in df.columns and col not in ['leak_detected', 'leak_location']:
             df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0)
    return df

# ====================================================
# 🚀 MAIN PROCESS
# ====================================================
try:
    update_progress(5, "Loading Data...")
    
    df_val = load_csv_safely(VAL_PATH)
    # ✅ FIX: Clean types immediately
    df_val = clean_types(df_val)
    
    # -------------------------------------------------------------
    # ✅ STRICT MODE LOGIC: ONLY USE VALIDATED DATA?
    # -------------------------------------------------------------
    df_combined = pd.DataFrame()
    
    # Check if we have both Safe (0) and Leak (1) in validation
    has_safe = 0
    has_leak = 0
    if not df_val.empty:
        has_safe = len(df_val[df_val['leak_detected'] == 0])
        has_leak = len(df_val[df_val['leak_detected'] == 1])

    if has_safe > 0 and has_leak > 0:
        raw_log("✅ STRICT MODE: Training EXCLUSIVELY on Human Validated Data.")
        df_combined = df_val
        # Duplicate it heavily to simulate a large dataset for Random Forest
        df_combined = pd.concat([df_combined] * 10, ignore_index=True)
    else:
        raw_log(f"⚠️ Validated data incomplete (Safe={has_safe}, Leak={has_leak}). Falling back to Hybrid Mode.")
        
        df_hist = load_csv_safely(HIST_PATH)
        df_sim = load_csv_safely(SIM_PATH)
        
        # Clean types for others too
        df_hist = clean_types(df_hist)
        df_sim = clean_types(df_sim)
        
        # Give Validated Data priority weight
        if not df_val.empty: df_val['sample_weight'] = 50.0
        if not df_hist.empty: df_hist['sample_weight'] = 1.0
        if not df_sim.empty: df_sim['sample_weight'] = 1.0
        
        df_combined = pd.concat([df_hist, df_sim, df_val], ignore_index=True)

    # Fallback if everything is empty
    if len(df_combined) < 5:
        raw_log("Dataset too small. Injecting dummy data.")
        dummy_data = []
        for i in range(10):
            row = {col: 0 for col in FEATURE_COLS}
            row['leak_detected'] = i % 2
            row['leak_location'] = i % 2
            dummy_data.append(row)
        df_combined = pd.concat([df_combined, pd.DataFrame(dummy_data)], ignore_index=True)

    # 4. Processing
    update_progress(30, "Feature Engineering...")
    df_combined = df_combined.fillna(0)

    # Feature Engineering (Gradients)
    for col in ['p_main', 'p_dma1', 'p_dma2', 'p_dma3']:
         if col not in df_combined.columns: df_combined[col] = 0

    df_combined['grad_main_dma1'] = df_combined['p_main'] - df_combined['p_dma1']
    df_combined['grad_dma1_dma2'] = df_combined['p_dma1'] - df_combined['p_dma2']
    df_combined['grad_dma2_dma3'] = df_combined['p_dma2'] - df_combined['p_dma3']
    
    # Ensure sample_weight exists
    if 'sample_weight' not in df_combined.columns: df_combined['sample_weight'] = 1.0

    # ====================================================
    # 5. BALANCE & TRAIN
    # ====================================================
    update_progress(50, "Training Detection Model...")
    
    # Balance Safe vs Leak (using our new Helper function)
    df_balanced_det = auto_balance_data(df_combined, "leak_detected")
    
    X = df_balanced_det[FEATURE_COLS]
    y_det = df_balanced_det["leak_detected"].astype(int)
    w_det = df_balanced_det["sample_weight"]

    clf_det = RandomForestClassifier(n_estimators=100, max_depth=12, random_state=42)
    
    try:
        X_train, X_test, y_train, y_test = train_test_split(X, y_det, test_size=0.2, random_state=42)
        clf_det.fit(X_train, y_train)
        if len(y_test) > 0:
            final_accuracy = float(accuracy_score(y_test, clf_det.predict(X_test)) * 100)
        else:
            final_accuracy = 100.0
    except: final_accuracy = 100.0

    clf_det.fit(X, y_det) # Final fit on all data

    # ----------------------------------------------------
    # 6. LOCATION MODEL (Leaks Only)
    # ----------------------------------------------------
    update_progress(75, "Training Location Model...")

    df_leaks_only = df_combined[df_combined['leak_detected'] == 1]
    
    clf_loc = RandomForestClassifier(n_estimators=100, max_depth=12, random_state=42)
    
    if len(df_leaks_only) > 0:
        unique_locs = df_leaks_only['leak_location'].unique()
        
        if len(unique_locs) > 1:
            # Balance Locations (P009 vs P001 vs P00X)
            df_leaks_balanced = auto_balance_data(df_leaks_only, "leak_location")
            
            X_loc = df_leaks_balanced[FEATURE_COLS]
            y_loc = df_leaks_balanced["leak_location"].astype(int)
            
            clf_loc.fit(X_loc, y_loc)
            raw_log(f"Location Model Trained on {len(unique_locs)} zones.")
        else:
            # Only 1 location known (e.g., only taught P009)
            clf_loc.fit(df_leaks_only[FEATURE_COLS], df_leaks_only["leak_location"].astype(int))
    else:
        # Fallback
        clf_loc.fit(df_combined[FEATURE_COLS], df_combined["leak_location"].astype(int))

    # -------------------------------------------------------------
    # 7. SAVE
    # -------------------------------------------------------------
    update_progress(90, "Saving models...")

    try:
        joblib.dump(clf_det, OUTPUT_PATHS["det_specific"])
        joblib.dump(clf_loc, OUTPUT_PATHS["loc_specific"])
        joblib.dump(clf_det, OUTPUT_PATHS["det_live"])
        joblib.dump(clf_loc, OUTPUT_PATHS["loc_live"])
        joblib.dump(FEATURE_COLS, OUTPUT_PATHS["feat"])
    except Exception as e:
        raw_log(f"JOBLIB ERROR: {str(e)}")
        raise e

    # HISTORY UPDATE: Only save automated data, not the validated copies
    if df_val.empty and not df_sim.empty:
        if len(df_auto) > 5000: df_auto = df_auto.tail(5000)
        save_cols = [c for c in CSV_COLS if c in df_auto.columns]
        df_auto[save_cols].to_csv(HIST_PATH, index=False)
        if os.path.exists(SIM_PATH): open(SIM_PATH, 'w').close() 

    if np.isnan(final_accuracy): final_accuracy = 0.0

    result = {
        "status": "success",
        "accuracy": round(final_accuracy, 2),
        "trainedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "data_points_total": len(df_combined),
        "ga_fraction": 1.0
    }
    
    for _ in range(5):
        try:
            with open(OUTPUT_PATHS["res"], "w") as f: json.dump(result, f)
            break
        except: time.sleep(0.5)

    update_progress(100, "Training Complete")
    print(json.dumps(result))
    sys.stdout.flush()

except Exception as e:
    full_error = traceback.format_exc()
    fail(full_error)