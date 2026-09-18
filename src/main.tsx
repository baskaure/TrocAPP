import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NoticeProvider } from './components/ui/Toast';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Élément racine introuvable');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <NoticeProvider>
        <App />
      </NoticeProvider>
    </ErrorBoundary>
  </StrictMode>
);
