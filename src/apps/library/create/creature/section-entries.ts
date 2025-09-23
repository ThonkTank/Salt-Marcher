// src/apps/library/create/creature/section-entries.ts
import { enhanceSelectToSearch } from "../../../../ui/search-dropdown";
import type { StatblockData } from "../../core/creature-files";
import { abilityMod, formatSigned, parseIntSafe } from "../shared/stat-utils";

export function mountEntriesSection(parent: HTMLElement, data: StatblockData) {
  if (!data.entries) data.entries = [] as any;

  const wrap = parent.createDiv({ cls: "setting-item sm-cc-entries" });
  wrap.createDiv({ cls: "setting-item-info", text: "Einträge (Traits, Aktionen, …)" });
  const ctl = wrap.createDiv({ cls: "setting-item-control" });

  const addBar = ctl.createDiv({ cls: "sm-cc-searchbar" });
  const catSel = addBar.createEl("select") as HTMLSelectElement;
  const catMap = [["trait","Eigenschaft"],["action","Aktion"],["bonus","Bonusaktion"],["reaction","Reaktion"],["legendary","Legendäre Aktion"]] as const;
  for (const [v,l] of catMap) { const o = catSel.createEl("option", { text: l }); (o as HTMLOptionElement).value = v; }
  try { enhanceSelectToSearch(catSel, 'Such-dropdown…'); } catch {}
  const addEntryBtn = addBar.createEl("button", { text: "+ Eintrag" });

  const host = ctl.createDiv();
  let focusIdx: number | null = null;

  const render = () => {
    host.empty();
    (data.entries as any[]).forEach((e, i) => {
      const box = host.createDiv({ cls: "sm-cc-skill-group" });
      const head = box.createDiv({ cls: "sm-cc-skill sm-cc-entry-head" });
      const c = head.createEl("select") as HTMLSelectElement;
      for (const [v,l] of catMap) { const o=c.createEl("option",{ text:l }); (o as HTMLOptionElement).value=v; if (v===e.category) (o as HTMLOptionElement).selected=true; }
      c.onchange = () => e.category = c.value as any;
      try { enhanceSelectToSearch(c, 'Such-dropdown…'); } catch {}

      head.createEl('label', { text: 'Name' });
      const name = head.createEl("input", { cls: "sm-cc-entry-name", attr: { type: "text", placeholder: "Name (z. B. Multiattack)", 'aria-label': 'Name' } }) as HTMLInputElement;
      name.value = e.name || ""; name.oninput = () => e.name = name.value.trim();
      (name.style as any).width = '26ch';
      if (focusIdx === i) { setTimeout(() => name.focus(), 0); focusIdx = null; }
      const del = head.createEl("button", { text: "🗑" });
      del.onclick = () => { (data.entries as any[]).splice(i,1); render(); };

      const grid = box.createDiv({ cls: "sm-cc-grid sm-cc-entry-grid" });
      grid.createEl('label', { text: 'Art' });
      const kind = grid.createEl("input", { attr: { type: "text", placeholder: "Melee/Ranged …", 'aria-label': 'Art' } }) as HTMLInputElement;
      kind.value = e.kind || ""; kind.oninput = () => e.kind = kind.value.trim() || undefined; (kind.style as any).width = '24ch';
      grid.createEl('label', { text: 'Reichweite' });
      const rng = grid.createEl("input", { attr: { type: "text", placeholder: "reach 5 ft. / range 30 ft.", 'aria-label': 'Reichweite' } }) as HTMLInputElement;
      rng.value = e.range || ""; rng.oninput = () => e.range = rng.value.trim() || undefined; (rng.style as any).width = '30ch';
      grid.createEl('label', { text: 'Ziel' });
      const tgt = grid.createEl("input", { attr: { type: "text", placeholder: "one target", 'aria-label': 'Ziel' } }) as HTMLInputElement;
      tgt.value = e.target || ""; tgt.oninput = () => e.target = tgt.value.trim() || undefined; (tgt.style as any).width = '16ch';

      // Auto-compute helpers
      const autoRow = box.createDiv({ cls: "sm-cc-auto" });
      const hitGroup = autoRow.createDiv({ cls: 'sm-auto-group' });
      hitGroup.createSpan({ text: 'To hit:' });
      const toHitAbil = hitGroup.createEl('select') as HTMLSelectElement;
      ['','best_of_str_dex','str','dex','con','int','wis','cha'].forEach(v=>{ const o=toHitAbil.createEl('option',{ text: v||'(von)' }); (o as HTMLOptionElement).value=v; });
      try { enhanceSelectToSearch(toHitAbil, 'Such-dropdown…'); } catch {}
      const toHitProf = hitGroup.createEl('input', { attr: { type: 'checkbox', id: `hit-prof-${i}` } }) as HTMLInputElement;
      hitGroup.createEl('label', { text: 'Prof', attr: { for: `hit-prof-${i}` } });
      const hit = hitGroup.createEl('input', { cls: 'sm-auto-tohit', attr: { type: 'text', placeholder: '+7', 'aria-label': 'To hit' } }) as HTMLInputElement; (hit.style as any).width = '6ch';
      hit.value = e.to_hit || ''; hit.addEventListener('input', () => e.to_hit = hit.value.trim() || undefined);

      const dmgGroup = autoRow.createDiv({ cls: 'sm-auto-group' });
      dmgGroup.createSpan({ text: 'Damage:' });
      const dmgDice = dmgGroup.createEl('input', { attr: { type: 'text', placeholder: '1d8', 'aria-label': 'Würfel' } }) as HTMLInputElement; (dmgDice.style as any).width = '10ch';
      const dmgAbil = dmgGroup.createEl('select') as HTMLSelectElement; ['','best_of_str_dex','str','dex','con','int','wis','cha'].forEach(v=>{ const o=dmgAbil.createEl('option',{ text: v||'(von)' }); (o as HTMLOptionElement).value=v; });
      try { enhanceSelectToSearch(dmgAbil, 'Such-dropdown…'); } catch {}
      const dmgBonus = dmgGroup.createEl('input', { attr: { type: 'text', placeholder: 'piercing / slashing …', 'aria-label': 'Art' } }) as HTMLInputElement; (dmgBonus.style as any).width = '12ch';
      const dmg = dmgGroup.createEl('input', { cls: 'sm-auto-dmg', attr: { type: 'text', placeholder: '1d8 +3 piercing', 'aria-label': 'Schaden' } }) as HTMLInputElement; (dmg.style as any).width = '20ch';
      dmg.value = e.damage || ''; dmg.addEventListener('input', () => e.damage = dmg.value.trim() || undefined);

      const applyAuto = () => {
        const pb = parseIntSafe(data.pb as any) || 0;
        if (e.to_hit_from) {
          const abil = e.to_hit_from.ability as any;
          const abilMod = abil === 'best_of_str_dex' ? Math.max(abilityMod(data.str as any), abilityMod(data.dex as any)) : abilityMod((data as any)[abil]);
          const total = abilMod + (e.to_hit_from.proficient ? pb : 0);
          e.to_hit = formatSigned(total); hit.value = e.to_hit;
        }
        if (e.damage_from) {
          const abil = e.damage_from.ability as any;
          const abilMod = abil ? (abil === 'best_of_str_dex' ? Math.max(abilityMod(data.str as any), abilityMod(data.dex as any)) : abilityMod((data as any)[abil])) : 0;
          const base = e.damage_from.dice;
          const tail = (abilMod ? ` ${formatSigned(abilMod)}` : '') + (e.damage_from.bonus ? ` ${e.damage_from.bonus}` : '');
          e.damage = `${base}${tail}`.trim(); dmg.value = e.damage;
        }
      };
      if (e.to_hit_from) { toHitAbil.value = e.to_hit_from.ability as any; toHitProf.checked = !!e.to_hit_from.proficient; }
      if (e.damage_from) { dmgDice.value = e.damage_from.dice; dmgAbil.value = (e.damage_from.ability as any) || ''; dmgBonus.value = e.damage_from.bonus || ''; }
      toHitAbil.onchange = () => { e.to_hit_from = { ability: toHitAbil.value as any, proficient: toHitProf.checked }; applyAuto(); };
      toHitProf.onchange = () => { e.to_hit_from = { ability: toHitAbil.value as any, proficient: toHitProf.checked }; applyAuto(); };
      dmgDice.oninput = () => { e.damage_from = { dice: dmgDice.value.trim(), ability: (dmgAbil.value as any) || undefined, bonus: dmgBonus.value.trim() || undefined }; applyAuto(); };
      dmgAbil.onchange = () => { e.damage_from = { dice: dmgDice.value.trim(), ability: (dmgAbil.value as any) || undefined, bonus: dmgBonus.value.trim() || undefined }; applyAuto(); };
      dmgBonus.oninput = () => { e.damage_from = { dice: dmgDice.value.trim(), ability: (dmgAbil.value as any) || undefined, bonus: dmgBonus.value.trim() || undefined }; applyAuto(); };

      const misc = box.createDiv({ cls: "sm-cc-grid sm-cc-entry-grid" });
      misc.createEl('label', { text: 'Save' });
      const saveAb = misc.createEl("select") as HTMLSelectElement; ["","STR","DEX","CON","INT","WIS","CHA"].forEach(x=>{ const o=saveAb.createEl("option", { text: x||"(kein)" }); (o as HTMLOptionElement).value=x; if (x===(e.save_ability||"")) (o as HTMLOptionElement).selected=true; }); saveAb.onchange = () => e.save_ability = saveAb.value || undefined;
      misc.createEl('label', { text: 'DC' });
      const saveDc = misc.createEl("input", { attr: { type: "number", placeholder: "DC", 'aria-label': 'DC' } }) as HTMLInputElement; saveDc.value = e.save_dc ? String(e.save_dc) : ""; saveDc.oninput = () => e.save_dc = saveDc.value ? parseInt(saveDc.value,10) : undefined as any; (saveDc.style as any).width = '4ch';
      misc.createEl('label', { text: 'Save-Effekt' });
      const saveFx = misc.createEl("input", { attr: { type: "text", placeholder: "half on save …", 'aria-label': 'Save-Effekt' } }) as HTMLInputElement; saveFx.value = e.save_effect || ""; saveFx.oninput = () => e.save_effect = saveFx.value.trim() || undefined; (saveFx.style as any).width = '18ch';
      misc.createEl('label', { text: 'Recharge' });
      const rech = misc.createEl("input", { attr: { type: "text", placeholder: "Recharge 5–6 / 1/day" } }) as HTMLInputElement; rech.value = e.recharge || ""; rech.oninput = () => e.recharge = rech.value.trim() || undefined;
      box.createEl('label', { text: 'Details' });
      const ta = box.createEl("textarea", { cls: "sm-cc-entry-text", attr: { placeholder: "Details (Markdown)" } }); ta.value = e.text || ""; ta.addEventListener("input", () => e.text = (ta as HTMLTextAreaElement).value);
    });
  };

  addEntryBtn.onclick = () => { (data.entries as any[]).unshift({ category: catSel.value as any, name: "" }); focusIdx = 0; render(); };
  render();
}

