import { parseHTML as parse } from 'linkedom';
export * from 'linkedom';

// linkedom walks every element for every getElementById call. The full app's
// live panels make thousands of these calls per scenario. Maintain an index
// without replacing the real markup, events or UI code under test.
export function parseHTML(...args) {
  const window = parse(...args);
  const { document, MutationObserver } = window;
  const original = document.getElementById.bind(document);
  const ids = new Map(),
    indexed = new WeakMap();
  function update(element) {
    const previous = indexed.get(element);
    if (previous !== undefined) {
      const group = ids.get(previous);
      group?.delete(element);
      if (!group?.size) ids.delete(previous);
      indexed.delete(element);
    }
    if (element.ownerDocument === document && element.getRootNode() === document && element.id) {
      const id = element.id;
      if (!ids.has(id)) ids.set(id, new Set());
      ids.get(id).add(element);
      indexed.set(element, id);
    }
  }
  function subtree(node) {
    if (node.nodeType !== 1) return;
    update(node);
    for (const element of node.querySelectorAll('[id]')) update(element);
  }
  function changes(records) {
    for (const record of records) {
      if (record.type === 'attributes') update(record.target);
      else {
        for (const node of record.removedNodes) subtree(node);
        for (const node of record.addedNodes) subtree(node);
      }
    }
  }
  for (const element of document.querySelectorAll('[id]')) update(element);
  const observer = new MutationObserver(changes);
  observer.observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['id'],
  });
  document.getElementById = (id) => {
    changes(observer.takeRecords());
    if (typeof id !== 'string' || !id) return original(id);
    const group = ids.get(id);
    // Invalid duplicate IDs need the library's actual document-order lookup;
    // its compareDocumentPosition is not reliable across separate subtrees.
    if (group?.size > 1) return original(id);
    return group?.values().next().value ?? null;
  };
  return window;
}
