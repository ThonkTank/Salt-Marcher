import { Buffer } from "node:buffer";
import { PNG } from "pngjs";
import { BufferImageSource, ImageSource, Texture } from "pixi.js";
import {
  recolorColorableObjectRgba,
  type ColorableObjectSettings,
} from "./features/objekte/colorable-pixels";
import { isNativeFloorAssetId } from "./features/material/native-path-catalog";
interface Entry {
  refs: number;
  bytes: number;
  lastUsed: number;
  texture?: Texture;
  promise: Promise<Texture>;
}
/** One owner per view. Unused images are evicted; all sources are released on close. */
export class TexturePool {
  private entries = new Map<string, Entry>();
  private closed = false;
  private clock = 0;
  constructor(
    private url: (path: string) => string,
    private budget = 384 * 1024 * 1024,
  ) {}
  acquire(path: string, rawNativeFloor = false): Promise<Texture> {
    const key = rawNativeFloor ? path + "\0raw" : path;
    let entry = this.entries.get(key);
    if (!entry) {
      const image = new Image();
      image.src = this.url(path);
      entry = {
        refs: 0,
        bytes: 0,
        lastUsed: ++this.clock,
        promise: Promise.resolve(null as unknown as Texture),
      };
      const owned = entry;
      entry.promise = image
        .decode()
        .then(() => {
          if (this.closed) throw new Error("Bildansicht geschlossen.");
          let resource: HTMLImageElement | HTMLCanvasElement = image;
          if (!rawNativeFloor && isNativeFloorAssetId(path.split("\0", 1)[0]) &&
              image.width % 256 === 0 && image.height % 256 === 0) {
            // Native floors choose a variant for each field. Smart atlases
            // keep their repeatable cells above the edge/corner rows.
            const columns = image.width / 256;
            const smart = path.includes("tileset_wood_vertical") ||
              path.includes("tileset_stone");
            const rows = smart ? image.height / 512 : image.height / 256;
            const variants: Array<[number, number]> = [];
            for (let y = 0; y < rows; y++)
              for (let x = 0; x < columns; x++)
                if (!(smart && y === rows - 1 && x % 4 === 3))
                  variants.push([x, y]);
            const canvas = document.createElement("canvas");
            canvas.width = 8 * 256;
            canvas.height = 8 * 256;
            const context = canvas.getContext("2d");
            if (!context) throw new Error("Kein Bildkontext für Bodenstil.");
            let seed = [...path].reduce((value, character) =>
              (Math.imul(value, 33) + character.charCodeAt(0)) >>> 0, 5381);
            for (let y = 0; y < 8; y++)
              for (let x = 0; x < 8; x++) {
                seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                const [column, row] = variants[seed % variants.length]!;
                context.drawImage(image, column * 256, row * 256, 256, 256,
                  x * 256, y * 256, 256, 256);
              }
            resource = canvas;
          }
          const source = new ImageSource({
            resource,
            ...(rawNativeFloor ? {} : { addressMode: "repeat" as const }),
            scaleMode: "linear",
          });
          owned.texture = new Texture({ source });
          owned.bytes = resource.width * resource.height * 4;
          this.evict();
          return owned.texture;
        })
        .catch((error) => {
          this.entries.delete(key);
          throw new Error(
            "Bildressource konnte nicht geladen werden: " +
              path +
              " (" +
              String(error) +
              ")",
          );
        });
      this.entries.set(key, entry);
    }
    entry.refs++;
    entry.lastUsed = ++this.clock;
    return entry.promise;
  }
  acquireColorableObject(
    path: string,
    image: Blob,
    rgb: number,
    alpha: number,
    settings: ColorableObjectSettings,
  ): { key: string; texture: Promise<Texture> } {
    const key = [path, "colorable-object", rgb, alpha,
      settings.minRedness, settings.minSaturation, settings.redTolerance].join("\0");
    let entry = this.entries.get(key);
    if (!entry) {
      entry = {
        refs: 0,
        bytes: 0,
        lastUsed: ++this.clock,
        promise: Promise.resolve(null as unknown as Texture),
      };
      const owned = entry;
      entry.promise = image.arrayBuffer()
        .then((bytes) => {
          const png = PNG.sync.read(Buffer.from(bytes));
          if (this.closed) throw new Error("Bildansicht geschlossen.");
          const rgba = recolorColorableObjectRgba(
            png.data,
            [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255, alpha],
            settings,
          );
          const source = new BufferImageSource({
            resource: rgba,
            width: png.width,
            height: png.height,
            format: "rgba8unorm",
            alphaMode: "no-premultiply-alpha",
            scaleMode: "linear",
          });
          owned.texture = new Texture({ source });
          owned.bytes = rgba.byteLength;
          this.evict();
          return owned.texture;
        })
        .catch((error) => {
          this.entries.delete(key);
          throw new Error(
            "Färbbares Objekt konnte nicht geladen werden: " +
            path + " (" + String(error) + ")",
          );
        });
      this.entries.set(key, entry);
    }
    entry.refs++;
    entry.lastUsed = ++this.clock;
    return { key, texture: entry.promise };
  }
  release(path: string): void {
    const entry = this.entries.get(path);
    if (entry) {
      entry.refs = Math.max(0, entry.refs - 1);
      entry.lastUsed = ++this.clock;
    }
    this.evict();
  }
  async ready(): Promise<void> {
    await Promise.all([...this.entries.values()].map((entry) => entry.promise));
  }
  get bytes(): number {
    return [...this.entries.values()].reduce((n, e) => n + e.bytes, 0);
  }
  private evict(): void {
    let total = this.bytes;
    for (const [key, e] of [...this.entries].sort(
      (a, b) => a[1].lastUsed - b[1].lastUsed,
    )) {
      if (total <= this.budget) break;
      if (!e.refs && e.texture) {
        total -= e.bytes;
        e.texture.destroy(true);
        this.entries.delete(key);
      }
    }
  }
  destroy(): void {
    this.closed = true;
    for (const e of this.entries.values()) e.texture?.destroy(true);
    this.entries.clear();
  }
}
