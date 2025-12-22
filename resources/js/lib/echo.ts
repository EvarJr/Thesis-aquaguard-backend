import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

// Setup window object
declare global {
    interface Window {
        Pusher: any;
        Echo: any;
    }
}

window.Pusher = Pusher;

const echo = new Echo({
    broadcaster: 'pusher',
    key: import.meta.env.VITE_PUSHER_APP_KEY,
    cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
    forceTLS: true, // ✅ IMPORTANT: Always true for cloud
});

export default echo;