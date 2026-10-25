/** Atlas controls share stable IDs across the editor and its live-session dock. */
export const atlasElement = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
/** Retain equal text nodes: repeated read/status updates must not invalidate layout. */
export function setAtlasText(id: string, value: string) {
  const node = atlasElement(id);
  if (node.textContent !== value) node.textContent = value;
}
