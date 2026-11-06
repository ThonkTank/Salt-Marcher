/** React effect cleanup cancels a superseded or unmounted canvas draw. */
export function scheduleCanvasFrame(draw: () => void): () => void {
  const frame = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(frame);
}
