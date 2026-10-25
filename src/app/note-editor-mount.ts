// One Preparation editor and writer, temporarily displayed in contextual hosts.
// Nested hosts restore in reverse order. Retiring an outer host first retires
// its borrowers, so an old dialog cannot strand the author controls elsewhere.
const ids = [
  'preparation-problems',
  'note-editor',
  'preparation-apply',
  'preparation-reconcile',
  'preparation-refresh',
];
const leases: { retire: () => void; restore: () => void }[] = [];
export function mountNoteEditor(host: HTMLElement, retire: () => void): () => void {
  const nodes = ids.map((id) => {
    const n = document.getElementById(id);
    if (!n) throw Error('Gemeinsamer Notizeditor ist nicht verfügbar.');
    return n;
  });
  const mounts = nodes.map((node) => {
    const anchor = document.createComment('note-editor-home');
    node.before(anchor);
    host.append(node);
    return { node, anchor };
  });
  const back = document.getElementById('note-back'),
    backHidden = back?.hidden ?? false;
  if (back) back.hidden = true;
  const lease = {
    retire,
    restore: () => {
      const index = leases.indexOf(lease);
      if (index < 0) return;
      while (leases.length > index + 1) {
        const child = leases.at(-1)!;
        child.retire();
        if (leases.includes(child)) child.restore();
      }
      leases.pop();
      for (const m of mounts) m.anchor.replaceWith(m.node);
      if (back) back.hidden = backHidden;
    },
  };
  leases.push(lease);
  return lease.restore;
}

/** Read-only trash originals expose Restore instead of an editable title. */
export function focusNoteEditor() {
  document
    .getElementById('note-editor')
    ?.querySelector<HTMLElement>('#note-title:enabled, #note-restore:not([hidden])')
    ?.focus();
}
