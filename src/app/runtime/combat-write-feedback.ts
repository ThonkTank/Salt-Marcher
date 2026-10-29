import type { CombatAction, CombatView } from './combat-contracts';
import type { CombatState } from './combat-state-contracts';
import type { DeathSaveResult } from './character-progress-contracts';
const deathResultText = (result: DeathSaveResult) =>
  ({
    success: 'Erfolg',
    failure: 'Fehlschlag',
    'natural-20': 'Natürliche 20 · 1 HP',
    'natural-1': 'Natürliche 1 · zwei Fehlschläge',
    stabilize: 'Stabilisiert',
    reset: 'Zurückgesetzt',
    dead: 'Als tot markiert',
  })[result];
export function combatWriteFeedback(
  result: CombatView,
  action: CombatAction,
  before: CombatState | null,
) {
  const priorDamageDeath =
    action.kind === 'damage' || action.kind === 'hit'
      ? structuredClone(before?.participants.find((p) => p.id === action.participantId)?.death)
      : undefined;
  const priorEffects =
    action.kind === 'next' || action.kind === 'start'
      ? (before?.participants.flatMap((actor) =>
          (actor.timedEffects ?? []).map((effect) => ({
            actorId: actor.id,
            actor: actor.name,
            ...effect,
          })),
        ) ?? [])
      : [];
  const actor =
      'participantId' in action
        ? result.combat?.participants.find((p) => p.id === action.participantId)
        : undefined,
    death =
      action.kind === 'death' || action.kind === 'death-roll'
        ? actor?.deathLast
        : (action.kind === 'damage' || action.kind === 'hit') &&
            JSON.stringify(priorDamageDeath) !== JSON.stringify(actor?.death)
          ? actor?.deathLast
          : undefined;
  const concentration =
    action.kind === 'concentration' || action.kind === 'concentration-roll'
      ? actor?.concentrationLast
      : undefined;
  const concentrationActor =
    action.kind === 'area-damage'
      ? result.combat?.participants.find((p) => p.concentrationChecks?.length)
      : actor;
  const openConcentration =
    action.kind === 'damage' || action.kind === 'hit' || action.kind === 'area-damage'
      ? concentrationActor?.concentrationChecks?.[0]
      : undefined;
  const legendary = action.kind === 'legendary-action' ? actor?.legendaryActions : undefined;
  const effectTicks = priorEffects.flatMap((before) => {
    const after = result.combat?.participants
      .find((participant) => participant.id === before.actorId)
      ?.timedEffects?.find((effect) => effect.id === before.id);
    return !after
      ? [before.name + ' bei ' + before.actor + ' endet']
      : after.remaining !== before.remaining
        ? [
            before.name +
              ' bei ' +
              before.actor +
              ': ' +
              after.remaining +
              ' Runde' +
              (after.remaining === 1 ? '' : 'n') +
              ' verbleibend',
          ]
        : [];
  });
  const areaResult =
    action.kind === 'area-damage'
      ? 'Flächenschaden gespeichert · ' +
        action.targets
          .map((target) => {
            const participant = result.combat!.participants.find(
              (p) => p.id === target.participantId,
            )!;
            return (
              participant.name +
              ' ' +
              participant.hp +
              '/' +
              participant.maxHp +
              ' HP' +
              (participant.tempHp ? ' + ' + participant.tempHp + ' temp.' : '')
            );
          })
          .join(' · ') +
        (openConcentration
          ? ' · Konzentrationswurf für ' +
            concentrationActor!.name +
            ' gegen SG ' +
            openConcentration.dc +
            ' offen.'
          : '.')
      : null;
  const text =
    areaResult ??
    (action.kind === 'hit'
      ? 'Treffer gespeichert · ' +
        (action.critical ? 'kritisch · ' : '') +
        actor!.name +
        ' ' +
        actor!.hp +
        '/' +
        actor!.maxHp +
        ' HP' +
        (actor!.death?.dead
          ? ' · tot'
          : actor!.death
            ? ' · Todesrettung ' +
              actor!.death.successes +
              ' Erfolge / ' +
              actor!.death.failures +
              ' Fehlschläge'
            : '') +
        (openConcentration ? ' · Konzentration SG ' + openConcentration.dc + ' offen.' : '.')
      : death
        ? (action.kind === 'damage'
            ? 'Schadensfolge: '
            : death.roll === null
              ? ''
              : 'Todesrettungswurf ' + death.roll + ': ') +
          deathResultText(death.result) +
          '.'
        : concentration
          ? 'Konzentration: ' +
            (concentration.roll === null
              ? 'manuell'
              : concentration.roll +
                (concentration.modifier >= 0 ? ' + ' : ' − ') +
                Math.abs(concentration.modifier) +
                ' = ' +
                concentration.total) +
            ' gegen SG ' +
            concentration.dc +
            ' · ' +
            (concentration.success ? 'bestanden.' : 'verloren.')
          : openConcentration
            ? 'Schaden gespeichert. Konzentrationswurf für ' +
              concentrationActor!.name +
              ' gegen SG ' +
              openConcentration.dc +
              ' offen.'
            : legendary
              ? 'Legendäre Aktion eingesetzt · ' +
                legendary.remaining +
                ' von ' +
                legendary.maximum +
                ' Punkten verbleiben.'
              : effectTicks.length
                ? 'Rundeneffekte: ' + effectTicks.join(' · ') + '.'
                : 'Kampf gespeichert.');
  return { text, revealConcentration: !!openConcentration };
}
