
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const start = () => {
  const container = document.getElementById('root');
  if (!container) return;

  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (err) {
    console.error("Mount error:", err);
  }
};

if (document.readyState === 'complete') {
  start();
} else {
  window.addEventListener('load', start);
}
