import type { DeskRef, DeskContent } from './scene-desk-contracts';
import { referenceMarkdown, plainReferenceText } from './text-references';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
export async function chooseTextReference(
  token: string,
  initialLabel = '',
  stillCurrent: () => boolean = () => true,
): Promise<string | null> {
  const dialog = node('dialog');
  dialog.id = 'text-reference-picker';
  dialog.className = 'text-reference-picker';
  dialog.setAttribute('aria-label', 'Textverweis einfügen');
  const search = node('input'),
    kind = node('select'),
    list = node('div'),
    detail = node('section'),
    alias = node('input'),
    status = node('p'),
    insert = node('button', 'Verweis einfügen'),
    cancel = node('button', 'Abbrechen'),
    next = node('button', 'Weitere 40');
  search.type = 'search';
  search.placeholder = 'Ziel suchen';
  search.setAttribute('aria-label', 'Verweisziel suchen');
  alias.value = initialLabel;
  alias.maxLength = 1000;
  alias.setAttribute('aria-label', 'Anzeigename / Suchbegriff');
  alias.id = 'text-reference-alias';
  search.id = 'text-reference-search';
  kind.id = 'text-reference-kind';
  list.id = 'text-reference-results';
  detail.id = 'text-reference-detail';
  insert.id = 'text-reference-insert';
  insert.type = cancel.type = next.type = 'button';
  insert.disabled = true;
  next.hidden = true;
  for (const [id, label] of [
    ['world', 'Welt und Regeln'],
    ['creature', 'Kreaturen'],
    ['item', 'Gegenstände'],
    ['encounter', 'Begegnungen'],
    ['reference', 'Verknüpfte Begriffe'],
  ])
    kind.add(new Option(label, id));
  let target: DeskContent | null = null,
    request = 0,
    detailRequest = 0,
    offset = 0,
    timer: ReturnType<typeof setTimeout> | null = null;
  const head = node('div');
  head.className = 'toolbar';
  head.append(node('h2', 'Textverweis einfügen'), cancel);
  const label = node('label', 'Anzeigename / Suchbegriff');
  label.append(alias);
  const body = node('div');
  body.className = 'text-reference-columns';
  const index = node('section');
  index.append(search, kind, list, next);
  body.append(index, detail);
  dialog.append(
    head,
    node(
      'p',
      'Wähle eine Quelle und einen Anzeigenamen. Der Verweis bleibt Teil deines Notiztexts.',
    ),
    body,
    label,
    insert,
    status,
  );
  document.body.append(dialog);
  return new Promise<string | null>((resolve) => {
    const finish = (value: string | null) => {
      resolve(value);
      request++;
      detailRequest++;
      if (timer) clearTimeout(timer);
      if (dialog.open) dialog.close();
      dialog.remove();
    };
    const active = () => {
      if (!stillCurrent() || !dialog.isConnected || !dialog.open) {
        finish(null);
        return false;
      }
      return true;
    };
    dialog.addEventListener('close', () => finish(null));
    cancel.onclick = () => finish(null);
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      finish(null);
    });
    async function loadMore() {
      if (!active()) return;
      const n = ++request;
      next.disabled = true;
      status.textContent = 'Quellen werden gesucht…';
      try {
        const r = await window.campaign.searchDesk(
          token,
          kind.value as Parameters<typeof window.campaign.searchDesk>[1],
          search.value,
          offset,
        );
        if (!active() || n !== request) return;
        if (!r.ok) throw new Error(r.error);
        if (!offset) list.replaceChildren();
        for (const entry of r.value.entries) {
          const b = node('button', entry.title + ' · ' + entry.label);
          b.type = 'button';
          b.disabled = !!entry.unavailable;
          b.dataset.reference = entry.ref.kind + ':' + entry.ref.id;
          b.onclick = () => {
            if (active() && b.isConnected && !b.disabled) void select(entry.ref);
          };
          list.append(b);
        }
        offset = r.value.next ?? offset;
        next.hidden = r.value.next === null;
        status.textContent =
          r.value.notice ?? (r.value.entries.length ? 'Ziel wählen.' : 'Keine Treffer.');
      } catch (e) {
        if (active() && n === request) status.textContent = (e as Error).message;
      } finally {
        if (dialog.open && n === request) next.disabled = false;
      }
    }
    async function select(ref: DeskRef) {
      if (!active()) return;
      const n = ++detailRequest,
        shownAlias = alias.value,
        defaultAlias = target?.title;
      target = null;
      insert.disabled = true;
      detail.replaceChildren(node('p', 'Quelle wird gelesen…'));
      try {
        const r = await window.campaign.deskContent(token, ref);
        if (!active() || n !== detailRequest) return;
        if (!r.ok) throw new Error(r.error);
        if (r.value.unavailable) throw new Error('Quelle nicht verfügbar.');
        target = r.value;
        if (
          !initialLabel &&
          alias.value === shownAlias &&
          (!shownAlias || shownAlias === defaultAlias)
        )
          alias.value = target.title;
        detail.replaceChildren(
          node('h3', target.title),
          node('p', target.label + ' · Revision ' + target.revision),
        );
        const text = target.note
          ? [target.note.readAloud, target.note.gmNotes].filter(Boolean).join('\n\n')
          : target.location
            ? target.location.sections.map((s) => s.title + '\n' + s.markdown).join('\n\n')
            : target.item
              ? target.item.description
              : target.encounter
                ? target.encounter.notes
                : target.creature
                  ? target.creature.size +
                    ' ' +
                    target.creature.type +
                    ' · HG ' +
                    target.creature.challengeRating +
                    ' · TP ' +
                    target.creature.hp
                  : '';
        detail.append(node('pre', plainReferenceText(text)));
        insert.disabled = !alias.value.trim();
      } catch (e) {
        if (active() && n === detailRequest) {
          target = null;
          status.textContent = (e as Error).message;
        }
      }
    }
    const reset = () => {
      request++;
      detailRequest++;
      offset = 0;
      target = null;
      insert.disabled = true;
      next.hidden = true;
      list.replaceChildren();
      detail.replaceChildren();
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void loadMore();
      }, 180);
    };
    search.oninput = reset;
    kind.onchange = reset;
    next.onclick = () => {
      if (!next.hidden && !next.disabled && next.isConnected) void loadMore();
    };
    alias.oninput = () => {
      if (active()) insert.disabled = !target || !alias.value.trim();
    };
    insert.onclick = () => {
      const chosen = target,
        name = alias.value,
        n = detailRequest;
      if (!active() || insert.disabled || !chosen || !name.trim()) return;
      const current = () =>
        active() && detailRequest === n && target === chosen && alias.value === name;
      insert.disabled = true;
      void (async () => {
        try {
          const fresh = await window.campaign.deskContent(token, chosen.ref);
          if (!current()) return;
          if (!fresh.ok) throw new Error(fresh.error);
          if (
            fresh.value.unavailable ||
            fresh.value.ref.kind !== chosen.ref.kind ||
            fresh.value.ref.id !== chosen.ref.id ||
            fresh.value.revision !== chosen.revision
          )
            throw new Error('Quelle geändert. Ziel erneut wählen.');
          finish(referenceMarkdown(chosen.ref, name));
        } catch (e) {
          if (current()) {
            status.textContent = (e as Error).message;
            insert.disabled = false;
          }
        }
      })();
    };
    dialog.showModal();
    search.focus();
    void loadMore();
  });
}
