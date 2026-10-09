/** Decode an image inside the renderer without Node or filesystem access. */
export async function decodeBrowserImagePixels(image: Blob): Promise<{
  width: number; height: number; rgba: Uint8ClampedArray;
}> {
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
