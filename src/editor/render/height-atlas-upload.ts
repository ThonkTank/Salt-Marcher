import {
  BufferImageSource,
  ExtensionType,
  extensions,
  type GlTexture,
} from "pixi.js";

/** Atlas allocation is separate from bounded transfers, including cold growth. */
export class HeightAtlasSource extends BufferImageSource {
  readonly uploadMethodId = "atlas-height-numeric";
  range: [number, number] | null = null;

  uploadRange(from: number, to: number): void {
    this.range = [from, to];
    try {
      this.update(from, to);
    } finally {
      this.range = null;
    }
  }
}

extensions.add({
  extension: {
    type: ExtensionType.TextureUploaderWebGL,
    name: "atlas-height-numeric",
  },
  id: "atlas-height-numeric",
  upload(
    source: HeightAtlasSource,
    texture: GlTexture,
    gl: WebGLRenderingContext | WebGL2RenderingContext,
  ): void {
    if (texture.width !== source.width || texture.height !== source.height) {
      gl.texImage2D(
        texture.target,
        0,
        texture.internalFormat,
        source.width,
        source.height,
        0,
        texture.format,
        texture.type,
        null,
      );
      texture.width = source.width;
      texture.height = source.height;
    }
    if (!source.range) return;
    const values = source.resource as Float32Array | Uint8Array;
    const components = values.length / (source.width * source.height);
    let [from, to] = source.range;
    // A linear span consists of at most a leading row, complete rows, and a
    // trailing row. Every call transfers exactly the budgeted source values.
    while (from < to) {
      const x = from % source.width;
      const y = Math.floor(from / source.width);
      const width = Math.min(source.width - x, to - from);
      const height =
        x === 0 && width === source.width
          ? Math.floor((to - from) / source.width)
          : 1;
      const end = from + width * height;
      gl.texSubImage2D(
        texture.target,
        0,
        x,
        y,
        width,
        height,
        texture.format,
        texture.type,
        values.subarray(from * components, end * components),
      );
      from = end;
    }
  },
});
