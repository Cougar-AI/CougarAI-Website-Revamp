import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {Analytics} from '@vercel/analytics/react'
import { SpeedInsights } from "@vercel/speed-insights/react"

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <SpeedInsights/>
        <Analytics/>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
