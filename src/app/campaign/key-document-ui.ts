import {
  keyDocumentParts,
  passageTarget,
  type KeyDocumentSource,
  type KeyDocumentPart,
  type KeyPassageTarget,
  type KeyBookmark,
} from './key-reading-model';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
const button = (text: string, fn: () => void) => {
  const b = node('button', text);
  b.type = 'button';
  b.onclick = fn;
  return b;
};
export class KeyDocumentReader {
  private query = node('input');
  private status = node('span');
  private body = node('div');
  private outline = node('details');
  private edit = node('button');
  private parts: KeyDocumentPart[] = [];
  private matches: { part: KeyDocumentPart; start: number; end: number; mark: HTMLElement }[] = [];
  private active = 0;
  private chosen: KeyDocumentPart | null = null;
  private marks: HTMLElement[] = [];
  private limited = false;
  private moreMatches = false;
  private navigation: HTMLButtonElement[] = [];
  constructor(
    private host: HTMLElement,
    sources: KeyDocumentSource[],
    query: string,
    private current: () => boolean,
    private open: (target: KeyPassageTarget, bookmark: KeyBookmark) => void,
  ) {
    host.className = 'key-document-reader';
    this.query.type = 'search';
    this.query.value = query;
    this.query.maxLength = 1000;
    this.query.setAttribute('aria-label', 'Im ausgewählten Raum suchen');
    this.query.id = 'key-document-search';
    this.status.id = 'key-document-match-count';
    this.status.setAttribute('role', 'status');
    this.edit.type = 'button';
    this.edit.id = 'key-document-edit';
    this.edit.textContent = 'Fundstelle bearbeiten';
    const previous = button('Vorige Fundstelle', () => this.move(-1)),
      next = button('Nächste Fundstelle', () => this.move(1));
    previous.id = 'key-document-prev';
    next.id = 'key-document-next';
    this.navigation = [previous, next];
    const field = node('label', 'Fundstellen im Raum');
    field.htmlFor = this.query.id;
    field.className = 'key-document-find';
    field.append(this.query);
    const toolbar = node('div');
    toolbar.className = 'key-document-tools';
    toolbar.append(field, previous, next, this.status, this.edit);
    this.outline.append(node('summary', 'Abschnitte im Raum'));
    const links = node('div');
    links.className = 'key-document-outline';
    this.outline.append(links);
    for (const source of sources) {
      const parsed = keyDocumentParts(source);
      this.parts.push(...parsed.parts);
      this.limited ||= parsed.limited;
    }
    for (const part of this.parts.filter((p) => p.level).slice(0, 200)) {
      const b = button(part.text, () => {
        if (!this.alive() || !b.isConnected) return;
        this.readAt(part);
      });
      b.style.paddingInlineStart = 0.5 + Math.min(3, part.level - 1) * 0.5 + 'rem';
      links.append(b);
    }
    this.outline.hidden = !links.childElementCount;
    host.append(toolbar, this.outline, this.body);
    this.query.oninput = () => {
      if (this.alive()) {
        this.active = 0;
        this.draw();
        this.reveal(false);
      }
    };
    this.query.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault();
        this.move(event.shiftKey ? -1 : 1, false);
      }
    });
    this.edit.onclick = () => {
      if (!this.alive() || !this.edit.isConnected || !this.chosen) return;
      const target = passageTarget(this.chosen);
      if (target) this.open(target, this.bookmark()!);
    };
    this.draw();
  }
  private alive() {
    return this.current() && this.host.isConnected;
  }
  private syncEdit() {
    this.edit.disabled = !this.chosen?.source.target;
    this.edit.textContent = this.chosen?.level
      ? 'Überschrift bearbeiten'
      : this.chosen?.source.target?.kind === 'text' && this.chosen.source.label.includes('Vorlage')
        ? 'Vorlage an Fundstelle bearbeiten'
        : 'Fundstelle bearbeiten';
  }
  private draw() {
    this.matches = [];
    this.marks = [];
    this.body.replaceChildren();
    this.chosen = null;
    let truncated = false,
      lastSource = '';
    let group: HTMLElement = this.body;
    const q = this.query.value.trim(),
      pattern = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu') : null;
    for (const part of this.parts) {
      if (lastSource !== part.source.id) {
        const label = node('p', part.source.label);
        label.className = 'key-document-source';
        group = node('section');
        group.className =
          'key-document-source-group' +
          (part.source.visibility === 'secret' ? ' key-secret-block' : '');
        group.append(label);
        this.body.append(group);
        lastSource = part.source.id;
      }
      const el = part.level
        ? document.createElement('h' + Math.min(6, part.level + 3))
        : node('pre');
      el.className = 'key-document-part';
      el.tabIndex = -1;
      el.dataset.sourceId = part.source.id;
      el.dataset.offset = String(part.start);
      let from = 0,
        m: RegExpExecArray | null;
      pattern && (pattern.lastIndex = 0);
      while (pattern && (m = pattern.exec(part.text))) {
        if (this.matches.length >= 200) {
          truncated = true;
          break;
        }
        el.append(document.createTextNode(part.text.slice(from, m.index)));
        const mark = node('mark', m[0]);
        mark.tabIndex = -1;
        el.append(mark);
        this.matches.push({
          part,
          start: part.start + m.index,
          end: part.start + m.index + m[0].length,
          mark,
        });
        from = m.index + m[0].length;
      }
      el.append(document.createTextNode(part.text.slice(from)));
      group.append(el);
    }
    for (const button of this.navigation) button.disabled = this.matches.length === 0;
    this.moreMatches = truncated;
    this.active = Math.min(this.active, Math.max(0, this.matches.length - 1));
    this.chosen = this.matches[this.active]?.part ?? null;
    this.status.textContent = q
      ? this.matches.length
        ? `${this.active + 1} / ${truncated ? 'mindestens ' : ''}${this.matches.length} Fundstellen`
        : 'Keine Fundstelle im Raumtext.'
      : '';
    if (this.limited)
      this.body.append(
        node(
          'p',
          'Sehr langer Text: Die Abschnittsgliederung ist begrenzt; der vollständige Resttext steht darüber.',
        ),
      );
    this.syncEdit();
  }
  private focusPart(part: KeyDocumentPart, focus = true) {
    const el = [...this.body.querySelectorAll<HTMLElement>('.key-document-part')].find(
      (e) => e.dataset.sourceId === part.source.id && e.dataset.offset === String(part.start),
    );
    if (el) {
      if (focus) el.focus({ preventScroll: true });
      el.scrollIntoView({ block: 'center' });
    }
  }
  private reveal(focus = true) {
    if (!this.alive()) return;
    for (const mark of this.marks) mark.classList.remove('active');
    const match = this.matches[this.active];
    if (match) {
      match.mark.classList.add('active');
      this.marks = [match.mark];
      this.chosen = match.part;
      if (focus) match.mark.focus({ preventScroll: true });
      match.mark.scrollIntoView({ block: 'center' });
      this.status.textContent = `${this.active + 1} / ${this.matches.length}${this.moreMatches ? '+' : ''} Fundstellen`;
    }
    this.syncEdit();
  }
  private move(delta: number, focus = true) {
    if (!this.alive() || !this.matches.length) return;
    this.active =
      this.active < 0
        ? delta > 0
          ? 0
          : this.matches.length - 1
        : (this.active + delta + this.matches.length) % this.matches.length;
    this.reveal(focus);
  }
  private readAt(part: KeyDocumentPart) {
    for (const mark of this.marks) mark.classList.remove('active');
    this.marks = [];
    this.active = -1;
    this.chosen = part;
    this.status.textContent = 'Lesestelle · ' + this.matches.length + ' Fundstellen im Raum';
    this.focusPart(part);
    this.syncEdit();
  }
  bookmark(): KeyBookmark | null {
    return this.chosen
      ? { sourceId: this.chosen.source.id, offset: this.chosen.start, query: this.query.value }
      : null;
  }
  start(bookmark?: KeyBookmark | null) {
    if (!this.alive()) return;
    if (bookmark) {
      this.query.value = bookmark.query;
      this.draw();
      const part = this.parts
        .filter((p) => p.source.id === bookmark.sourceId)
        .sort(
          (a, b) => Math.abs(a.start - bookmark.offset) - Math.abs(b.start - bookmark.offset),
        )[0];
      if (part) {
        const at = this.matches.findIndex((m) => m.part === part);
        if (at < 0) {
          this.readAt(part);
          return;
        }
        this.active = at;
      }
    }
    this.reveal(!!bookmark);
  }
}
