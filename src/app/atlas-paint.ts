/** Retained paint commands, not browser elements. Canonical objects stay in the source frame. */
export class AtlasPaint {
  readonly children: AtlasPaint[] = [];
  readonly dataset: Record<string, string> = {};
  parent: AtlasPaint | null = null;
  textContent = "";
  readonly attrs: Record<string, string> = {};
  constructor(
    readonly tagName: string,
    attrs: Record<string, string | number> = {},
  ) {
    for (const [key, value] of Object.entries(attrs))
      this.setAttribute(key, String(value));
  }
  setAttribute(key: string, value: string) {
    this.attrs[key] = value;
    if (key.startsWith("data-"))
      this.dataset[
        key.slice(5).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
      ] = value;
  }
  getAttribute(key: string) {
    return this.attrs[key] ?? null;
  }
  append(...nodes: AtlasPaint[]) {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
  }
  closest(selector: string): AtlasPaint | null {
    for (let n: AtlasPaint | null = this; n; n = n.parent)
      if (
        selector.split(",").some((s) => {
          const m = s.trim().match(/^\[data-([\w-]+)\]$/);
          return (
            !!m &&
            n!.dataset[
              m[1]!.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
            ] !== undefined
          );
        })
      )
        return n;
    return null;
  }
}

export const atlasPaint = (
  tag: string,
  attrs: Record<string, string | number> = {},
  text?: string,
) => {
  const node = new AtlasPaint(tag, attrs);
  if (text) node.textContent = text;
  return node;
};
const escapeXML = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
/** Serialize the same geometry for vector exports and legacy SVG hosts. */
export function paintMarkup(node: AtlasPaint): string {
  const attrs = Object.entries(node.attrs).map(([k,v]) => ` ${k}="${escapeXML(v)}"`).join("");
  return `<${node.tagName}${attrs}>${escapeXML(node.textContent)}${node.children.map(paintMarkup).join("")}</${node.tagName}>`;
}
export function paintElement(node: AtlasPaint, doc: Document): SVGElement {
  const element = doc.createElementNS("http://www.w3.org/2000/svg", node.tagName);
  for (const [k,v] of Object.entries(node.attrs)) element.setAttribute(k,v);
  element.textContent = node.textContent;
  for (const child of node.children) element.append(paintElement(child,doc));
  return element;
}
