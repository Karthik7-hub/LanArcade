import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Global styles
const globalStyles = document.createElement('style');
globalStyles.textContent = `
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  
  html, body, #root {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body {
    background: #020617;
    color: #fff;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    overflow-x: hidden;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  input::placeholder {
    color: #475569;
  }

  input:focus {
    border-color: #6366f1 !important;
  }

  button {
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  
  button:active {
    transform: scale(0.97);
  }

  button:hover {
    filter: brightness(1.1);
  }

  /* Scrollbar styling */
  ::-webkit-scrollbar {
    width: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: #334155;
    border-radius: 3px;
  }
`;
document.head.appendChild(globalStyles);

// Load Inter font
const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap';
fontLink.rel = 'stylesheet';
document.head.appendChild(fontLink);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
