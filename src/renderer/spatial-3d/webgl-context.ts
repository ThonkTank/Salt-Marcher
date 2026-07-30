export interface LoseContextExtension {
  loseContext(): void
  restoreContext(): void
}

/** Exercises the browser's real WebGL loss/restoration path when available. */
export function exerciseWebglContextLoss(canvas: HTMLCanvasElement): boolean {
  const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
  const extension = context?.getExtension(
    'WEBGL_lose_context'
  ) as LoseContextExtension | null
  if (extension === null || extension === undefined) return false
  extension.loseContext()
  globalThis.setTimeout(() => extension.restoreContext(), 250)
  return true
}
