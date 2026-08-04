import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './shell/app.js'
import './shell/app.css'
import { CapabilityProvider } from './capabilities/capability-provider.js'
import { installRendererCapabilityApi } from './capabilities/renderer-capability-api.js'

installRendererCapabilityApi(window.saltMarcher)

document.documentElement.dataset['theme'] = 'light'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CapabilityProvider api={window.saltMarcher}>
      <App />
    </CapabilityProvider>
  </StrictMode>
)
