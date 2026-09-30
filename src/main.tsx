import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// Self-hosted fonts (CSP allows only 'self'); latin subset keeps the bundle small.
import '@fontsource/roboto/latin-400.css'
import '@fontsource/roboto/latin-500.css'
import '@fontsource/roboto-mono/latin-500.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
