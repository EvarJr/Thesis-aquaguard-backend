import requests
import time
import random
import json
from datetime import datetime

# ==========================================
# ⚙️ CONFIGURATION
# ==========================================
API_URL = "http://217.216.32.69/api/sensor-data"
DELAY_SECONDS = 2  # Fast updates

def generate_system_state(sequence_id):
    # Base Data (Idle)
    data = {
        "sensorId": "MASTER_NODE",
        "pump_on": 1,
        "comp_on": 0,
        "f_main": random.uniform(0, 5), "p_main": random.uniform(50, 55), "s1": 0,
        "f_1": random.uniform(0, 5), "p_dma1": random.uniform(48, 52), "s2": 0,
        "f_2": random.uniform(0, 5), "p_dma2": random.uniform(46, 50), "s3": 0,
        "f_3": 0, "p_dma3": 0,
        "solenoid_active": 0,
        
        # 🎓 TRAINING FLAGS (Tells Laravel the truth)
        "simulated_leak": 0,
        "simulated_location": 0
    }

    # Generate Random Scenario
    # 0.0 - 0.40 : Normal Usage (40%)
    # 0.40 - 0.90 : LEAK (50% - VERY FREQUENT)
    # 0.90 - 1.00 : Idle (10%)
    chance = random.random()
    status_label = "💤 System Idle"

    # SCENARIO A: Normal Usage
    if chance < 0.40: 
        user = random.choice(['s1', 's2', 's3'])
        data[user] = 1 
        data['solenoid_active'] = 1
        status_label = f"✅ Usage at {user.upper()}"

        if user == 's1':
            data['f_main'] = random.uniform(90, 110)
            data['p_main'] = random.uniform(45, 48) # Slight drop
        elif user == 's2':
            data['f_main'] = random.uniform(90, 110)
            data['f_1'] = random.uniform(85, 105)
            data['p_dma1'] = random.uniform(42, 46)
        elif user == 's3':
            data['f_main'] = random.uniform(90, 110)
            data['f_1'] = random.uniform(85, 105)
            data['f_2'] = random.uniform(80, 100)
            data['p_dma2'] = random.uniform(40, 44)

    # SCENARIO B: MASSIVE LEAK
    elif chance < 0.90:
        leak_loc = random.choice(['S001', 'S002', 'S003'])
        status_label = f"🚨 LEAK AT {leak_loc}"
        
        # 🎓 FORCE TRUTH
        data['simulated_leak'] = 1
        data['solenoid_active'] = 0 # Leaks happen when valves are closed!

        if leak_loc == 'S001': # Main Pipe Leak
            data['simulated_location'] = 1
            data['f_main'] = random.uniform(140, 180) # HUGE FLOW
            data['p_main'] = random.uniform(15, 25)   # HUGE PRESSURE DROP
            data['s1'] = 0
            
        elif leak_loc == 'S002': # DMA 1 Leak
            data['simulated_location'] = 2
            data['f_main'] = random.uniform(140, 180)
            data['f_1'] = random.uniform(130, 160)
            data['p_dma1'] = random.uniform(10, 20)   # CRITICAL DROP
            data['s2'] = 0

        elif leak_loc == 'S003': # DMA 2 Leak
            data['simulated_location'] = 3
            data['f_main'] = random.uniform(140, 180)
            data['f_1'] = random.uniform(130, 160)
            data['f_2'] = random.uniform(120, 150)
            data['p_dma2'] = random.uniform(5, 15)    # EMPTY PIPE
            data['s3'] = 0

    return data, status_label

def run_simulation():
    print(f"🚀 Training Simulator Started (Aggressive Mode)")
    print(f"📡 Target: {API_URL}")
    print("---------------------------------------------------")

    counter = 0
    try:
        while True:
            counter += 1
            data, status_label = generate_system_state(counter)

            try:
                response = requests.post(API_URL, json=data)
                timestamp = datetime.now().strftime("%H:%M:%S")

                if response.status_code == 200:
                    res_json = response.json()
                    # We check what the ML thought vs what we Sent
                    ml_thought = "🚨 DETECTED" if res_json.get('ml_leak_detected') else "Safe"
                    truth = "🚨 LEAK" if data['simulated_leak'] == 1 else "Safe"
                    
                    print(f"[{timestamp}] {status_label:<20} | Truth: {truth:<7} | ML Says: {ml_thought}")
                else:
                    print(f"[{timestamp}] ❌ ERROR {response.status_code}")

            except Exception as e:
                print(f"❌ Connection Error: {str(e)}")

            time.sleep(DELAY_SECONDS)

    except KeyboardInterrupt:
        print("\n🛑 Stopped.")

if __name__ == "__main__":
    run_simulation()