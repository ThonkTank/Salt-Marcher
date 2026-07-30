export interface LoseContextExtension {
  loseContext(): void
  restoreContext(): void
}

/** Exercises the browser's real WebGL loss/restoration path when available. */
export function exerciseWebglContextLoss(canvas: HTMLCanvasElement): boolean {
  const context = canvas.getContext('webgl2')
  const extension = context?.getExtension(
    'WEBGL_lose_context'
  ) as LoseContextExtension | null
  if (extension === null || extension === undefined) return false
  extension.loseContext()
  globalThis.setTimeout(() => extension.restoreContext(), 250)
  return true
}

export function webgl2Description(
  canvas: HTMLCanvasElement
): string | undefined {
  const context = canvas.getContext('webgl2')
  if (context === null) return undefined
  return context.getParameter(context.VERSION) as string
}
