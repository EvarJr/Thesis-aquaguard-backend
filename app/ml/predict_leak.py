import sys
import json
import joblib
import numpy as np
import argparse
import os
import warnings

# Suppress warnings to keep JSON output clean
warnings.filterwarnings("ignore")

def main():
    try:
        # 1. Parse Arguments
        parser = argparse.ArgumentParser()
        parser.add_argument("--detect", required=True)
        parser.add_argument("--locate", required=True)
        parser.add_argument("--features", required=True)
        parser.add_argument("--input", required=True)
        args = parser.parse_args()

        # 2. Load Input Data
        data = json.loads(args.input)
        
        # 3. Load Models
        base_path = os.getcwd()
        def fix_path(p):
            if os.path.isabs(p): return p
            return os.path.join(base_path, p)

        clf_detect = joblib.load(fix_path(args.detect))
        clf_locate = joblib.load(fix_path(args.locate))
        
        # 4. Prepare Features (Ensure 'solenoid_active' is last)
        features = [
            float(data.get('f_main', 0)),
            float(data.get('f_1', 0)),
            float(data.get('f_2', 0)),
            float(data.get('f_3', 0)),
            float(data.get('p_main', 0)),
            float(data.get('p_dma1', 0)),
            float(data.get('p_dma2', 0)),
            float(data.get('p_dma3', 0)),
            float(data.get('pump_on', 0)),
            float(data.get('comp_on', 0)),
            float(data.get('s1', 0)),
            float(data.get('s2', 0)),
            float(data.get('s3', 0)),
            float(data.get('solenoid_active', 0)) 
        ]

        X = np.array([features])

        # 5. Predict Leak & Calculate Confidence
        prediction = clf_detect.predict(X)[0]
        
        # ✅ NEW: Calculate Confidence (Accuracy of this specific prediction)
        confidence = 0.0
        if hasattr(clf_detect, "predict_proba"):
            # Returns [[prob_safe, prob_leak]]
            probabilities = clf_detect.predict_proba(X)
            # Get the probability of the predicted class (0 or 1)
            confidence = probabilities[0][int(prediction)]
        else:
            confidence = 1.0 # Fallback if model doesn't support probabilities

        result = {
            "leak_detected": int(prediction),
            "leak_location": 0,
            "sensor_id": "S001", # Default
            "pipeline_id": None, # Handled by Laravel now
            "confidence": round(confidence * 100, 2) # ✅ Send as Percentage (e.g., 95.50)
        }

        # 6. Map Location Number to Specific ID (if Leak)
        if prediction == 1:
            location_num = int(clf_locate.predict(X)[0])
            result["leak_location"] = location_num
            
            # Map Internal Location ID to Sensor ID
            # Laravel uses this Sensor ID to find the real Pipeline ID
            if location_num == 1:
                result["sensor_id"] = "S001"
            elif location_num == 2:
                result["sensor_id"] = "S002"
            elif location_num == 3:
                result["sensor_id"] = "S003"
            else:
                result["sensor_id"] = "Unknown"

        print(json.dumps(result))

    except Exception as e:
        # Fallback error JSON
        print(json.dumps({
            "error": str(e), 
            "leak_detected": 0, 
            "sensor_id": "ERROR",
            "confidence": 0
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()