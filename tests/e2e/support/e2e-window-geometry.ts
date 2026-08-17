export type ElectronContentGeometry = Readonly<{
  contentWidth: number
  contentHeight: number
}>

export type RendererLayoutGeometry = Readonly<{
  innerWidth: number
  innerHeight: number
  workspace: Readonly<{
    ready: boolean
    measuredWidth: number
    renderedWidth: number
  }> | null
}>

export function rendererAcknowledgesWindowGeometry(
  content: ElectronContentGeometry,
  renderer: RendererLayoutGeometry
): boolean {
  const contentMatches =
    Math.abs(renderer.innerWidth - content.contentWidth) <= 1 &&
    Math.abs(renderer.innerHeight - content.contentHeight) <= 1
  const workspaceMatches =
    renderer.workspace === null ||
    (renderer.workspace.ready &&
      Number.isFinite(renderer.workspace.measuredWidth) &&
      Math.abs(
        renderer.workspace.measuredWidth - renderer.workspace.renderedWidth
      ) <= 1)
  return contentMatches && workspaceMatches
}
