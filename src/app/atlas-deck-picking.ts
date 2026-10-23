import {VERSION} from '@deck.gl/core';
import type {Device, Framebuffer} from '@luma.gl/core';

interface PickerRuntime {
  device: Device;
  pickingFBO?: Framebuffer;
  depthFBO?: Framebuffer;
  _resizeBuffer: (...args: unknown[]) => void;
}

const format = (buffer: Framebuffer | undefined) => buffer?.depthStencilAttachment?.texture.format;

/** Deck 9.4 allocates 16-bit picking depth even on a 24-bit canvas.
 * Coplanar quantization can then select a buried room. Install 24-bit buffers
 * at the pinned private allocation boundary; Deck still owns resize/finalize.
 * No global device factory or projection changes are involved. */
export function ensureAtlasDeckPickingDepth(deck: object): void {
  if (VERSION !== '9.4.0') throw new Error('Atlas picking requires reviewed deck.gl 9.4.0');
  const picker = (deck as unknown as {deckPicker?: PickerRuntime}).deckPicker;
  if (!picker || typeof picker._resizeBuffer !== 'function' || !picker.device)
    throw new Error('Unsupported Atlas Deck picker contract');
  const oldColor = picker.pickingFBO, oldDepth = picker.depthFBO;
  if ([{buffer:oldColor,expected:'rgba8unorm'}, {buffer:oldDepth,expected:'rgba32float'}]
    .some(({buffer,expected}) => buffer && (buffer.colorAttachments.length !== 1 || buffer.colorAttachments[0]!.texture.format !== expected)))
    throw new Error('Unsupported Atlas picking color attachment');
  if (format(oldColor) === 'depth24plus' && format(oldDepth) === 'depth24plus') return;
  if ([oldColor, oldDepth].some(buffer => buffer && format(buffer) !== 'depth16unorm'))
    throw new Error('Unsupported Atlas picking framebuffer format');
  const device = picker.device;
  // luma's WebGL "renderable" capability asks about COLOR renderability;
  // depth attachments use the support check and framebuffer completeness.
  if (!device.isTextureFormatSupported('depth24plus') || !device.isTextureFormatRenderable('rgba32float'))
    throw new Error('Atlas requires 24-bit picking depth and floating-point height readback');
  let color: Framebuffer | undefined, depth: Framebuffer | undefined;
  try {
    // String attachments are owned by their framebuffer, including cleanup on
    // failure. Do not borrow attachments from the old buffers.
    color = device.createFramebuffer({id: 'atlas-picking-24', colorAttachments: ['rgba8unorm'], depthStencilAttachment: 'depth24plus'});
    depth = device.createFramebuffer({id: 'atlas-height-24', colorAttachments: ['rgba32float'], depthStencilAttachment: 'depth24plus'});
  } catch (error) {
    color?.destroy(); depth?.destroy(); throw error;
  }
  picker.pickingFBO = color;
  picker.depthFBO = depth;
  for (const buffer of [oldColor, oldDepth]) {
    if (!buffer) continue;
    // Deck's original color textures were passed as external attachments and
    // are not owned by Framebuffer.destroy(). They belong to this picker.
    const colors = buffer.colorAttachments.map(attachment => attachment.texture);
    buffer.destroy();
    for (const texture of colors) if (!texture.destroyed) texture.destroy();
  }
}
