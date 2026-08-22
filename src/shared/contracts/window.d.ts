export {}

declare global {
  interface Window {
    saltMarcherBridge: import('./ipc-result.js').CapabilityBridge
    /** Renderer-realm logical adapter; the preload exposes only saltMarcherBridge. */
    saltMarcher: import('./capability-api.js').SaltMarcherApi
  }
}
