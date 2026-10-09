import { decode } from "png-tools";
import { unzlibSync } from "fflate";

/** Decode PNG bytes inside the renderer without losing raw RGBA channels. */
export async function decodeBrowserImagePixels(image: Blob): Promise<{
  width: number; height: number; rgba: Uint8Array | Uint8ClampedArray;
}> {
  const bytes = new Uint8Array(await image.arrayBuffer());
  try {
    const png = decode(bytes, (compressed) => unzlibSync(compressed));
    if (png.depth === 8 && png.data instanceof Uint8Array &&
        png.data.length === png.width * png.height * 4)
      return { width: png.width, height: png.height, rgba: png.data };
  } catch {
    // Other valid PNG encodings can still use the browser decoder below.
  }
  const bitmap = await createImageBitmap(image, {
    colorSpaceConversion: "none",
    premultiplyAlpha: "none",
  });
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Bildkontext nicht verfügbar.");
    context.drawImage(bitmap, 0, 0);
    return { width: bitmap.width, height: bitmap.height,
      rgba: context.getImageData(0, 0, bitmap.width, bitmap.height).data };
  } finally {
    bitmap.close();
  }
}
