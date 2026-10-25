import type { CombatLossBasis, CombatLossCandidate } from './combat-contracts';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  return el;
};
export class CombatNpcLossesPanel {
  readonly root = node('section');
  private epoch = 0;
  clear() {
    this.epoch++;
    this.root.replaceChildren();
  }
  draw(
    rows: CombatLossCandidate[],
    current: () => boolean,
    confirm: ((losses: CombatLossBasis[], current: () => boolean) => Promise<boolean>) | undefined,
    openNpc: ((id: string, current: () => boolean) => Promise<void>) | undefined,
  ) {
    this.clear();
    if (!rows.length) return;
    const epoch = this.epoch,
      valid = () => epoch === this.epoch && current(),
      selected = new Set<string>(),
      list = node('div'),
      count = node('p'),
      status = node('p'),
      tools = node('div'),
      suggested = node('button', 'NSCs mit 0 HP auswählen'),
      clear = node('button', 'Auswahl leeren'),
      apply = node('button', 'Ausgewählte NSCs als besiegt bestätigen');
    let busy = false;
    this.root.className = 'combat-npc-losses';
    this.root.id = 'combat-npc-losses';
    list.className = 'combat-npc-loss-list';
    status.setAttribute('role', 'status');
    count.id = 'combat-npc-loss-count';
    apply.id = 'combat-npc-loss-confirm';
    suggested.id = 'combat-npc-loss-suggested';
    tools.className = 'toolbar';
    const lock = () => {
      count.textContent = selected.size + ' NSCs ausgewählt';
      for (const el of this.root.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
        'input,button',
      ))
        el.disabled = busy;
      for (const box of list.querySelectorAll<HTMLInputElement>('input'))
        box.disabled = busy || box.dataset.available !== 'true';
      apply.disabled = busy || !confirm || !selected.size;
    };
    const updateChecks = () => {
      for (const box of list.querySelectorAll<HTMLInputElement>('input'))
        box.checked = selected.has(box.value);
      lock();
    };
    for (const r of rows) {
      const article = node('article'),
        label = node('label'),
        box = node('input');
      box.type = 'checkbox';
      box.value = r.actorId;
      box.dataset.available = String(r.status === 'available' && !!r.basis);
      box.checked = false;
      box.onchange = () => {
        if (!valid() || busy || r.status !== 'available') return;
        if (box.checked) selected.add(r.actorId);
        else selected.delete(r.actorId);
        lock();
      };
      label.className = 'check-label';
      label.append(
        box,
        document.createTextNode(
          r.name +
            ' · ' +
            r.combatHp +
            ' HP bei Kampfabschluss · ' +
            {
              available: 'Weltprofil aktiv',
              confirmed: 'Verlust bereits bestätigt',
              defeated: 'Weltprofil bereits besiegt',
              unavailable: 'Weltprofil nicht verfügbar',
            }[r.status],
        ),
      );
      article.append(label);
      if (openNpc && r.status !== 'unavailable') {
        const open = node('button', 'Weltprofil / Reaktivierung…');
        open.type = 'button';
        open.onclick = () => {
          if (!valid() || busy) return;
          void openNpc(r.actorId, valid).catch((e) => {
            if (valid()) status.textContent = e.message;
          });
        };
        article.append(open);
      }
      list.append(article);
    }
    for (const b of [suggested, clear, apply]) b.type = 'button';
    suggested.onclick = () => {
      if (!valid() || busy) return;
      selected.clear();
      for (const r of rows)
        if (r.combatHp === 0 && r.status === 'available' && r.basis) selected.add(r.actorId);
      updateChecks();
    };
    clear.onclick = () => {
      if (!valid() || busy) return;
      selected.clear();
      updateChecks();
    };
    apply.onclick = () => {
      if (!valid() || busy || !confirm || !selected.size) return;
      const losses = rows
        .filter((r) => selected.has(r.actorId))
        .map((r) => structuredClone(r.basis!));
      busy = true;
      lock();
      void confirm(losses, valid)
        .then((ok) => {
          if (valid() && !ok)
            status.textContent =
              'Verluste nicht bestätigt. Kampfstand oder offenen Originalauftrag prüfen.';
        })
        .catch((e) => {
          if (valid()) status.textContent = e.message;
        })
        .finally(() => {
          if (valid()) {
            busy = false;
            lock();
          }
        });
    };
    tools.append(suggested, clear);
    this.root.append(
      node('h4', 'NPC-Verluste für die Welt bestätigen'),
      node(
        'p',
        'Keine automatische Niederlage aus HP oder Kampfende. Nur ausgewählte NSCs werden als besiegt markiert; Texte, Fraktion und HP bleiben erhalten. Reaktivierung erfolgt ausdrücklich im Weltprofil.',
      ),
      list,
      count,
      tools,
      apply,
      status,
    );
    lock();
  }
}
