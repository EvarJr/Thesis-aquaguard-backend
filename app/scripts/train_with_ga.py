# scripts/train_with_ga.py
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
import joblib, json, os, sys
from datetime import datetime
import pygad

# ==============================
# LOAD & PREPARE DATA
# ==============================
try:
    df = pd.read_csv("pipeline_sensor_data.csv")
except FileNotFoundError:
    print("❌ Dataset not found. Please ensure pipeline_sensor_data.csv exists.")
    sys.exit(1)

features = [
    "f_main", "f_1", "f_2", "f_3",
    "p_main", "p_dma1", "p_dma2", "p_dma3",
    "pump_on", "comp_on", "s1", "s2", "s3"
]

if not all(f in df.columns for f in features + ["leak_detected", "leak_location"]):
    print("❌ Missing required columns in dataset.")
    sys.exit(1)

X = df[features].values
y_det = df["leak_detected"].values
y_loc = df["leak_location"].values

X_train, X_val, y_train_det, y_val_det = train_test_split(X, y_det, test_size=0.2, random_state=42)
_, X_val_loc, _, y_val_loc = train_test_split(X, y_loc, test_size=0.2, random_state=42)

print(f"✅ Dataset loaded: {len(X)} samples, {len(features)} features")

# ==============================
# GENETIC ALGORITHM SETUP
# ==============================
def fitness_func(solution, solution_idx):
    indices = np.where(solution == 1)[0]
    if len(indices) < 100:
        return 0  # Skip too-small subsets
    X_sub, y_sub = X_train[indices], y_train_det[indices]
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_sub, y_sub)
    preds = model.predict(X_val)
    acc = accuracy_score(y_val_det, preds)
    diversity = np.std(X_sub.mean(axis=0))  # Diversity reward
    return acc * 0.9 + diversity * 0.1

ga_instance = pygad.GA(
    num_generations=10,
    num_parents_mating=6,
    fitness_func=fitness_func,
    sol_per_pop=12,
    num_genes=X_train.shape[0],
    gene_space=[0, 1],
    parent_selection_type="rank",
    keep_elitism=2,
    crossover_probability=0.8,
    mutation_percent_genes=5,
    mutation_type="random",
    stop_criteria=["reach_0.999"]
)

print("🚀 Starting Genetic Algorithm optimization...")
ga_instance.run()
print("✅ Genetic Algorithm completed.")

# ==============================
# USE BEST SUBSET FOR TRAINING
# ==============================
best_solution, best_fitness, _ = ga_instance.best_solution()
selected_indices = np.where(best_solution == 1)[0]
print(f"📊 Selected {len(selected_indices)} optimal samples for retraining.")

X_opt = X_train[selected_indices]
y_opt_det = y_train_det[selected_indices]
y_opt_loc = y_loc[selected_indices]

clf_det = RandomForestClassifier(n_estimators=150, random_state=42)
clf_det.fit(X_opt, y_opt_det)

clf_loc = RandomForestClassifier(n_estimators=150, random_state=42)
clf_loc.fit(X_opt, y_opt_loc)

pred_det = clf_det.predict(X_val)
pred_loc = clf_loc.predict(X_val_loc)

acc_det = accuracy_score(y_val_det, pred_det) * 100
acc_loc = accuracy_score(y_val_loc, pred_loc) * 100

# ==============================
# SAVE MODELS & METRICS
# ==============================
os.makedirs("models", exist_ok=True)
joblib.dump(clf_det, "models/rf_leak_detect.joblib")
joblib.dump(clf_loc, "models/rf_leak_locate.joblib")
joblib.dump(features, "models/feature_cols.joblib")

metrics = {
    "leak_detection_accuracy": round(acc_det, 2),
    "leak_location_accuracy": round(acc_loc, 2),
    "selected_samples": int(len(selected_indices)),
    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
}

print(json.dumps(metrics, indent=4))

# Save training summary
with open("models/training_summary.json", "w") as f:
    json.dump(metrics, f, indent=4)

print("✅ Models retrained and saved successfully.")
