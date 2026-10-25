/** A page-scroll gesture must not also step a numeric draft. */
export function initNumberInputScroll(root: Document) {
  root.addEventListener(
    'wheel',
    (event) => {
      const active = root.activeElement;
      if (
        active?.tagName === 'INPUT' &&
        (active as HTMLInputElement).type === 'number' &&
        event.target === active
      )
        (active as HTMLInputElement).blur();
    },
    { capture: true, passive: true },
  );
}
