import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QualificationApp } from './qualification/qualification-app.js'
import './qualification/qualification.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QualificationApp />
  </StrictMode>
)
