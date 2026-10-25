/** Exact alpha of an immutable decoded asset; lifetime follows the asset, not a scene. */
export interface AtlasImageAlpha {
  pixels: Uint8Array;
  width: number;
  height: number;
}

const assets = new WeakMap<CanvasImageSource, AtlasImageAlpha>();

export function atlasImageAlpha(image: CanvasImageSource): AtlasImageAlpha {
  const cached = assets.get(image);
  if (cached) return cached;
  const source = image as {naturalWidth?: number; naturalHeight?: number; width?: number; height?: number};
  const width = Number(source.naturalWidth ?? source.width), height = Number(source.naturalHeight ?? source.height);
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1)
    throw Error('Bildabmessungen für Atlas-Auswahl fehlen.');
  // The editor already bounds decoded images. Read exact pixels without another
  // resize; tile the temporary RGBA surface so output assets need no huge canvas.
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(1024, width); canvas.height = Math.min(1024, height);
  try {
    const ctx = canvas.getContext('2d', {willReadFrequently: true});
    if (!ctx) throw Error('Bildtransparenz für Atlas-Auswahl nicht verfügbar.');
    const pixels = new Uint8Array(width * height);
    for (let y = 0; y < height; y += canvas.height) for (let x = 0; x < width; x += canvas.width) {
      const w = Math.min(canvas.width, width - x), h = Math.min(canvas.height, height - y);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, x, y, w, h, 0, 0, w, h);
      const rgba = ctx.getImageData(0, 0, w, h).data;
      for (let row = 0; row < h; row++) for (let column = 0; column < w; column++)
        pixels[(y + row) * width + x + column] = rgba[(row * w + column) * 4 + 3]!;
    }
    const alpha = {pixels, width, height};
    assets.set(image, alpha);
    return alpha;
  } finally {
    canvas.width = canvas.height = 0;
  }
}

export function releaseAtlasImageAlpha(image: CanvasImageSource) {
  assets.delete(image);
}
