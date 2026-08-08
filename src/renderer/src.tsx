import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './shell/app.js'
import './shell/app.css'
import { CapabilityProvider } from './capabilities/capability-provider.js'
import { ModalLayerProvider } from './shell/modal-layer.js'

document.documentElement.dataset['theme'] = 'light'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CapabilityProvider api={window.saltMarcher}>
      <ModalLayerProvider>
        <App />
      </ModalLayerProvider>
    </CapabilityProvider>
  </StrictMode>
)
