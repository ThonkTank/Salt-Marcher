/** Dialogs and composing/claimed gestures keep their own keyboard context. */
export function workspaceShortcutAvailable(event: KeyboardEvent): boolean {
  return (
    !document.body?.classList.contains('campaign-screen-open') &&
    !event.defaultPrevented &&
    !event.isComposing &&
    !document.querySelector('dialog[open]')
  );
}

export function bindAtlasHistoryShortcut(
  active: () => boolean,
  composing: () => boolean,
  change: (direction: 'undo' | 'redo') => void,
): () => void {
  const owner = document;
  const keydown = (event: KeyboardEvent) => {
    if (
      !active() ||
      composing() ||
      !workspaceShortcutAvailable(event) ||
      !(event.ctrlKey || event.metaKey) ||
      event.key.toLowerCase() !== 'z'
    )
      return;
    const target = event.target as Element | null;
    if (
      target &&
      typeof target.closest === 'function' &&
      target.closest(
        'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]',
      )
    )
      return;
    for (const popover of owner.querySelectorAll('[popover]'))
      if (popover.matches(':popover-open')) return;
    event.preventDefault();
    change(event.shiftKey ? 'redo' : 'undo');
  };
  owner.addEventListener('keydown', keydown);
  return () => owner.removeEventListener('keydown', keydown);
}
