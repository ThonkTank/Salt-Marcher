import type { Result } from '../shared/contracts';
import type { LiveScene } from './live-contracts';
import type { CombatAction, CombatState, CombatView } from './combat-contracts';
import type { PreparedGroup } from '../campaign/session-contracts';
import { groupCombatBasis, type GroupView } from '../campaign/groups-contracts';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
const unwrap = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
export const sceneGroupDragType = 'application/x-saltmarcher-scene-group';
export function bindSceneGroupDrag(
  card: HTMLElement,
  sceneId: string,
  group: Pick<PreparedGroup, 'id' | 'revision'>,
  current: () => boolean,
) {
  card.draggable = true;
  card.dataset.sceneGroupId = group.id;
  card.ondragstart = (e) => {
    if (!current() || !e.dataTransfer) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(
      sceneGroupDragType,
      JSON.stringify({ sceneId, groupId: group.id, revision: group.revision }),
    );
  };
}
/** The tray makes source and target visible together, including while the encounter is focused. */
export function sceneGroupTray(
  context: () => { token: string; sceneId: string; current: () => boolean } | null,
  choose: (id: string, revision: number, current: () => boolean) => Promise<void>,
  tell: (text: string, error?: boolean) => void,
  api: Pick<Window['campaign'], 'scenePreparation'> = window.campaign,
) {
  const details = node('details'),
    rows = node('div'),
    refresh = node('button', 'Monstergruppen neu lesen');
  details.id = 'combat-scene-groups';
  rows.id = 'combat-scene-group-cards';
  refresh.type = 'button';
  details.append(node('summary', 'Monstergruppen am Szenenort / Besuch'), refresh, rows);
  let request = 0;
  const read = async () => {
    const owner = context(),
      n = ++request;
    rows.replaceChildren();
    if (!owner) return;
    const current = () => n === request && owner.current() && details.open;
    rows.textContent = 'Gruppen werden gelesen…';
    try {
      const preparation = unwrap(await api.scenePreparation(owner.token, owner.sceneId));
      if (!current()) return;
      rows.replaceChildren();
      for (const group of preparation.groups) {
        const card = node('article'),
          select = node('button', 'Figuren auswählen…'),
          alive = group.actors.filter(
            (a) => a.hp > 0 && !a.unavailable && !a.defeated && a.role !== 'neutral',
          ).length;
        select.type = 'button';
        select.onclick = () =>
          void choose(group.id, group.revision, current).catch((e) => tell(e.message, true));
        card.className = 'combat-scene-group-card';
        card.append(
          node('strong', group.title),
          node(
            'p',
            alive +
              (alive === 1 ? ' kampffähige Figur' : ' kampffähige Figuren') +
              ' · ziehen oder auswählen',
          ),
          select,
        );
        bindSceneGroupDrag(card, owner.sceneId, group, current);
        rows.append(card);
      }
      if (!preparation.groups.length)
        rows.textContent = 'Keine vorbereiteten Gruppen an diesem Ort oder Besuch.';
    } catch (error) {
      if (current()) rows.textContent = (error as Error).message;
    }
  };
  details.ontoggle = () => {
    if (details.open) void read();
    else {
      request++;
      rows.replaceChildren();
    }
  };
  refresh.onclick = () => void read();
  return details;
}
export type GroupReinforcement = {
  combat: CombatState;
  action: Extract<CombatAction, { kind: 'add-prepared-group' }>;
};
/** Read/choose only. Canonical membership and combat writes stay at the existing command boundary. */
export class CombatGroupPicker {
  constructor(
    private api: Pick<
      Window['campaign'],
      'scenePreparation' | 'groupView' | 'combat'
    > = window.campaign,
    private dialogHost: HTMLElement = document.body,
  ) {}
  private close: (() => void) | null = null;
  reset() {
    this.close?.();
  }
  async open(
    token: string,
    scene: LiveScene,
    view: CombatView,
    current: () => boolean,
    groupId?: string,
    expectedGroupRevision?: number,
  ): Promise<GroupReinforcement | null> {
    this.reset();
    const dialog = node('dialog'),
      groups = node('select'),
      targets = node('select'),
      members = node('div'),
      status = node('p'),
      summary = node('p'),
      initiative = node('input'),
      apply = node('button', 'Ausgewählte Figuren übernehmen'),
      refresh = node('button', 'Stand neu lesen'),
      cancel = node('button', 'Abbrechen');
    dialog.id = 'combat-group-dialog';
    dialog.className = 'combat-group-dialog';
    dialog.setAttribute('aria-labelledby', 'combat-group-heading');
    const heading = node('h2', 'Monstergruppe in Begegnung übernehmen');
    heading.id = 'combat-group-heading';
    groups.id = 'combat-group-source';
    targets.id = 'combat-group-target';
    members.id = 'combat-group-members';
    status.id = 'combat-group-status';
    status.setAttribute('role', 'status');
    initiative.id = 'combat-group-initiative';
    initiative.type = 'number';
    initiative.min = '-1000000';
    initiative.max = '1000000';
    initiative.step = '1';
    initiative.value = '0';
    initiative.required = true;
    apply.id = 'combat-group-apply';
    apply.type = refresh.type = cancel.type = 'button';
    const label = (text: string, input: HTMLElement) => {
        const l = node('label', text + ' ');
        l.append(input);
        return l;
      },
      actions = node('div');
    actions.className = 'toolbar combat-group-actions';
    actions.append(cancel, refresh, apply);
    dialog.append(
      heading,
      label('Vorbereitete Gruppe am Szenenort / Besuch', groups),
      label('Begegnung', targets),
      summary,
      members,
      label('Initiative für neue Initiativeplätze', initiative),
      node(
        'p',
        'Vorhandene Figuren und ihre HP bleiben erhalten. Neue Figuren einer schon vorbereiteten Mob-Gruppe übernehmen deren Initiative. Neutrale, besiegte und anderweitig platzierte NSCs bleiben außerhalb der Initiative.',
      ),
      status,
      actions,
    );
    this.dialogHost.append(dialog);
    return new Promise((resolve) => {
      let closed = false,
        request = 0,
        reading = false,
        group: GroupView | null = null,
        combat: CombatState | null = null;
      const selected = new Set<string>();
      const valid = () => !closed && current(),
        finish = (value: GroupReinforcement | null) => {
          if (closed) return;
          closed = true;
          request++;
          dialog.close();
          dialog.remove();
          if (this.close === close) this.close = null;
          resolve(value);
        },
        close = () => finish(null);
      this.close = close;
      const lock = () => {
        groups.disabled = targets.disabled = refresh.disabled = reading;
        apply.disabled = reading || !group || !combat || !selected.size || !valid();
      };
      const draw = () => {
        members.replaceChildren();
        selected.clear();
        if (!group || !combat) {
          lock();
          return;
        }
        summary.textContent =
          group.title +
          ' · ' +
          (group.locationTitle ?? 'Ohne gemeinsamen Ort') +
          ' → ' +
          combat.title +
          ' · ' +
          (combat.phase === 'running' ? 'Runde ' + combat.round : 'Vor Initiative');
        for (const actor of group.actors) {
          const present = combat.participants.some((p) => p.worldActorId === actor.id),
            reason = present
              ? 'bereits enthalten'
              : actor.unavailable
                ? 'nicht verfügbar'
                : actor.defeated || actor.hp <= 0
                  ? 'besiegt'
                  : actor.role === 'neutral'
                    ? 'neutral · Haltung im NSC-Profil ändern'
                    : actor.locationId && actor.locationId !== scene.locationId
                      ? 'an anderem Ort'
                      : '';
          const row = node('label'),
            box = node('input');
          row.className = 'check-label';
          row.dataset.actorId = actor.id;
          box.type = 'checkbox';
          box.value = actor.id;
          box.disabled = !!reason;
          box.checked = !reason;
          if (!reason) selected.add(actor.id);
          box.onchange = () => {
            if (box.checked) selected.add(actor.id);
            else selected.delete(actor.id);
            lock();
          };
          row.append(
            box,
            document.createTextNode(
              actor.name +
                ' · ' +
                actor.hp +
                '/' +
                actor.maxHp +
                ' HP · ' +
                (actor.role === 'friendly'
                  ? 'verbündet'
                  : actor.role === 'neutral'
                    ? 'neutral'
                    : 'feindlich') +
                (reason ? ' · ' + reason : ''),
            ),
          );
          members.append(row);
        }
        status.textContent =
          selected.size +
          (selected.size === 1 ? ' Figur kann hinzukommen.' : ' Figuren können hinzukommen.') +
          ' Bereits enthaltene Figuren werden nicht erneut angelegt.';
        lock();
      };
      const read = async (initial = false) => {
        const n = ++request;
        reading = true;
        group = null;
        combat = null;
        members.replaceChildren();
        status.textContent = 'Gespeicherte Gruppen und Begegnung werden gelesen…';
        lock();
        try {
          if (initial) {
            const preparation = unwrap(await this.api.scenePreparation(token, scene.id));
            if (!valid() || n !== request) return;
            groups.replaceChildren();
            for (const g of preparation.groups) {
              const option = node('option', g.title + ' · ' + g.actors.length + ' Figuren');
              option.value = g.id;
              groups.append(option);
            }
            const choices = view.recent.filter(
              (c) => c.phase === 'preparing' || c.phase === 'running',
            );
            for (const c of choices) {
              const option = node(
                'option',
                c.title + ' · ' + (c.phase === 'running' ? 'läuft' : 'vorbereitet'),
              );
              option.value = c.id;
              targets.append(option);
            }
            if (groupId) {
              if (!preparation.groups.some((g) => g.id === groupId))
                throw new Error('Gruppe gehört nicht mehr zu diesem Szenenort oder Besuch.');
              groups.value = groupId;
            }
            if (view.combat && choices.some((c) => c.id === view.combat!.id))
              targets.value = view.combat.id;
          }
          if (!groups.value)
            throw new Error(
              'Keine vorbereitete Gruppe an diesem Szenenort oder Besuch. Im Spielabendplan eine Gruppe übernehmen oder im Gruppenbereich am Ort platzieren.',
            );
          if (!targets.value) throw new Error('Zuerst eine Begegnung vorbereiten.');
          const [g, c] = await Promise.all([
            this.api.groupView(token, groups.value),
            this.api.combat(token, scene.id, targets.value),
          ]);
          if (!valid() || n !== request) return;
          group = unwrap(g);
          combat = unwrap(c).combat;
          if (
            !combat ||
            combat.id !== targets.value ||
            combat.sceneId !== scene.id ||
            !['preparing', 'running'].includes(combat.phase)
          )
            throw new Error('Begegnung ist nicht mehr offen.');
          if (group.id !== groups.value) throw new Error('Gruppenantwort falsch zugeordnet.');
          if (
            initial &&
            groupId &&
            expectedGroupRevision !== undefined &&
            group.revision !== expectedGroupRevision
          )
            throw new Error('Gruppe seit Anzeige geändert. Stand neu lesen und erneut auswählen.');
          draw();
        } catch (error) {
          if (valid() && n === request) {
            group = null;
            combat = null;
            members.replaceChildren();
            status.textContent = (error as Error).message;
          }
        } finally {
          if (valid() && n === request) {
            reading = false;
            lock();
          }
        }
      };
      groups.onchange = targets.onchange = () => void read();
      refresh.onclick = () => void read();
      cancel.onclick = close;
      dialog.oncancel = (e) => {
        e.preventDefault();
        close();
      };
      apply.onclick = () => {
        if (!valid()) {
          close();
          return;
        }
        if (reading || !group || !combat || !selected.size) return;
        const raw = initiative.value.trim(),
          value = Number(raw);
        if (!raw || !Number.isSafeInteger(value) || Math.abs(value) > 1000000) {
          status.textContent = 'Initiative benötigt eine gültige ganze Zahl.';
          initiative.focus();
          return;
        }
        finish({
          combat,
          action: {
            kind: 'add-prepared-group',
            preparedGroupId: group.id,
            expectedPreparedRevision: group.revision,
            expectedRosterBasis: groupCombatBasis(group),
            worldActorIds: [...selected],
            initiative: value,
          },
        });
      };
      dialog.showModal();
      void read(true);
    });
  }
}
