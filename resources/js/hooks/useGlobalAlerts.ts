import { useEffect } from 'react';

const useGlobalAlerts = () => {
  useEffect(() => {
    // Ensure Echo is ready
    if (!window.Echo) return;

    console.log("🛡️ Global Alert System: ON");

    // Listen to the 'alerts' channel
    const channel = window.Echo.channel('alerts');

    channel.listen('LeakDetected', (event: any) => {
      console.warn("🚨 GLOBAL ALERT RECEIVED:", event);

      // 1. Trigger Browser Notification (OS Level)
      if (Notification.permission === "granted") {
        new Notification("🚨 LEAK DETECTED!", {
          body: `Critical anomaly detected at Sensor ${event.alert.sensorId}. Immediate action required.`,
          requireInteraction: true // Keeps notification on screen until clicked
        });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission();
      }

      // 2. Trigger a Sound (Optional but effective)
      // const audio = new Audio('/alert_sound.mp3');
      // audio.play().catch(e => console.log(e));

      // 3. Standard Alert (Fallback)
      alert(`🚨 CRITICAL ALERT: Leak Detected at ${event.alert.sensorId}!`);
    });

    return () => {
      // Optional: We usually keep this channel open, but for cleanup:
      // window.Echo.leave('alerts');
    };
  }, []);
};

export default useGlobalAlerts;