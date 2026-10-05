import { Buffer } from "node:buffer";
import { PNG } from "pngjs";
import {
  recolorColorableObjectRgba,
  type ColorableObjectSettings,
} from "./colorable-pixels";

export interface LibraryTilePixels {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
}

export type LibraryTileEncoder = (
  width: number,
  height: number,
  rgba: Uint8Array,
) => string;

function encodePngDataUrl(
  width: number,
  height: number,
  rgba: Uint8Array,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Bibliotheksvorschau: Canvas nicht verfügbar.");
  context.putImageData(
    new ImageData(new Uint8ClampedArray(rgba), width, height),
    0,
    0,
  );
  return canvas.toDataURL("image/png");
}

/** Only changes a library image. Map entities and tool defaults belong to the picker host. */
export class ObjectLibraryTilePreview {
  private revision = 0;
  private disposed = false;

  constructor(
    private image: Pick<HTMLImageElement, "src">,
    private source: Promise<LibraryTilePixels>,
    private settings: ColorableObjectSettings,
    private encode: LibraryTileEncoder = encodePngDataUrl,
  ) {}

  async set(rgb: number, alpha: number): Promise<boolean> {
    const revision = ++this.revision;
    const { width, height, rgba } = await this.source;
    if (this.disposed || revision !== this.revision) return false;
    const recolored = recolorColorableObjectRgba(
      rgba,
      [(rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, alpha],
      this.settings,
    );
    const url = this.encode(width, height, recolored);
    if (this.disposed || revision !== this.revision) return false;
    this.image.src = url;
    return true;
  }

  dispose(): void {
    this.disposed = true;
    this.revision++;
  }
}

export function createObjectLibraryTilePreview(
  image: HTMLImageElement,
  source: Blob,
  settings: ColorableObjectSettings,
): ObjectLibraryTilePreview {
  const pixels = source.arrayBuffer().then((bytes) => {
    const png = PNG.sync.read(Buffer.from(bytes));
    return { width: png.width, height: png.height, rgba: png.data };
  });
  return new ObjectLibraryTilePreview(image, pixels, settings);
}
