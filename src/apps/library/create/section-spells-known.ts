// src/apps/library/create/section-spells-known.ts
import type { StatblockData } from "../core/creature-files";

export function mountSpellsKnownSection(
  parent: HTMLElement,
  data: StatblockData,
  getAvailableSpells: () => readonly string[] | null | undefined,
) {
  if (!data.spellsKnown) (data as any).spellsKnown = [] as any[];
  const wrap = parent.createDiv({ cls: "setting-item sm-cc-spells" });
  wrap.createDiv({ cls: "setting-item-info", text: "Bekannte Zauber" });
  const ctl = wrap.createDiv({ cls: "setting-item-control" });

  const row1 = ctl.createDiv({ cls: "sm-cc-searchbar" });
  row1.createEl('label', { text: 'Zauber' });
  const spellBox = row1.createDiv({ cls: 'sm-preset-box', attr: { style: 'flex:1 1 auto; min-width: 180px;' } });
  const spellInput = spellBox.createEl('input', { cls: 'sm-preset-input', attr: { type: 'text', placeholder: 'Zauber suchen…' } }) as HTMLInputElement;
  const spellMenu = spellBox.createDiv({ cls: 'sm-preset-menu' });

  let chosenSpell = "";
  const renderSpellMenu = () => {
    const q = (spellInput.value || '').toLowerCase();
    spellMenu.empty();
    const matches = (getAvailableSpells()?.slice() || [])
      .filter(n => !q || n.toLowerCase().includes(q))
      .slice(0, 24);
    if (matches.length === 0) { spellBox.removeClass('is-open'); return; }
    for (const name of matches) {
      const it = spellMenu.createDiv({ cls: 'sm-preset-item', text: name });
      it.onclick = () => { chosenSpell = name; spellInput.value = name; spellBox.removeClass('is-open'); };
    }
    spellBox.addClass('is-open');
  };
  spellInput.addEventListener('focus', renderSpellMenu);
  spellInput.addEventListener('input', renderSpellMenu);
  spellInput.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { spellInput.value=''; chosenSpell=''; spellBox.removeClass('is-open'); } });
  spellInput.addEventListener('blur', () => { setTimeout(() => spellBox.removeClass('is-open'), 120); });

  row1.createEl('label', { text: 'Grad' });
  const lvl = row1.createEl("input", { attr: { type: "number", min: "0", max: "9", placeholder: "Grad", 'aria-label': 'Grad' } }) as HTMLInputElement; (lvl.style as any).width = '4ch';

  const row2 = ctl.createDiv({ cls: "sm-cc-searchbar" });
  row2.createEl('label', { text: 'Nutzung' });
  const uses = row2.createEl("input", { attr: { type: "text", placeholder: "at will / 3/day / slots", 'aria-label': 'Nutzung' } }) as HTMLInputElement; (uses.style as any).width = '14ch';
  row2.createEl('label', { text: 'Notizen' });
  const notes = row2.createEl("input", { attr: { type: "text", placeholder: "Notizen", 'aria-label': 'Notizen' } }) as HTMLInputElement; (notes.style as any).width = '16ch';
  const addSpell = row2.createEl("button", { text: "+ Hinzufügen" });
  addSpell.onclick = () => {
    let name = chosenSpell?.trim(); if (!name) name = (spellInput.value || '').trim(); if (!name) return;
    (data.spellsKnown as any[]).push({ name, level: lvl.value ? parseInt(lvl.value,10) : undefined, uses: uses.value.trim() || undefined, notes: notes.value.trim() || undefined });
    spellInput.value = ''; chosenSpell = ''; lvl.value = uses.value = notes.value = ""; renderList();
  };

  const list = ctl.createDiv({ cls: "sm-cc-list" });
  const renderList = () => {
    list.empty();
    (data.spellsKnown as any[]).forEach((s, i) => {
      const item = list.createDiv({ cls: "sm-cc-item" });
      item.createDiv({ cls: "sm-cc-item__name", text: `${s.name}${s.level!=null?` (Lvl ${s.level})`:''}${s.uses?` – ${s.uses}`:''}` });
      const rm = item.createEl("button", { text: "×" });
      rm.onclick = () => { (data.spellsKnown as any[]).splice(i,1); renderList(); };
    });
  };
  renderList();

  const refreshSpellMatches = () => {
    if (document.activeElement === spellInput || spellBox.hasClass('is-open')) {
      renderSpellMenu();
    }
  };

  return { refreshSpellMatches };
}

