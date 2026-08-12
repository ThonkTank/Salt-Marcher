// Pixi's public root entry eagerly installs every browser and worker feature.
// Keep the version-coupled imports in this one adapter so the production map
// only ships the WebGL renderer and the Container/Graphics/Text primitives it
// actually uses. The dependency is pinned and this adapter is covered by the
// renderer smoke and bundle checks.
import '../../../node_modules/pixi.js/lib/rendering/init.mjs'
import '../../../node_modules/pixi.js/lib/unsafe-eval/init.mjs'
import type {
  Container as PixiContainer,
  Graphics as PixiGraphics,
  Text as PixiText,
  WebGLRenderer as PixiWebGLRenderer
} from 'pixi.js'
// @ts-expect-error Pixi publishes declarations only through its eager root.
import { Container as RuntimeContainer } from '../../../node_modules/pixi.js/lib/scene/container/Container.mjs'
// @ts-expect-error See the version boundary documented above.
import { Graphics as RuntimeGraphics } from '../../../node_modules/pixi.js/lib/scene/graphics/shared/Graphics.mjs'
// @ts-expect-error See the version boundary documented above.
import { Text as RuntimeText } from '../../../node_modules/pixi.js/lib/scene/text/Text.mjs'
// @ts-expect-error See the version boundary documented above.
import { WebGLRenderer as RuntimeWebGLRenderer } from '../../../node_modules/pixi.js/lib/rendering/renderers/gl/WebGLRenderer.mjs'

export type Container = PixiContainer
export type Graphics = PixiGraphics
export type Text = PixiText
export type WebGLRenderer = PixiWebGLRenderer

export const Container = RuntimeContainer as unknown as typeof PixiContainer
export const Graphics = RuntimeGraphics as unknown as typeof PixiGraphics
export const Text = RuntimeText as unknown as typeof PixiText
export const WebGLRenderer =
  RuntimeWebGLRenderer as unknown as typeof PixiWebGLRenderer
