export interface BrushCursor {
  x: number;
  y: number;
  radius: number;
  waiting?: boolean;
}

/** A pointer affordance, independent of terrain submission and never a receipt. */
export class CursorOverlay {
  private element: HTMLDivElement | null = null;

  constructor(canvas: HTMLCanvasElement) {
    // The map container clips the screen-space ring at the viewport boundary.
    // Tests without a DOM can still exercise the renderer's GL boundary.
    if (!canvas.parentElement || !canvas.ownerDocument?.createElement) return;
    const element = canvas.ownerDocument.createElement("div");
    element.className = "atlas-brush-cursor";
    element.setAttribute("aria-hidden", "true");
    Object.assign(element.style, {
      position: "absolute",
      left: "0",
      top: "0",
      pointerEvents: "none",
      boxSizing: "border-box",
      borderRadius: "50%",
      border: "1.2px solid #f1d49c",
      opacity: "0.9",
      display: "none",
      willChange: "transform",
    });
    canvas.parentElement.insertBefore(element, canvas.nextSibling);
    this.element = element;
  }

  update(cursor: BrushCursor | null): void {
    const element = this.element;
    if (!element) return;
    if (!cursor) {
      element.style.display = "none";
      return;
    }
    const diameter = Math.max(0, cursor.radius * 2);
    element.style.display = "block";
    element.style.width = `${diameter}px`;
    element.style.height = `${diameter}px`;
    element.style.transform = `translate3d(${cursor.x - cursor.radius}px, ${cursor.y - cursor.radius}px, 0)`;
    element.style.borderColor = cursor.waiting ? "#c9d2d4" : "#f1d49c";
    element.style.opacity = cursor.waiting ? "0.45" : "0.9";
  }

  destroy(): void {
    this.element?.remove();
    this.element = null;
  }
}
