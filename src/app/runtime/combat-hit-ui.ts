import { adjustedHitDamage } from './damage-adjustment';
import type { CombatAction, CombatState } from './combat-contracts';
import type { CreatureAction } from '../../features/catalog/creature-catalog';
import type { SceneCheck } from './scene-check-contracts';
import {
  creatureActionRolls,
  creatureRollKey,
  criticalDamageFormula,
  parseDiceFormula,
  type CreatureRollPreset,
} from '../shared/dice-formula';
type Hit = Extract<CombatAction, { kind: 'hit' }>;
type Opening = {
  attackerId: string;
  action: CreatureAction;
  targetId?: string;
  check?: SceneCheck;
  legendary?: Hit['legendary'];
  paidLegendary?: boolean;
  applied?: () => void;
};
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
type Part = {
  preset: CreatureRollPreset;
  include: HTMLInputElement;
  amount: HTMLInputElement;
  scale: HTMLSelectElement;
  formula: HTMLElement;
  roll: HTMLButtonElement;
  adjustment: HTMLElement;
  checkId?: string;
  entered?: boolean;
};
/** Damage types belong to one hit; HP, concentration and death follow its total once. */
export class CombatHitPanel {
  private combat: CombatState | null = null;
  private token: string | null = null;
  private blocked = true;
  private draft: {
    combatId: string;
    revision: number;
    opening: Opening;
    parts: Part[];
    busy: boolean;
  } | null = null;
  private title = node('h3');
  private target = node('select');
  private critical = node('input');
  private parts = node('div');
  private summary = node('p');
  private apply = node('button', 'Treffer anwenden');
  private cancel = node('button', 'Abbrechen');
  constructor(
    private root: HTMLElement,
    private execute: (action: CombatAction, revision: number) => Promise<boolean>,
    private roll: (
      action: Opening,
      preset: CreatureRollPreset,
      formula: string,
      critical: boolean,
    ) => Promise<SceneCheck | null>,
  ) {
    root.className = 'combat-hit';
    root.hidden = true;
    this.target.id = 'combat-hit-target';
    this.critical.id = 'combat-hit-critical';
    this.critical.type = 'checkbox';
    this.apply.id = 'combat-hit-apply';
    this.cancel.id = 'combat-hit-cancel';
    this.parts.id = 'combat-hit-parts';
    const label = node('label', 'Ziel');
    label.htmlFor = this.target.id;
    const criticalLabel = node('label');
    criticalLabel.className = 'check-label';
    criticalLabel.append(this.critical, document.createTextNode('Kritischer Treffer'));
    const tools = node('div');
    tools.className = 'toolbar';
    tools.append(label, this.target);
    this.summary.setAttribute('role', 'status');
    this.apply.type = this.cancel.type = 'button';
    root.append(
      this.title,
      tools,
      criticalLabel,
      node(
        'p',
        'Werte vom Tisch eintragen oder würfeln. Die Vorgaben sind Durchschnittswerte. Bei Alternativen nur die verwendeten Anteile auswählen.',
      ),
      this.parts,
      this.summary,
      this.apply,
      this.cancel,
    );
    this.target.onchange = () => this.update();
    this.critical.onchange = () => {
      this.defaults();
      this.update();
    };
    this.cancel.onclick = () => {
      if (!this.draft?.busy && !this.blocked) {
        this.draft = null;
        root.hidden = true;
      }
    };
    this.apply.onclick = () => void this.commit();
  }
  context(combat: CombatState | null, token: string | null, blocked: boolean) {
    if (this.token !== token || this.combat?.id !== combat?.id) {
      this.draft = null;
      this.root.hidden = true;
    }
    this.combat = combat;
    this.token = token;
    this.blocked = blocked;
    this.update();
  }
  open(opening: Opening) {
    if (!this.combat || this.blocked || !['preparing', 'running'].includes(this.combat.phase))
      return;
    if (this.draft) {
      this.root.scrollIntoView({ block: 'nearest' });
      return;
    }
    const combat = this.combat,
      parts: Part[] = [];
    this.draft = { combatId: combat.id, revision: combat.revision, opening, parts, busy: false };
    this.title.textContent =
      (combat.participants.find((p) => p.id === opening.attackerId)?.name ?? 'Angreifer') +
      ' · ' +
      opening.action.name;
    this.target.replaceChildren();
    for (const p of combat.participants.filter((p) => p.id !== opening.attackerId)) {
      const option = node(
        'option',
        p.name +
          ' · ' +
          (p.healthKnown === false
            ? 'HP offen'
            : p.hp + '/' + p.maxHp + ' HP' + (p.tempHp ? ' + ' + p.tempHp + ' temp.' : '')),
      );
      option.value = p.id;
      option.disabled = p.healthKnown === false;
      this.target.append(option);
    }
    const preferred =
      opening.targetId ??
      combat.participants.find((p) => p.characterId && p.healthKnown !== false)?.id;
    const choice =
      [...this.target.querySelectorAll('option')].find(
        (o) => o.value === preferred && !o.disabled,
      ) ?? this.target.querySelector<HTMLOptionElement>('option:not([disabled])');
    if (choice) choice.selected = true;
    this.critical.checked = opening.check?.rolls[0] === 20;
    this.parts.replaceChildren();
    const rolls = creatureActionRolls(opening.action).filter((p) => p.kind === 'damage'),
      additive =
        rolls.length === 1 ||
        (/\bdamage\s+plus\b/i.test(opening.action.description) &&
          !/\bsaving throw\b/i.test(opening.action.description));
    for (const [i, preset] of rolls.entries()) {
      const row = node('div'),
        heading = node('label'),
        include = node('input'),
        amount = node('input'),
        scale = node('select'),
        formula = node('small'),
        roll = node('button', 'Würfeln'),
        adjustment = node('p'),
        tools = node('div');
      include.type = 'checkbox';
      include.checked = additive || i === 0;
      heading.className = 'check-label';
      heading.append(include, document.createTextNode(preset.label));
      amount.type = 'number';
      amount.min = '0';
      amount.max = '1000000';
      amount.step = '1';
      amount.setAttribute('aria-label', preset.label + ' Betrag');
      scale.setAttribute('aria-label', preset.label + ' Anpassung');
      for (const [value, text] of [
        ['auto', 'Statblock'],
        ['full', 'Voll'],
        ['half', 'Halb'],
        ['none', 'Kein Schaden'],
        ['double', 'Doppelt'],
      ]) {
        const option = node('option', text);
        option.value = value!;
        scale.append(option);
      }
      scale.querySelector('option')!.selected = true;
      roll.type = 'button';
      const part: Part = { preset, include, amount, scale, formula, roll, adjustment };
      parts.push(part);
      include.onchange = scale.onchange = () => this.update();
      amount.oninput = () => {
        part.entered = true;
        delete part.checkId;
        this.update();
      };
      roll.onclick = () => void this.rollPart(part);
      tools.className = 'toolbar';
      tools.append(formula, amount, scale, roll);
      row.className = 'combat-hit-part';
      adjustment.className = 'caption';
      row.append(heading, tools, adjustment);
      this.parts.append(row);
    }
    this.defaults();
    this.root.hidden = false;
    this.update();
    this.root.scrollIntoView({ block: 'nearest' });
  }
  private defaults() {
    for (const p of this.draft?.parts ?? []) {
      const dice = parseDiceFormula(p.preset.formula);
      if (!p.entered)
        p.amount.value = String(
          Math.floor(
            ((this.critical.checked ? 2 : 1) * dice.count * (dice.sides + 1)) / 2 + dice.modifier,
          ),
        );
      delete p.checkId;
    }
  }
  private formula(p: Part) {
    try {
      return this.critical.checked ? criticalDamageFormula(p.preset.formula) : p.preset.formula;
    } catch {
      return null;
    }
  }
  private update() {
    const d = this.draft;
    if (!d) return;
    const stale =
        !this.combat ||
        this.combat.revision !== d.revision ||
        !['preparing', 'running'].includes(this.combat.phase),
      disabled = this.blocked || d.busy || stale;
    let total = 0,
      count = 0,
      valid = true;
    const target = this.combat?.participants.find((p) => p.id === this.target.value),
      targetSource = this.combat?.sources?.find((source) => source.id === target?.sourceId);
    this.target.disabled = disabled || !!d.opening.check;
    this.critical.disabled = disabled || !!d.opening.check;
    for (const p of d.parts) {
      const formula = this.formula(p);
      p.formula.textContent = formula ?? 'Betrag manuell eintragen';
      p.include.disabled = disabled;
      p.amount.disabled = p.scale.disabled = disabled || !p.include.checked;
      p.roll.disabled = disabled || !p.include.checked || !formula;
      p.adjustment.hidden = !p.include.checked;
      if (p.include.checked) {
        count++;
        const amount = Number(p.amount.value);
        if (!p.amount.value || !Number.isSafeInteger(amount) || amount < 0 || amount > 1000000)
          valid = false;
        const adjusted = adjustedHitDamage(
          p.preset,
          amount,
          p.scale.value as Hit['components'][number]['scale'],
          targetSource,
        );
        p.adjustment.textContent =
          adjusted.note + (adjusted.amount === null ? '' : ' · ' + adjusted.amount + ' wirksam');
        if (adjusted.amount === null) valid = false;
        else total += adjusted.amount;
      }
    }
    const remaining = Math.max(0, total - (target?.tempHp ?? 0)),
      overflow = Math.max(0, remaining - (target?.hp ?? 0));
    const consequence =
      !target?.characterId || !valid || !total
        ? ''
        : target.death?.dead
          ? ' · Ziel ist bereits tot'
          : remaining > 0 && overflow >= target.maxHp
            ? ' · Sofortiger Tod: ' + overflow + ' Restschaden ≥ ' + target.maxHp + ' maximale HP'
            : target.hp === 0 && remaining > 0
              ? ' · ' +
                (this.critical.checked ? 2 : 1) +
                ' Todesrettungs-Fehlschläge' +
                ((target.death?.stable ? 0 : (target.death?.failures ?? 0)) +
                  (this.critical.checked ? 2 : 1) >=
                3
                  ? ' → Tot'
                  : '')
              : '';
    this.summary.textContent = stale
      ? 'Kampfstand geändert. Abbrechen und den Treffer mit dem aktuellen Stand neu öffnen.'
      : total +
        ' Schaden als ein ' +
        (this.critical.checked ? 'kritischer ' : '') +
        'Treffer' +
        consequence +
        (d.opening.legendary ? ' · ' + d.opening.legendary.cost + ' legendäre Aktionspunkte' : '');
    this.apply.disabled =
      disabled || !count || !valid || !target || target.healthKnown === false || total > 1000000;
    this.cancel.disabled = this.blocked || d.busy;
  }
  private async rollPart(part: Part) {
    const draft = this.draft,
      formula = this.formula(part);
    if (!draft || part.roll.disabled || !formula) return;
    draft.busy = true;
    this.update();
    try {
      const check = await this.roll(draft.opening, part.preset, formula, this.critical.checked);
      if (this.draft === draft && check) {
        part.amount.value = String(check.total);
        part.checkId = check.id;
        part.entered = false;
      }
    } finally {
      if (this.draft === draft) {
        draft.busy = false;
        this.update();
      }
    }
  }
  private async commit() {
    const draft = this.draft;
    if (!draft || this.apply.disabled) return;
    const o = draft.opening,
      action: Hit = {
        kind: 'hit',
        participantId: this.target.value,
        critical: this.critical.checked,
        source: { participantId: o.attackerId, actionId: o.action.id },
        components: draft.parts
          .filter((p) => p.include.checked)
          .map((p) => ({
            key: creatureRollKey(p.preset),
            amount: Number(p.amount.value),
            scale: p.scale.value as Hit['components'][number]['scale'],
            ...(p.checkId ? { sourceCheckId: p.checkId } : {}),
          })),
        ...(o.legendary ? { legendary: o.legendary } : {}),
        ...(o.paidLegendary ? { paidLegendary: true } : {}),
        ...(o.check ? { attackCheckId: o.check.id } : {}),
      };
    draft.busy = true;
    this.update();
    try {
      const ok = await this.execute(action, draft.revision);
      if (this.draft === draft && ok) {
        this.draft = null;
        this.root.hidden = true;
        o.applied?.();
      }
    } finally {
      if (this.draft === draft) {
        draft.busy = false;
        this.update();
      }
    }
  }
}
