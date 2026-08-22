import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './shell/app.js'
import './shell/app.css'
import { CapabilityProvider } from './capabilities/capability-provider.js'
import { ModalLayerProvider } from './shell/modal-layer.js'
import { capabilityApi } from './capabilities/capability-api.js'

document.documentElement.dataset['theme'] = 'light'
const api = capabilityApi()
window.saltMarcher = api

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CapabilityProvider api={api}>
      <ModalLayerProvider>
        <App />
      </ModalLayerProvider>
    </CapabilityProvider>
  </StrictMode>
)
