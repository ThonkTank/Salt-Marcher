import { AtlasPaint } from './atlas-paint';
import { svgNamespace, paintSvgTag, paintSvgAttributes } from './atlas-paint-svg';

export function paintElement(n: AtlasPaint, doc: Document): SVGElement {
  const e = doc.createElementNS(svgNamespace, paintSvgTag(n));
  for (const [k, v] of Object.entries(paintSvgAttributes(n))) e.setAttribute(k, String(v));
  if (n.title) {
    const t = doc.createElementNS(svgNamespace, 'title');
    t.textContent = n.title;
    e.append(t);
  }
  if (n.text) e.append(doc.createTextNode(n.text));
  for (const c of n.children) e.append(paintElement(c, doc));
  return e;
}
export type PaintTarget = SVGElement | AtlasPaint;
export function appendPaint(root: PaintTarget, ...nodes: AtlasPaint[]) {
  if (root instanceof AtlasPaint) root.append(...nodes);
  else root.append(...nodes.map((n) => paintElement(n, root.ownerDocument)));
}
