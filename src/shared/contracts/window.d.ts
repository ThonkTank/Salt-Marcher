export {}

declare global {
  interface Window {
    saltMarcher: import('./capability-api.js').SaltMarcherApi
  }
}
