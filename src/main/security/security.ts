import { session, type WebContents } from 'electron'

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'sha256-ffmgGkdAXpuqosBM/KVNKWsjChLaUz+GlRqYTej6VXo='",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'"
].join('; ')

export function configureSecurity(): void {
  session.defaultSession.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false)
  )
  session.defaultSession.setPermissionCheckHandler(() => false)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [contentSecurityPolicy]
      }
    })
  })
}

export function hardenWebContents(contents: WebContents): void {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  contents.on('will-navigate', (event) => event.preventDefault())
}
