export type ElectronContentGeometry = Readonly<{
  contentWidth: number
  contentHeight: number
}>

export type OuterWindowGeometry = Readonly<{
  width: number
  height: number
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

export type RendererWindowGeometry = RendererLayoutGeometry &
  Readonly<{
    outerWidth: number
    outerHeight: number
  }>

export function rendererAcknowledgesWindowGeometry(
  content: ElectronContentGeometry,
  renderer: RendererLayoutGeometry
): boolean {
  const contentMatches =
    Math.abs(renderer.innerWidth - content.contentWidth) <= 1 &&
    Math.abs(renderer.innerHeight - content.contentHeight) <= 1
  return contentMatches && workspaceAcknowledgesResize(renderer)
}

export function rendererAcknowledgesOuterWindowGeometry(
  outer: OuterWindowGeometry,
  renderer: RendererWindowGeometry
): boolean {
  const outerMatches =
    Math.abs(renderer.outerWidth - outer.width) <= 1 &&
    Math.abs(renderer.outerHeight - outer.height) <= 1
  const contentIsPlausible =
    renderer.innerWidth > 0 &&
    renderer.innerHeight > 0 &&
    renderer.innerWidth <= renderer.outerWidth &&
    renderer.innerHeight <= renderer.outerHeight
  return (
    outerMatches && contentIsPlausible && workspaceAcknowledgesResize(renderer)
  )
}

function workspaceAcknowledgesResize(
  renderer: RendererLayoutGeometry
): boolean {
  return (
    renderer.workspace === null ||
    (renderer.workspace.ready &&
      Number.isFinite(renderer.workspace.measuredWidth) &&
      Math.abs(
        renderer.workspace.measuredWidth - renderer.workspace.renderedWidth
      ) <= 1)
  )
}
