import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

const echo = new Echo({
    broadcaster: 'pusher',
    key: import.meta.env.VITE_PUSHER_APP_KEY,
    cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
    forceTLS: true, // ✅ Required for production Pusher
    // ❌ REMOVE enabledTransports. Let Pusher negotiate the best connection.
    // ❌ REMOVE disableStats. Let Pusher help debug connection issues.
});

window.Echo = echo;

export default echo;