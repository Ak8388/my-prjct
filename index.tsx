
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
  // Menggunakan createRoot secara langsung (named import)
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  console.error("Critical rendering error:", error);
  rootElement.innerHTML = `
    <div style="padding: 20px; font-family: monospace; color: #f87171; background: #1e293b; border-radius: 8px; margin: 20px;">
      <h3 style="margin-top:0">System Boot Error</h3>
      <p style="font-size: 12px;">${error instanceof Error ? error.message : 'Unknown error occurred during boot.'}</p>
      <button onclick="location.reload()" style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;">Retry System Boot</button>
    </div>
  `;
}
