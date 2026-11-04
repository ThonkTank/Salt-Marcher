import type { Page } from "@playwright/test";

export function redPixelCount(page: Page, testId = "atlas-overlay") {
  return page.getByTestId(testId).evaluate((canvas: HTMLCanvasElement) => {
    const rgba = canvas
      .getContext("2d")!
      .getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 0; i < rgba.length; i += 4)
      if (rgba[i] > 150 && rgba[i] > rgba[i + 1] * 1.5 && rgba[i + 3]) count++;
    return count;
  });
}
