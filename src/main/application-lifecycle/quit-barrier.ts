interface QuitHost {
  on(
    event: 'before-quit',
    listener: (event: { preventDefault(): void }) => void
  ): unknown
  quit(): void
}

export function registerQuitBarrier(
  host: QuitHost,
  stop: () => Promise<void>,
  failed: (error: unknown) => void
): void {
  let confirmed = false
  let stopping = false
  host.on('before-quit', (event) => {
    if (confirmed) return
    event.preventDefault()
    if (stopping) return
    stopping = true
    void stop().then(
      () => {
        confirmed = true
        host.quit()
      },
      (error) => {
        stopping = false
        failed(error)
      }
    )
  })
}
