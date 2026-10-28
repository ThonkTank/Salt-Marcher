export function createEditorSurface(roots: readonly HTMLElement[]) {
  if (!roots.length) throw new Error('An editor needs its own surface');
  const document = roots[0]!.ownerDocument;
  const nodes = new Map<string, HTMLElement>();
  const collect = () => {
    for (const root of roots) {
      if (root.ownerDocument !== document) throw new Error('Editor surfaces span documents');
      if (root.id) nodes.set(root.id, root);
      for (const node of root.querySelectorAll<HTMLElement>('[id]')) nodes.set(node.id, node);
    }
  };
  collect();
  const get = <T extends HTMLElement>(id: string): T => {
    if (!nodes.has(id)) collect();
    return nodes.get(id) as T;
  };
  const register = (root: HTMLElement) => {
    if (root.ownerDocument !== document) throw new Error('Editor surfaces span documents');
    if (root.id) nodes.set(root.id, root);
    for (const node of root.querySelectorAll<HTMLElement>('[id]')) nodes.set(node.id, node);
  };
  return { document, get, register };
}
