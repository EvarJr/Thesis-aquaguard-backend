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
        
        # 4. Prepare Raw Features
        # Extract variables first to make math easier
        f_main = float(data.get('f_main', 0))
        f_1 = float(data.get('f_1', 0))
        f_2 = float(data.get('f_2', 0))
        f_3 = float(data.get('f_3', 0))
        
        p_main = float(data.get('p_main', 0))
        p_dma1 = float(data.get('p_dma1', 0))
        p_dma2 = float(data.get('p_dma2', 0))
        p_dma3 = float(data.get('p_dma3', 0))
        
        pump_on = float(data.get('pump_on', 0))
        comp_on = float(data.get('comp_on', 0))
        s1 = float(data.get('s1', 0))
        s2 = float(data.get('s2', 0))
        s3 = float(data.get('s3', 0))
        solenoid_active = float(data.get('solenoid_active', 0))

        # ✅ NEW: Calculate Pressure Gradients (MUST match training logic)
        grad_main_dma1 = p_main - p_dma1
        grad_dma1_dma2 = p_dma1 - p_dma2
        grad_dma2_dma3 = p_dma2 - p_dma3

        # Construct Final Feature Vector (17 Features)
        features = [
            f_main, f_1, f_2, f_3,
            p_main, p_dma1, p_dma2, p_dma3,
            pump_on, comp_on, 
            s1, s2, s3, 
            solenoid_active,
            grad_main_dma1, # 15: Pressure drop Main -> 1
            grad_dma1_dma2, # 16: Pressure drop 1 -> 2
            grad_dma2_dma3  # 17: Pressure drop 2 -> 3
        ]

        X = np.array([features])

        # 5. Predict Leak & Calculate Confidence
        prediction = clf_detect.predict(X)[0]
        
        confidence = 0.0
        if hasattr(clf_detect, "predict_proba"):
            # Returns [[prob_safe, prob_leak]]
            probabilities = clf_detect.predict_proba(X)
            # Get the probability of the predicted class (0 or 1)
            confidence = probabilities[0][int(prediction)]
        else:
            confidence = 1.0 # Fallback

        result = {
            "leak_detected": int(prediction),
            "leak_location": 0,
            "sensor_id": "S001", 
            "pipeline_id": None, 
            "confidence": round(confidence * 100, 2) 
        }

        # 6. Predict Location (If Leak)
        if prediction == 1:
            location_num = int(clf_locate.predict(X)[0])
            result["leak_location"] = location_num
            
            # Simple Sensor mapping for reference 
            # (Laravel PipelineMapper handles the real logic now)
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