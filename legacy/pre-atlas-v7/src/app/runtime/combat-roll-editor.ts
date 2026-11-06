import type { CombatAction, CombatView } from './combat-contracts';
import type { SceneCheck } from './scene-check-contracts';
import type { CreatureAction } from '../../features/catalog/creature-catalog';
import {
  creatureActionForRolls,
  creatureActionRolls,
  creatureRollKey,
  type CreatureRollPreset,
} from '../shared/dice-formula';
import {
  editableCombat,
  enqueuePendingDamage,
  retainPendingAttack,
  pendingRollStillValid,
  type PendingDamage,
} from './combat-roll-state';
import type { CombatHitPanel } from './combat-hit-ui';
import type { EditorSession } from '../shared/editor-session';
import type { rollSceneFormula, rollSceneCheck } from '../catalog/rule-reference-ui';

type RollPorts = {
  document: Document;
  get<T extends HTMLElement = HTMLElement>(id: string): T;
  session: EditorSession;
  readonly combat: CombatView['combat'] | null;
  blocked(): boolean;
  uncertain(): boolean;
  execute(action: CombatAction): Promise<boolean>;
  openHit(input: Parameters<CombatHitPanel['open']>[0]): void;
  formula: typeof rollSceneFormula;
  check: typeof rollSceneCheck;
  feedback(text: string, error?: boolean): void;
};

/** Transient roll handoffs have one owner. CombatDraftCache retains authored
 * values; canonical rolls, damage and legendary costs are accepted by the writer. */
