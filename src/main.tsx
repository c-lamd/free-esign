// Must be the first import: sets GlobalWorkerOptions.workerSrc before any react-pdf usage (WR-02).
// Anchoring this in main.tsx ensures the side-effect runs at app initialisation regardless
// of which component renders first, satisfying PRV-02 (self-hosted worker, no CDN fallback).
import './lib/pdfWorker'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
