// Browser polyfills for GitHub Pages & bundle compatibility
if (typeof window !== 'undefined') {
  (window as any).global = (window as any).global || window;
  (window as any).process = (window as any).process || { env: { NODE_ENV: 'production' } };
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);


