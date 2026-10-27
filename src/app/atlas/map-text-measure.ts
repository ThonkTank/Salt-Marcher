let context: CanvasRenderingContext2D | null | undefined;
export function measureMapText(text: string, font: number) {
  if (context === undefined)
    context =
      typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (context) {
    context.font = `${font}px sans-serif`;
    return context.measureText(text).width;
  }
  return Array.from(text).length * font * 0.62;
}
