/** A mounted editor owns its event registrations and generated controls. */
export function editorInstanceEvents() {
  const cleanups: (() => void)[] = [];
  function listen<K extends keyof HTMLElementEventMap>(
    node: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
  ) {
    node.addEventListener(type, listener);
    cleanups.push(() => node.removeEventListener(type, listener));
  }
  return { listen, cleanups };
}

export function clearEditorHandlers(root: HTMLElement) {
  for (const node of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
    node.onclick = node.oninput = node.onchange = node.onsubmit = null;
  }
}
