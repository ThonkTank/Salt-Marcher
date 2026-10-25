import type { CombatAction, CombatState, Combatant } from './combat-contracts';
import type { Creature, CreatureAction } from '../../features/catalog/creature-catalog';
import { creatureAverageDamage, creatureActionRolls } from '../shared/dice-formula';
import { areaTargetDamage } from './area-damage';
import { damageTypes, isDamageType, type DamageScale, type DamageType } from './damage-adjustment';
type AreaAction = Extract<CombatAction, { kind: 'area-damage' }>;
type Row = {
  actor: Combatant;
  source: Creature | undefined;
  check: HTMLInputElement;
  save: HTMLSelectElement;
  defense: HTMLSelectElement;
  preview: HTMLElement;
};
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
const names: Record<DamageType, string> = {
  acid: 'Säure',
  bludgeoning: 'Wucht',
  cold: 'Kälte',
  fire: 'Feuer',
  force: 'Energie',
  lightning: 'Blitz',
  necrotic: 'Nekrotisch',
  piercing: 'Stich',
  poison: 'Gift',
  psychic: 'Psychisch',
  radiant: 'Gleißend',
  slashing: 'Hieb',
  thunder: 'Schall',
};
/** One typed damage pool, independent saves and defenses, one command and one undo. */
export class CombatAreaPanel {
  private combat: CombatState | null = null;
  private token: string | null = null;
  private blocked = true;
  private busy = false;
  private message: string | null = null;
  private draft: {
    revision: number;
    source?: AreaAction['source'];
    legendary?: AreaAction['legendary'];
    fixedType?: DamageType;
    rows: Row[];
  } | null = null;
  private title = node('h2');
  private amount = node('input');
  private type = node('select');
  private rows = node('div');
  private status = node('p');
  private hint = node('p');
  private apply = node('button', 'Schaden gemeinsam anwenden');
  private cancel = node('button', 'Abbrechen');
  private selection = node('select');
  private unavailable = node('p');
  private overrides = node('input');
  private overrideLabel = node('label');
  private defenseHeading = node('span', 'Abwehr');
  constructor(
    private root: HTMLElement,
    private execute: (action: CombatAction, revision: number) => Promise<boolean>,
  ) {
    root.className = 'combat-area';
    root.hidden = true;
    this.amount.type = 'number';
    this.amount.min = '1';
    this.amount.max = '1000000';
    this.amount.step = '1';
    this.amount.id = 'combat-area-amount';
    this.type.id = 'combat-area-type';
    for (const [value, text] of [
      ['', 'Schadensart wählen…'],
      ...damageTypes.map((t) => [t, names[t] + ' (' + t + ')']),
      ['manual', 'Schon berechneter Schaden'],
    ]) {
      const o = node('option', text);
      o.value = value!;
      this.type.append(o);
    }
    const amountLabel = node('label', 'Gemeinsamer Schaden');
    amountLabel.htmlFor = this.amount.id;
    const typeLabel = node('label', 'Schadensart');
    typeLabel.htmlFor = this.type.id;
    const tools = node('div');
    tools.className = 'combat-area-tools';
    const amountField = node('div'),
      typeField = node('div');
    amountField.append(amountLabel, this.amount);
    typeField.append(typeLabel, this.type);
    this.selection.id = 'combat-area-selection';
    this.selection.setAttribute('aria-label', 'Zielgruppe auswählen');
    tools.append(amountField, typeField, this.selection);
    const headings = node('div');
    headings.className = 'combat-area-row combat-area-head';
    headings.append(
      node('span', 'Ziel'),
      node('span', 'Rettungswurf / Anteil'),
      this.defenseHeading,
    );
    this.status.setAttribute('role', 'status');
    this.hint.className = 'caption';
    this.apply.id = 'combat-area-apply';
    this.cancel.id = 'combat-area-cancel';
    this.rows.id = 'combat-area-targets';
    this.apply.type = this.cancel.type = 'button';
    this.unavailable.className = 'caption';
    this.unavailable.id = 'combat-area-unavailable';
    this.overrides.type = 'checkbox';
    this.overrides.id = 'combat-area-overrides';
    this.overrideLabel.className = 'check-label';
    this.overrideLabel.append(this.overrides, node('span', 'Abwehr manuell anpassen'));
    const footer = node('div'),
      actions = node('div');
    footer.className = 'combat-area-footer';
    actions.className = 'toolbar';
    actions.append(this.apply, this.cancel);
    footer.append(this.status, actions);
    root.append(
      this.title,
      tools,
      this.hint,
      this.unavailable,
      this.overrideLabel,
      headings,
      this.rows,
      footer,
    );
    this.cancel.onclick = () => {
      if (!this.busy) this.close();
    };
    root.addEventListener('cancel', (e) => {
      e.preventDefault();
      if (!this.busy) this.close();
    });
    this.amount.oninput = () => this.update();
    this.type.onchange = () => {
      this.overrides.checked = false;
      for (const row of this.draft?.rows ?? [])
        row.defense.value = this.type.value === 'manual' ? 'full' : 'auto';
      this.update();
    };
    this.overrides.onchange = () => {
      if (!this.overrides.checked)
        for (const row of this.draft?.rows ?? [])
          row.defense.value = this.type.value === 'manual' ? 'full' : 'auto';
      this.update();
    };
    this.selection.onchange = () => {
      if (this.selection.disabled || !this.draft) return;
      const choice = this.selection.value;
      if (!choice) return;
      for (const row of this.draft.rows)
        row.check.checked =
          choice === 'all' ||
          (choice === 'party' && !!row.actor.characterId) ||
          (!row.actor.characterId && choice === 'group:' + row.actor.groupId);
      this.update();
    };
    this.apply.onclick = () => void this.commit();
  }
  private close() {
    this.draft = null;
    this.message = null;
    this.root.hidden = true;
    const dialog = this.root as HTMLDialogElement;
    if (this.root.tagName === 'DIALOG' && typeof dialog.close === 'function') dialog.close();
    else this.root.removeAttribute('open');
  }
  context(combat: CombatState | null, token: string | null, blocked: boolean) {
    if (this.token !== token || this.combat?.id !== combat?.id) {
      this.close();
      this.busy = false;
    }
    this.combat = combat;
    this.token = token;
    this.blocked = blocked;
    this.update();
  }
  open(action?: {
    participantId: string;
    action: CreatureAction;
    legendary?: AreaAction['legendary'];
  }) {
    const combat = this.combat;
    if (!combat || this.blocked || !['running', 'preparing'].includes(combat.phase)) return;
    if (this.draft) {
      this.root.focus();
      return;
    }
    const rolls = action ? creatureActionRolls(action.action) : [],
      dc = rolls.find((p) => p.kind === 'save')?.dc ?? null,
      parts = rolls.filter((p) => p.kind === 'damage'),
      known = [...new Set(parts.map((p) => p.damageType))],
      fixedType = known.length === 1 && isDamageType(known[0]) ? known[0] : undefined;
    this.draft = {
      revision: combat.revision,
      fixedType,
      rows: [],
      ...(action
        ? {
            source: { participantId: action.participantId, actionId: action.action.id },
            legendary: action.legendary,
          }
        : {}),
    };
    this.title.textContent = action
      ? combat.participants.find((p) => p.id === action.participantId)?.name +
        ' · ' +
        action.action.name +
        (dc ? ' · SG ' + dc : ' · bestätigter Treffer')
      : 'Flächenschaden';
    this.amount.value = String(
      action && (parts.length <= 1 || fixedType)
        ? (creatureAverageDamage(action.action) ?? '')
        : '',
    );
    this.type.value = fixedType ?? '';
    this.hint.textContent =
      parts.length > 1 && !fixedType
        ? 'Mehrere Schadensarten: Betrag und Schadensart für diesen Anteil eintragen. Weitere Anteile getrennt anwenden.'
        : 'Spieler würfeln am Tisch. Ihr Ergebnis und die Abwehr werden getrennt berücksichtigt: erst der Rettungswurf, dann Resistenz oder Verwundbarkeit.';
    this.rows.replaceChildren();
    this.overrides.checked = false;
    const unknown = combat.participants.filter((p) => p.healthKnown === false);
    this.unavailable.hidden = !unknown.length;
    this.unavailable.textContent = unknown.length
      ? 'HP offen – nicht als Schadensziel auswählbar: ' +
        unknown.map((p) => p.name).join(', ') +
        '.'
      : '';
    // Bind the reviewed health and source; a new revision requires reopening.
    const sources = new Map<string, Creature>();
    combat.sources?.forEach((source) => {
      if (!sources.has(source.id)) sources.set(source.id, source);
    });
    for (const p of combat.participants) {
      if (p.healthKnown === false) continue;
      const row = node('div'),
        label = node('label'),
        check = node('input'),
        save = node('select'),
        defense = node('select'),
        preview = node('small');
      row.className = 'combat-area-row';
      preview.className = 'combat-area-preview';
      check.type = 'checkbox';
      check.value = p.id;
      check.setAttribute('aria-label', 'Ziel ' + p.name);
      label.className = 'check-label';
      const identity = node('span');
      identity.append(node('span', p.name + ' · ' + p.hp + '/' + p.maxHp + ' HP'), preview);
      label.append(check, identity);
      save.dataset.role = 'save';
      save.setAttribute('aria-label', 'Rettungswurf für ' + p.name);
      defense.dataset.role = 'defense';
      defense.setAttribute('aria-label', 'Abwehr für ' + p.name);
      for (const [value, text] of [
        ['full', dc ? 'Fehlgeschlagen · voll' : 'Voll'],
        ['half', dc ? 'Bestanden · halb' : 'Halb (bestanden)'],
        ['none', 'Kein Schaden'],
      ]) {
        const o = node('option', text);
        o.value = value!;
        save.append(o);
      }
      for (const [value, text] of [
        ['auto', 'Statblock'],
        ['full', 'Voll (manuell)'],
        ['half', 'Resistenz · halb'],
        ['double', 'Verwundbar · doppelt'],
        ['none', 'Immun · kein Schaden'],
      ]) {
        const o = node('option', text);
        o.value = value!;
        defense.append(o);
      }
      check.onchange = () => {
        this.selection.value = '';
        this.update();
      };
      save.onchange = defense.onchange = () => this.update();
      row.append(label, save, defense);
      this.rows.append(row);
      this.draft.rows.push({
        actor: p,
        source: sources.get(p.sourceId ?? ''),
        check,
        save,
        defense,
        preview,
      });
    }
    this.selection.replaceChildren();
    const option = (value: string, text: string) => {
      const o = node('option', text);
      o.value = value;
      this.selection.append(o);
    };
    option('', 'Ziele auswählen…');
    if (this.draft.rows.some((row) => row.actor.characterId)) option('party', 'Party auswählen');
    const groups = new Map<string, Row[]>();
    for (const row of this.draft.rows) {
      if (row.actor.characterId) continue;
      const group = groups.get(row.actor.groupId) ?? [];
      group.push(row);
      groups.set(row.actor.groupId, group);
    }
    const choices = [...groups]
      .filter(([, group]) => group.length > 1)
      .map(([id, group]) => ({
        id,
        group,
        title:
          group[0]!.actor.groupName?.trim() ||
          group[0]!.source?.name ||
          group.map((row) => row.actor.name).join(', '),
      }));
    for (const { id, group, title } of choices) {
      const distinguish = choices.some((other) => other.id !== id && other.title === title)
        ? ' (' + group[0]!.actor.name + ' … ' + group.at(-1)!.actor.name + ')'
        : '';
      option('group:' + id, title + ' · ' + group.length + ' Ziele' + distinguish);
    }
    option('all', 'Alle Teilnehmer auswählen');
    option('none', 'Auswahl aufheben');
    this.selection.value = '';
    this.root.hidden = false;
    this.update();
    const dialog = this.root as HTMLDialogElement;
    if (this.root.tagName === 'DIALOG') {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else this.root.setAttribute('open', '');
    } else this.root.scrollIntoView({ block: 'nearest' });
    this.amount.focus();
    this.amount.select?.();
  }
  private update() {
    const draft = this.draft;
    if (!draft) return;
    const stale =
        this.combat?.revision !== draft.revision ||
        !this.combat ||
        !['preparing', 'running'].includes(this.combat.phase),
      disabled = this.blocked || this.busy || stale,
      amount = Number(this.amount.value),
      manual = this.type.value === 'manual',
      type = isDamageType(this.type.value) ? this.type.value : undefined;
    let count = 0,
      valid = manual || !!type,
      total = 0;
    for (const row of draft.rows) {
      const { actor, source, check, save, defense, preview } = row;
      check.disabled = disabled || actor.healthKnown === false;
      save.disabled = disabled || !check.checked;
      defense.disabled = disabled || !check.checked || manual;
      save.hidden = !check.checked;
      defense.hidden = !check.checked || !this.overrides.checked || manual;
      preview.hidden = !check.checked;
      preview.textContent = '';
      if (!check.checked) continue;
      count++;
      if (
        !this.amount.value ||
        !Number.isSafeInteger(amount) ||
        amount < 1 ||
        amount > 1000000 ||
        actor.healthKnown === false
      ) {
        valid = false;
        continue;
      }
      if (!type && !manual) {
        preview.textContent = 'Schadensart wählen, damit die Zielabwehr berücksichtigt wird.';
        continue;
      }
      const result = areaTargetDamage(
        source,
        amount,
        save.value as 'full' | 'half' | 'none',
        type,
        manual ? 'full' : (defense.value as DamageScale),
      );
      if (result.amount === null) {
        valid = false;
        preview.textContent = result.note;
        continue;
      }
      total += result.amount;
      const hp = Math.max(0, actor.hp - Math.max(0, result.amount - actor.tempHp)),
        temp = Math.max(0, actor.tempHp - result.amount);
      preview.textContent =
        (save.value === 'half' ? 'Rettungswurf: ' + result.afterSave + ' · ' : '') +
        (manual ? 'Abwehr bereits eingerechnet' : result.note) +
        ' · ' +
        result.amount +
        ' Schaden → ' +
        hp +
        '/' +
        actor.maxHp +
        ' HP' +
        (temp ? ' + ' + temp + ' temp.' : '');
    }
    this.amount.disabled = this.selection.disabled = disabled;
    this.type.disabled = disabled || !!draft.fixedType;
    this.cancel.disabled = this.busy;
    this.cancel.textContent = this.message ? 'Schließen und Status prüfen' : 'Abbrechen';
    this.overrides.disabled = disabled || !count;
    this.overrideLabel.hidden = manual;
    this.overrideLabel.style.visibility = count ? 'visible' : 'hidden';
    this.defenseHeading.hidden = manual || !this.overrides.checked;
    this.root.classList.toggle('show-defenses', !manual && this.overrides.checked);
    this.apply.disabled =
      disabled ||
      !count ||
      !valid ||
      !this.amount.value ||
      !Number.isSafeInteger(amount) ||
      amount < 1 ||
      amount > 1000000;
    this.status.textContent = stale
      ? 'Kampfstand geändert. Abbrechen und die Aktion mit dem aktuellen Stand neu öffnen.'
      : (this.message ??
        count +
          ' Ziele · ' +
          (valid ? total + ' wirksamer Schaden gesamt · ' : '') +
          'eine Bestätigung, eine Rücknahme. Temporäre HP und Konzentration werden berücksichtigt.');
  }
  private async commit() {
    const draft = this.draft;
    if (!draft || this.apply.disabled) return;
    const type = isDamageType(this.type.value) ? this.type.value : undefined;
    const targets = draft.rows
      .filter((row) => row.check.checked)
      .map((row) => ({
        participantId: row.actor.id,
        scale: row.save.value as 'full' | 'half' | 'none',
        defense:
          this.type.value === 'manual' ? ('full' as const) : (row.defense.value as DamageScale),
      }));
    this.message = null;
    this.busy = true;
    this.update();
    const unconfirmed = () => {
      if (this.draft === draft)
        this.message =
          'Keine Bestätigung erhalten. Eingaben bleiben erhalten. Dialog schließen und Buchungsstatus sowie Kampfstand prüfen, bevor du erneut Schaden anwendest.';
    };
    try {
      const ok = await this.execute(
        {
          kind: 'area-damage',
          amount: Number(this.amount.value),
          targets,
          ...(type ? { damageType: type } : {}),
          ...(draft.source ? { source: draft.source } : {}),
          ...(draft.legendary ? { legendary: draft.legendary } : {}),
        },
        draft.revision,
      );
      if (this.draft === draft && ok) {
        this.close();
        this.busy = false;
      } else if (!ok) unconfirmed();
    } catch {
      unconfirmed();
    } finally {
      if (this.draft === draft) {
        this.busy = false;
        this.update();
      }
    }
  }
}