export function createCombatRollEditor(ports: RollPorts) {
  const { document, get, session } = ports;
  const value = (id: string) => get<HTMLInputElement>(id).value;
  const blocked = () => ports.blocked();
  const execute = (action: CombatAction) => ports.execute(action);
  const tell = (text: string, error?: boolean) => ports.feedback(text, error);
  const rollSceneFormula = ports.formula,
    rollSceneCheck = ports.check;
  type PendingLegendary = { participantId: string; actionId: string; cost: number };

  let pendingDamage: PendingDamage[] = [];
  type PendingAttack = {
    combatId: string;
    attackerId: string;
    creatureId: string;
    actionId: string;
    actor: string;
    preset: CreatureRollPreset;
    damages: CreatureRollPreset[];
    rolledDamage: string[];
    targetId: string | null;
    check: SceneCheck | null;
    legendary?: PendingLegendary;
    paidLegendary?: boolean;
  };

  let pendingAttack: PendingAttack | null = null,
    attackPending = false;
  type PendingSave = {
    combatId: string;
    attackerId: string;
    creatureId: string;
    actionId: string;
    actor: string;
    preset: CreatureRollPreset;
    damages: CreatureRollPreset[];
    rolledDamage: string[];
    resolvedTargets: string[];
    targetId: string | null;
    check: SceneCheck | null;
    legendary?: PendingLegendary;
  };
  let pendingSave: PendingSave | null = null,
    savePending = false;

  let application: {
    checkId: string;
    combatId: string;
    targetId: string;
    keep: boolean;
    generation: number;
  } | null = null;
  function stageAttack(
    action: CreatureAction,
    preset: CreatureRollPreset,
    attackerId: string,
    actor: string,
    creatureId: string,
    combatId: string,
    legendary?: PendingLegendary,
  ) {
    if (attackPending || ports.combat?.id !== combatId) return;
    const next: PendingAttack = {
        combatId,
        attackerId,
        creatureId,
        actionId: action.id,
        actor,
        preset,
        damages: creatureActionRolls(action).filter((p) => p.kind === 'damage'),
        rolledDamage: [],
        targetId: null,
        check: null,
        ...(legendary ? { legendary } : {}),
      },
      retained = retainPendingAttack(pendingAttack, next);
    if (retained === pendingAttack) {
      renderAttackEffect();
      get('combat-attack-effect').scrollIntoView({ block: 'nearest' });
      tell(
        pendingAttack.check
          ? 'Offenen Angriff zuerst abschließen.'
          : 'Offenen Angriff zuerst würfeln oder verwerfen.',
        true,
      );
      return;
    }
    pendingAttack = retained;
    renderAttackEffect();
    get('combat-attack-effect').scrollIntoView({ block: 'nearest' });
  }
  function renderAttackEffect() {
    const box = get('combat-attack-effect'),
      combat = ports.combat,
      attack = pendingAttack;
    if (!attack || !combat || attack.combatId !== combat.id || !editableCombat(combat)) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const target = get<HTMLSelectElement>('combat-attack-target'),
      previous = target.value,
      candidates = combat.participants.filter((p) => p.id !== attack.attackerId);
    target.replaceChildren();
    for (const p of candidates) {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = p.name + ' · RK ' + (p.armorClass ?? 'offen');
      target.append(option);
    }
    const preferred =
      attack.targetId ??
      (candidates.some((p) => p.id === previous) ? previous : null) ??
      candidates.find((p) => !!p.characterId)?.id ??
      candidates[0]?.id ??
      '';
    target.value = preferred;
    const chosen = candidates.find((p) => p.id === target.value),
      resolvedTarget = attack.targetId
        ? candidates.find((p) => p.id === attack.targetId)
        : undefined,
      die = attack.check?.rolls[0],
      critical = die === 20,
      miss = attack.check?.outcome === 'failure';
    get('combat-attack-result').textContent = attack.check
      ? attack.actor +
        ' · ' +
        attack.preset.label +
        ': ' +
        attack.check.total +
        ' gegen RK ' +
        attack.check.dc +
        ' · ' +
        (critical ? 'Kritischer Treffer' : miss ? 'Verfehlt' : 'Treffer') +
        (resolvedTarget ? '' : ' · Ziel nicht mehr in der Initiative')
      : attack.actor +
        ' · ' +
        attack.preset.label +
        ' gegen ' +
        (chosen?.name ?? 'Ziel') +
        ' (RK ' +
        (chosen ? (chosen.armorClass ?? 'offen') : '—') +
        ')';
    target.disabled = blocked() || attackPending || !!attack.check;
    const roll = get<HTMLButtonElement>('combat-attack-roll');
    roll.hidden = !!attack.check;
    roll.disabled = blocked() || attackPending || !chosen || chosen.armorClass === null;
    roll.title = chosen?.armorClass === null ? 'Rüstungsklasse des Ziels zuerst eintragen.' : '';
    get('combat-attack-hint').textContent =
      chosen?.armorClass === null && !attack.check
        ? 'Ziel-RK noch offen. In der RK-Spalte der Figur auf „offen“ klicken und die Rüstungsklasse eintragen.'
        : 'Das Ziel legt die RK des gespeicherten Angriffswurfs fest. Natürliche 1 und 20 werden automatisch ausgewertet; kritischer Schaden verdoppelt die Schadenswürfel. Bei alternativen Schadensformeln nur die passende Variante würfeln.';
    const damageRoot = get('combat-attack-damage');
    damageRoot.replaceChildren();
    if (attack.check?.outcome === 'success' && resolvedTarget) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Treffer mit allen Schadensanteilen…';
      button.disabled = blocked() || attackPending;
      button.onclick = () => {
        const source = combat.sources?.find((c) => c.id === attack.creatureId),
          original =
            source &&
            [...source.actions, ...source.legendaryActions].find((a) => a.id === attack.actionId);
        if (source && original)
          ports.openHit({
            attackerId: attack.attackerId,
            action: creatureActionForRolls(source, original),
            targetId: attack.targetId!,
            check: attack.check!,
            paidLegendary: attack.paidLegendary,
            applied: () => {
              if (pendingAttack === attack) {
                pendingAttack = null;
                renderAttackEffect();
              }
            },
          });
      };
      damageRoot.append(button);
    }
    const discard = get<HTMLButtonElement>('combat-attack-discard');
    discard.textContent = attack.check ? 'Angriff abschließen' : 'Verwerfen';
    discard.disabled = blocked() || attackPending;
  }
  async function rollAttack() {
    const attack = pendingAttack,
      combat = ports.combat,
      target = combat?.participants.find((p) => p.id === value('combat-attack-target'));
    if (!attack || !combat || !target || attack.combatId !== combat.id || attack.check) return;
    if (target.armorClass === null) {
      tell('Rüstungsklasse des Ziels zuerst eintragen.', true);
      return;
    }
    if (blocked() || attackPending) return;
    const current = session.capture(
      () => [ports.combat?.id],
      () => pendingAttack === attack,
    );
    attack.targetId = target.id;
    attackPending = true;
    renderAttackEffect();
    if (attack.legendary) {
      const confirmed = await execute({ kind: 'legendary-action', ...attack.legendary });
      if (!current()) return;
      if (!confirmed) {
        attackPending = false;
        renderAttackEffect();
        return;
      }
    }
    await rollSceneFormula(
      {
        label: attack.preset.label + ' gegen ' + target.name,
        actor: attack.actor,
        formula: attack.preset.formula,
        formulaKind: 'attack',
        dc: target.armorClass,
        sourceCreatureId: attack.creatureId,
        sourceActionId: attack.actionId,
      },
      (check) => {
        if (current()) attack.check = check;
      },
    );
    if (current()) {
      attackPending = false;
      renderAttackEffect();
    }
  }
  function stageSave(
    action: CreatureAction,
    preset: CreatureRollPreset,
    attackerId: string,
    actor: string,
    creatureId: string,
    combatId: string,
    legendary?: PendingLegendary,
  ) {
    if (savePending || ports.combat?.id !== combatId) return;
    const next: PendingSave = {
        combatId,
        attackerId,
        creatureId,
        actionId: action.id,
        actor,
        preset,
        damages: creatureActionRolls(action).filter((p) => p.kind === 'damage'),
        rolledDamage: [],
        resolvedTargets: [],
        targetId: null,
        check: null,
        ...(legendary ? { legendary } : {}),
      },
      retained = retainPendingAttack(pendingSave, next);
    if (retained === pendingSave) {
      renderSaveEffect();
      get('combat-save-effect').scrollIntoView({ block: 'nearest' });
      tell('Offenen Rettungswurf zuerst abschließen oder verwerfen.', true);
      return;
    }
    pendingSave = retained;
    get<HTMLInputElement>('combat-save-modifier').value = '0';
    renderSaveEffect();
    get('combat-save-effect').scrollIntoView({ block: 'nearest' });
  }
  function renderSaveEffect() {
    const box = get('combat-save-effect'),
      combat = ports.combat,
      save = pendingSave;
    if (!save || !combat || save.combatId !== combat.id || !editableCombat(combat)) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const target = get<HTMLSelectElement>('combat-save-target'),
      previous = target.value,
      candidates = combat.participants.filter(
        (p) => p.id !== save.attackerId && !save.resolvedTargets.includes(p.id),
      );
    target.replaceChildren();
    for (const p of candidates) {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = p.name;
      target.append(option);
    }
    const preferred =
      save.targetId ??
      (candidates.some((p) => p.id === previous) ? previous : null) ??
      candidates.find((p) => !!p.characterId)?.id ??
      candidates[0]?.id ??
      '';
    target.value = preferred;
    const chosen = combat.participants.find((p) => p.id === (save.targetId ?? target.value)),
      modifier = get<HTMLInputElement>('combat-save-modifier'),
      outcome = save.check?.outcome;
    get('combat-save-result').textContent = save.check
      ? save.actor +
        ' · ' +
        save.preset.label +
        ' für ' +
        (chosen?.name ?? 'entferntes Ziel') +
        ': ' +
        save.check.total +
        ' gegen SG ' +
        save.check.dc +
        ' · ' +
        (outcome === 'success' ? 'Bestanden' : 'Fehlgeschlagen')
      : save.actor + ' · ' + save.preset.label + ' · SG ' + save.preset.dc;
    target.disabled = blocked() || savePending || !!save.check;
    modifier.disabled = blocked() || savePending || !!save.check;
    const roll = get<HTMLButtonElement>('combat-save-roll'),
      modifierValue = Number(modifier.value);
    roll.hidden = !!save.check;
    roll.disabled =
      blocked() ||
      savePending ||
      !target.value ||
      !Number.isSafeInteger(modifierValue) ||
      Math.abs(modifierValue) > 1000;
    const damages = get('combat-save-damage');
    damages.replaceChildren();
    if (save.check && chosen)
      for (const damage of save.damages) {
        const button = document.createElement('button'),
          done = save.rolledDamage.includes(creatureRollKey(damage));
        button.type = 'button';
        button.textContent =
          damage.label + ' (' + damage.formula + ') würfeln' + (done ? ' ✓' : '');
        button.disabled = blocked() || savePending || done;
        button.onclick = () => void rollSaveDamage(damage);
        damages.append(button);
      }
    const repeat = get<HTMLButtonElement>('combat-save-repeat');
    repeat.hidden = !save.check;
    repeat.disabled = blocked() || savePending || !candidates.some((p) => p.id !== save.targetId);
    get<HTMLButtonElement>('combat-save-discard').disabled = blocked() || savePending;
  }
  async function rollSave() {
    const save = pendingSave,
      combat = ports.combat,
      target = combat?.participants.find((p) => p.id === value('combat-save-target')),
      modifier = Number(value('combat-save-modifier'));
    if (
      !save ||
      !combat ||
      !target ||
      save.combatId !== combat.id ||
      save.check ||
      !Number.isSafeInteger(modifier) ||
      Math.abs(modifier) > 1000
    )
      return;
    if (blocked() || savePending) return;
    const current = session.capture(
      () => [ports.combat?.id],
      () => pendingSave === save,
    );
    save.targetId = target.id;
    savePending = true;
    renderSaveEffect();
    if (save.legendary) {
      const confirmed = await execute({ kind: 'legendary-action', ...save.legendary });
      if (!current()) return;
      if (!confirmed) {
        savePending = false;
        renderSaveEffect();
        return;
      }
    }
    await rollSceneCheck(
      {
        label: save.actor + ' · ' + save.preset.label,
        actor: target.name,
        mode: 'normal',
        modifier,
        dc: save.preset.dc,
        sourceCreatureId: save.creatureId,
        sourceActionId: save.actionId,
      },
      (check) => {
        if (current()) save.check = check;
      },
    );
    if (current()) {
      savePending = false;
      renderSaveEffect();
    }
  }
  async function rollSaveDamage(damage: CreatureRollPreset) {
    const save = pendingSave,
      key = creatureRollKey(damage);
    if (
      !save?.check ||
      !save.targetId ||
      !ports.combat?.participants.some((p) => p.id === save.targetId) ||
      save.rolledDamage.includes(key)
    )
      return;
    if (blocked() || savePending) return;
    const current = session.capture(
      () => [ports.combat?.id],
      () => pendingSave === save,
    );
    savePending = true;
    renderSaveEffect();
    let rolled = false;
    await rollSceneFormula(
      {
        label: damage.label,
        actor: save.actor,
        formula: damage.formula,
        formulaKind: 'damage',
        dc: null,
        sourceCreatureId: save.creatureId,
        sourceActionId: save.actionId,
      },
      (result) => {
        if (current()) {
          rolled = true;
          stageDamage(result, save.attackerId, save.combatId, save.targetId!);
        }
      },
    );
    if (current()) {
      savePending = false;
      if (rolled) save.rolledDamage.push(key);
      renderSaveEffect();
    }
  }
  function repeatSave() {
    const save = pendingSave;
    if (!save?.check || !save.targetId) return;
    if (!save.resolvedTargets.includes(save.targetId)) save.resolvedTargets.push(save.targetId);
    save.targetId = null;
    save.check = null;
    save.rolledDamage = [];
    get<HTMLInputElement>('combat-save-modifier').value = '0';
    renderSaveEffect();
  }
  function stageDamage(check: SceneCheck, attackerId: string, combatId: string, targetId?: string) {
    const combat = ports.combat;
    if (
      !combat ||
      !editableCombat(combat) ||
      check.sceneId !== combat.sceneId ||
      check.rollKind !== 'formula' ||
      check.formulaKind !== 'damage' ||
      !Number.isSafeInteger(check.total) ||
      check.total <= 0
    )
      return;
    const next = enqueuePendingDamage(
      pendingDamage,
      { check, combatId, attackerId, targetId },
      combat.id,
    );
    if (next.length === pendingDamage.length) return;
    pendingDamage = next;
    renderDamageEffect();
    get('combat-roll-effect').scrollIntoView({ block: 'nearest' });
  }
  function renderDamageEffect() {
    const box = get('combat-roll-effect'),
      combat = ports.combat,
      damage = pendingDamage[0];
    if (!damage || !combat || damage.combatId !== combat.id || !editableCombat(combat)) {
      box.hidden = true;
      return;
    }
    const applied = damage.appliedTargets ?? [];
    box.hidden = false;
    get('combat-roll-effect-result').textContent =
      (damage.check.actor ? damage.check.actor + ' · ' : '') +
      damage.check.label +
      ': ' +
      damage.check.total +
      ' Schaden gewürfelt' +
      (applied.length
        ? ' · auf ' + applied.length + ' Ziel' + (applied.length === 1 ? '' : 'e') + ' angewendet'
        : '') +
      (pendingDamage.length > 1 ? ' · 1 von ' + pendingDamage.length + ' offenen Würfen' : '');
    const target = get<HTMLSelectElement>('combat-roll-target'),
      previous = target.dataset.checkId === damage.check.id ? target.value : '',
      candidates = combat.participants.filter(
        (p) => p.healthKnown !== false && !applied.includes(p.id),
      );
    target.replaceChildren();
    target.dataset.checkId = damage.check.id;
    for (const p of candidates) {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent =
        p.name +
        ' · ' +
        p.hp +
        ' / ' +
        p.maxHp +
        ' HP' +
        (p.tempHp ? ' + ' + p.tempHp + ' temp.' : '');
      target.append(option);
    }
    const fallback =
      candidates.find((p) => p.id === damage.targetId) ??
      candidates.find((p) => p.id !== damage.attackerId && !!p.characterId) ??
      candidates.find((p) => p.id !== damage.attackerId) ??
      candidates[0];
    target.value = candidates.some((p) => p.id === previous) ? previous : (fallback?.id ?? '');
    const keep = get<HTMLInputElement>('combat-roll-keep');
    if (keep.dataset.checkId !== damage.check.id) {
      keep.dataset.checkId = damage.check.id;
      keep.checked = false;
    }
    const unavailable = blocked() || !target.value;
    get<HTMLButtonElement>('combat-roll-damage').disabled = unavailable;
    get<HTMLButtonElement>('combat-roll-half').disabled =
      unavailable || Math.floor(damage.check.total / 2) < 1;
    get<HTMLButtonElement>('combat-roll-double').disabled =
      unavailable || damage.check.total * 2 > 1000000;
    keep.disabled = blocked();
    const discard = get<HTMLButtonElement>('combat-roll-discard');
    discard.textContent = applied.length ? 'Wurf abschließen' : 'Verwerfen';
    discard.disabled = blocked();
  }
  async function applyRolledDamage(scale: 'full' | 'half' | 'double') {
    const damage = pendingDamage[0],
      target = value('combat-roll-target');
    if (!damage || !target || ports.combat?.id !== damage.combatId) return;
    const amount =
      scale === 'half'
        ? Math.floor(damage.check.total / 2)
        : scale === 'double'
          ? damage.check.total * 2
          : damage.check.total;
    if (amount < 1 || amount > 1000000) return;
    if (blocked()) return;
    // A not-applied receipt has no canonical value to accept. Only the next
    // explicit user action may release that old intent and submit a new one.
    if (application && ports.uncertain()) return;
    application = null;
    application = {
      checkId: damage.check.id,
      combatId: damage.combatId,
      targetId: target,
      keep: get<HTMLInputElement>('combat-roll-keep').checked,
      generation: session.generation,
    };
    const current = session.capture(() => [ports.combat?.id]);
    const confirmed = await execute({
      kind: 'damage',
      participantId: target,
      amount,
      sourceCheckId: damage.check.id,
      sourceScale: scale,
    });
    if (!confirmed && current() && !ports.uncertain()) application = null;
  }
  /** Called only after canonical acknowledgement or resolution of that command. */
  function accepted(action: CombatAction, combatId: string | null | undefined) {
    if (!combatId || ports.combat?.id !== combatId) return;
    if (action.kind === 'legendary-action') {
      for (const pending of [pendingAttack, pendingSave]) {
        if (
          pending?.combatId !== combatId ||
          !pending.legendary ||
          pending.legendary.participantId !== action.participantId ||
          pending.legendary.actionId !== action.actionId ||
          pending.legendary.cost !== action.cost
        )
          continue;
        if (pending === pendingAttack) pendingAttack.paidLegendary = true;
        delete pending.legendary;
      }
    }
    if (
      action.kind !== 'damage' ||
      !application ||
      application.generation !== session.generation ||
      application.combatId !== combatId ||
      application.checkId !== action.sourceCheckId ||
      application.targetId !== action.participantId
    )
      return;
    const damage = pendingDamage.find((damage) => damage.check.id === application!.checkId);
    if (damage) {
      if (application.keep) {
        damage.appliedTargets = [
          ...new Set([...(damage.appliedTargets ?? []), application.targetId]),
        ];
        if (
          !ports.combat?.participants.some(
            (p) => p.healthKnown !== false && !damage.appliedTargets!.includes(p.id),
          )
        )
          pendingDamage = pendingDamage.filter((item) => item !== damage);
      } else pendingDamage = pendingDamage.filter((item) => item !== damage);
    }
    application = null;
    renderDamageEffect();
  }

  function init() {
    get('combat-roll-damage').onclick = () => void applyRolledDamage('full');
    get('combat-roll-half').onclick = () => void applyRolledDamage('half');
    get('combat-roll-double').onclick = () => void applyRolledDamage('double');
    get('combat-roll-discard').onclick = () => {
      pendingDamage = pendingDamage.slice(1);
      renderDamageEffect();
    };
    get('combat-roll-target').onchange = renderDamageEffect;
    get('combat-attack-target').onchange = renderAttackEffect;
    get('combat-attack-roll').onclick = () => void rollAttack();
    get('combat-attack-discard').onclick = () => {
      pendingAttack = null;
      renderAttackEffect();
    };
    get('combat-save-target').onchange = renderSaveEffect;
    get('combat-save-modifier').oninput = renderSaveEffect;
    get('combat-save-roll').onclick = () => void rollSave();
    get('combat-save-repeat').onclick = repeatSave;
    get('combat-save-discard').onclick = () => {
      pendingSave = null;
      renderSaveEffect();
    };
  }
  function accept(combat: CombatView['combat']) {
    if (application && application.combatId !== combat?.id) application = null;
    if (pendingDamage.some((damage) => damage.combatId !== combat?.id)) pendingDamage = [];
    if (pendingAttack && !pendingRollStillValid(pendingAttack, combat)) {
      pendingAttack = null;
      attackPending = false;
    }
    if (pendingSave && !pendingRollStillValid(pendingSave, combat)) {
      pendingSave = null;
      savePending = false;
    }
  }
  function reset() {
    application = null;
    pendingDamage = [];
    pendingAttack = null;
    attackPending = false;
    pendingSave = null;
    savePending = false;
  }
  session.onDeactivate(reset);
  return {
    init,
    accepted,
    accept,
    reset,
    stageAttack,
    stageSave,
    stageDamage,
    renderAttackEffect,
    renderSaveEffect,
    renderDamageEffect,
    get hasAttack() {
      return !!pendingAttack;
    },
    get hasSave() {
      return !!pendingSave;
    },
  };
}
