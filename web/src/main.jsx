import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter'; // bundled, works offline
import './styles.css';
import App from './App.jsx';

// Chrome and Edge offer installing the page as an app; keep the offer so Settings can show an Install button.
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.installPrompt = e; window.dispatchEvent(new Event('installable')); });
window.addEventListener('appinstalled', () => { window.installPrompt = null; window.dispatchEvent(new Event('installable')); });

createRoot(document.getElementById('root')).render(<App />);

// Installable app: the service worker only shows a "WealthFlow isn't running" page when the server is off. Not in
// development, where Vite serves the page and a worker would get in the way of live reloading.
if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
