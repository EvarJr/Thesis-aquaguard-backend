import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // ✅ correct
import '@/i18n'; // optional
import '../css/app.css'; // optional

const rootElement = document.getElementById('app');
if (!rootElement) {
  throw new Error('Root element #app not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
