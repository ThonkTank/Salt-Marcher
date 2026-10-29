import type { CombatAction, CombatView } from './combat-contracts';
import { editableCombat } from './combat-roll-state';
import { initiativeGroups } from './combat-initiative';
import { canReinforceTroop } from './combat-mob-ui';
import { BookingDialog } from '../shared/booking-dialog';
import type { EditorSession } from '../shared/editor-session';
import type { Result } from '../shared/contracts';

type ReinforcementPorts = {
  document: Document;
  get<T extends HTMLElement = HTMLElement>(id: string): T;
  session: EditorSession;
  api: Pick<Window['campaign'], 'creatures'>;
  readonly context: { token: string; campaignId: string } | null;
  readonly combat: CombatView['combat'] | null;
  readonly sceneId: string | null;
  readonly loadVersion: number;
  blocked(): boolean;
  writing(): boolean;
  send(action: CombatAction, failed?: (message: string) => void): Promise<boolean>;
  create(creatureId: string, count: number, grouped: boolean): Promise<void>;
  initiative(): void;
  lock(): void;
  feedback(text: string, error?: boolean): void;
};

/** Owns the complete reinforcement interaction, while the combat writer keeps
 * commands and durable receipts. Accepted bookings cannot be reset by a view. */
export function createCombatReinforcementEditor(ports: ReinforcementPorts) {
  const { document, get, session: editorSession } = ports;
  const value = (id: string) => get<HTMLInputElement>(id).value;
  const unwrap = <T>(result: Result<T>): T => {
    if (!result.ok) throw new Error(result.error);
    return result.value;
  };
  const blocked = () => ports.blocked();
  const lock = () => ports.lock();
  const tell = (text: string, error?: boolean) => ports.feedback(text, error);
  let reinforcementRequest = 0,
    reinforcementBusy = false,
    reinforcementSourceChosen = false;
  let reinforcementResults:
    | { id: string; name: string; challengeRating: string; hp?: number; ac?: number }[]
    | null = null;
  const send = (
    action: CombatAction,
    _revision?: number,
    _current?: () => boolean,
    failed?: (message: string) => void,
  ) => ports.send(action, failed);
  const reinforcementBooking = new BookingDialog();
  function closeReinforcements() {
    if (reinforcementBooking.busy) return;
    reinforcementRequest++;
    reinforcementBusy = false;
    reinforcementBooking.reset();
    const dialog = get<HTMLDialogElement>('combat-add-dialog');
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }
  async function submitReinforcement(
    send: (failed: (message: string) => void) => Promise<boolean>,
    confirmed = closeReinforcements,
  ) {
    if (!ports.context) return false;
    return reinforcementBooking.run({
      campaignId: ports.context.campaignId,
      current: editorSession.capture(
        () => [ports.context?.token, ports.sceneId, editorSession.generation],
        () => get('combat-add-dialog').hasAttribute('open'),
      ),
      send,
      lock: () => lock(),
      report: (message) => {
        get('combat-add-status').textContent = message;
      },
      confirmed,
    });
  }
  /** Preparation collects several confirmed species before moving on to initiative. */
  function catalogAdditionConfirmed(creatureId: string, count: number) {
    if (ports.combat?.phase !== 'preparing') {
      closeReinforcements();
      return;
    }
    const name = ports.combat!.sources?.find((c) => c.id === creatureId)?.name ?? 'Gegner';
    get('combat-add-status').textContent = count + ' × ' + name + ' übernommen.';
    reinforcementResults = [];
    reinforcementSourceChosen = true;
    get<HTMLSelectElement>('combat-creature-source').value = 'catalog';
    get<HTMLInputElement>('combat-creature-search').value = '';
    get('combat-creature-status').textContent = '';
    get<HTMLInputElement>('combat-creature-count').value = '1';
    get<HTMLInputElement>('combat-creature-grouped').checked = false;
    get<HTMLInputElement>('combat-creature-initiative').value = '';
    renderReinforcements();
    lock();
    get<HTMLInputElement>('combat-creature-search').focus();
  }
  function openReinforcements(groupId?: string) {
    if (blocked() || reinforcementBooking.busy || !ports.context || !ports.sceneId) return;
    reinforcementBooking.reset();
    get('combat-add-status').textContent = '';
    get<HTMLSelectElement>('combat-creature-source').value = groupId ? 'group' : 'catalog';
    reinforcementSourceChosen = true;
    renderReinforcements();
    if (groupId) {
      const select = get<HTMLSelectElement>('combat-creature-select'),
        target = 'group:' + groupId;
      if (![...select.options].some((option) => option.value === target)) {
        tell('Trupp nicht mehr verfügbar. Verstärkung erneut öffnen.', true);
        return;
      }
      select.value = target;
      get<HTMLInputElement>('combat-creature-count').value = '1';
    }
    lock();
    const dialog = get<HTMLDialogElement>('combat-add-dialog');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    get<HTMLInputElement>(
      value('combat-creature-source') === 'catalog'
        ? 'combat-creature-search'
        : 'combat-creature-count',
    ).focus();
  }
  function renderReinforcements() {
    const select = get<HTMLSelectElement>('combat-creature-select'),
      previous = select.value,
      combat = ports.combat;
    get('combat-preparation-initiative').hidden = combat?.phase !== 'preparing';
    const source = get<HTMLSelectElement>('combat-creature-source');
    const groups = combat ? initiativeGroups(combat).filter(canReinforceTroop) : [];
    if (!reinforcementSourceChosen || !source.value || (source.value === 'group' && !groups.length))
      source.value = groups.length ? 'group' : 'catalog';
    source.querySelector<HTMLOptionElement>('option[value="group"]')!.disabled = !groups.length;
    source.hidden = !groups.length;
    get('combat-reinforcement').querySelector<HTMLLabelElement>(
      'label[for="combat-creature-source"]',
    )!.hidden = !groups.length;
    const grouped = source.value === 'group';
    get('combat-creature-search-form').hidden = grouped;
    get('combat-creature-status').hidden = grouped;
    get('combat-creature-initiative-field').hidden = grouped || !editableCombat(combat ?? null);
    get('combat-creature-grouped-field').hidden =
      grouped || Number(value('combat-creature-count')) <= 1;
    get('combat-creature-select-label').textContent = grouped
      ? 'Vorhandener Trupp'
      : 'Katalogkreatur';
    get('combat-creature-add').textContent = 'Gegner hinzufügen';
    get('combat-reinforcement').querySelector<HTMLLabelElement>(
      'label[for="combat-creature-source"]',
    )!.textContent = combat?.phase === 'running' ? 'Verstärkung aus' : 'Gegner aus';
    get('combat-creature-explanation').textContent = grouped
      ? 'Neue Mitglieder erhalten die Initiative des Trupps.'
      : 'Übernommene Gegner behalten ihre HP und Zustände auch für spätere Begegnungen.';
    select.replaceChildren();
    const add = (id: string, text: string) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = text;
      select.append(option);
    };
    if (grouped)
      for (const members of groups) {
        const actor = members[0]!;
        const names =
          members
            .slice(0, 2)
            .map((p) => p.name)
            .join(', ') + (members.length > 2 ? ' …' : '');
        add(
          'group:' + actor.groupId,
          (actor.groupName ? actor.groupName + ' · ' : '') +
            names +
            ' · vorhandene Initiative ' +
            actor.initiative +
            ' (' +
            members.length +
            ')',
        );
      }
    // A completed catalog search must never silently retain an unrelated troop.
    else
      for (const c of reinforcementResults ?? combat?.sources ?? [])
        add(
          'creature:' + c.id,
          c.name +
            ' · HG ' +
            c.challengeRating +
            (typeof c.hp === 'number' ? ' · ' + c.hp + ' HP' : '') +
            (typeof c.ac === 'number' ? ' · RK ' + c.ac : ''),
        );
    if (!select.options.length)
      add(
        '',
        reinforcementBusy
          ? 'Monster werden gesucht…'
          : 'Keine Katalogkreatur ausgewählt. Monster suchen.',
      );
    select.value = [...select.options].some((o) => o.value === previous)
      ? previous
      : (select.options[0]?.value ?? '');
  }
  async function searchReinforcements() {
    const w = ports.context,
      combat = ports.combat;
    if (!w || !ports.sceneId || blocked() || reinforcementBusy) return;
    const g = editorSession.generation,
      id = combat?.id,
      load = ports.loadVersion,
      request = ++reinforcementRequest;
    get<HTMLSelectElement>('combat-creature-source').value = 'catalog';
    reinforcementSourceChosen = true;
    reinforcementBusy = true;
    reinforcementResults = [];
    get('combat-creature-status').textContent = 'Monster werden gesucht…';
    renderReinforcements();
    lock();
    const read = editorSession.read();
    try {
      const result = unwrap(
        await ports.api.creatures({
          text: value('combat-creature-search'),
          offset: 0,
          limit: 25,
          sort: 'name',
          direction: 'asc',
        }),
      );
      if (
        g !== editorSession.generation ||
        request !== reinforcementRequest ||
        ports.context?.token !== w.token ||
        ports.combat?.id !== id ||
        load !== ports.loadVersion
      )
        return;
      reinforcementResults = result.rows;
      get('combat-creature-status').textContent = result.total
        ? Math.min(25, result.total) + ' von ' + result.total + ' Treffern.'
        : 'Keine Treffer. Suche ändern oder einen vorhandenen Trupp wählen.';
    } catch (error) {
      if (
        g === editorSession.generation &&
        request === reinforcementRequest &&
        ports.combat?.id === id &&
        load === ports.loadVersion
      )
        get('combat-creature-status').textContent =
          'Suche fehlgeschlagen: ' + (error as Error).message;
    } finally {
      read.finish();
      if (g === editorSession.generation && request === reinforcementRequest) {
        reinforcementBusy = false;
        if (load !== ports.loadVersion)
          get('combat-creature-status').textContent =
            'Kampfstand geändert. Bei Bedarf erneut suchen.';
        renderReinforcements();
        lock();
      }
    }
  }
  function lockControls() {
    if (reinforcementBusy)
      for (const control of get('combat-reinforcement').querySelectorAll<
        HTMLInputElement | HTMLButtonElement | HTMLSelectElement
      >('input,button,select'))
        control.disabled = true;
    get<HTMLButtonElement>('combat-creature-add').disabled =
      blocked() || reinforcementBusy || !value('combat-creature-select');
    const linked = value('combat-creature-select').startsWith('group:');
    get('combat-creature-grouped-field').hidden =
      linked || Number(value('combat-creature-count')) <= 1;
    if (get('combat-creature-grouped-field').hidden)
      get<HTMLInputElement>('combat-creature-grouped').checked = false;
    get<HTMLInputElement>('combat-creature-initiative').disabled =
      blocked() || reinforcementBusy || linked;
    get<HTMLInputElement>('combat-creature-grouped').disabled =
      blocked() || reinforcementBusy || linked;
  }
  function renderContext() {
    const combat = ports.combat;
    const additionLabel =
      !editableCombat(combat ?? null) || combat?.phase === 'preparing'
        ? 'Gegner vorbereiten'
        : 'Verstärkung hinzufügen';
    get('combat-add-open').textContent = additionLabel + '…';
    get('combat-add-title').textContent = additionLabel;
    const additions = get<HTMLDialogElement>('combat-add-dialog');
    if (additions.dataset.combatId !== (combat?.id ?? '') && !reinforcementBooking.busy)
      closeReinforcements();
    additions.dataset.combatId = combat?.id ?? '';
    get('combat-add-context').textContent =
      combat?.phase === 'running'
        ? 'Runde ' +
          combat.round +
          ' · Am Zug: ' +
          (combat.participants.find((p) => p.id === combat.turnId)?.name ?? '—') +
          ' · Zug bleibt erhalten.'
        : combat?.phase === 'preparing'
          ? 'Vorbereitet: ' +
            initiativeGroups(combat)
              .filter((members) => !members[0]!.characterId)
              .map(
                (members) =>
                  members.length +
                  ' × ' +
                  (members[0]!.groupName ??
                    combat.sources?.find((c) => c.id === members[0]!.sourceId)?.name ??
                    members[0]!.name),
              )
              .join(' · ')
          : 'Gegner mit Statblock, HP und XP übernehmen.';
  }
  function init() {
    get('combat-preparation-initiative').onclick = () => {
      if (blocked() || reinforcementBusy || ports.combat?.phase !== 'preparing') return;
      closeReinforcements();
      ports.initiative();
    };
    get('combat-add-open').onclick = () => openReinforcements();
    get('combat-add-close').onclick = () => {
      if (!ports.writing()) closeReinforcements();
    };
    get('combat-add-dialog').addEventListener('cancel', (event) => {
      event.preventDefault();
      if (!ports.writing()) closeReinforcements();
    });
    get('combat-creature-source').onchange = () => {
      reinforcementSourceChosen = true;
      get<HTMLInputElement>('combat-creature-initiative').value = '';
      renderReinforcements();
      lock();
    };
    get('combat-creature-search-form').onsubmit = (event) => {
      event.preventDefault();
      void searchReinforcements();
    };
    get('combat-creature-count').oninput = lock;
    get('combat-creature-select').onchange = () => {
      get<HTMLInputElement>('combat-creature-initiative').value = '';
      lock();
    };
    get('combat-creature-form').onsubmit = (event) => {
      event.preventDefault();
      if (blocked() || reinforcementBusy) return;
      const choice = value('combat-creature-select'),
        groupId = choice.startsWith('group:') ? choice.slice(6) : undefined;
      const creatureId = groupId
        ? ports.combat?.participants.find((p) => p.groupId === groupId)?.sourceId
        : choice.startsWith('creature:')
          ? choice.slice(9)
          : null;
      if (!creatureId) return;
      if (!editableCombat(ports.combat ?? null)) {
        void ports.create(
          creatureId,
          Number(value('combat-creature-count')),
          get<HTMLInputElement>('combat-creature-grouped').checked,
        );
        return;
      }
      const initiative = value('combat-creature-initiative').trim();
      get('combat-add-status').textContent = '';
      const count = Number(value('combat-creature-count'));
      void submitReinforcement(
        (failed) =>
          send(
            {
              kind: 'add-creature',
              creatureId,
              count,
              grouped: !!groupId || get<HTMLInputElement>('combat-creature-grouped').checked,
              ...(groupId ? { groupId } : initiative ? { initiative: Number(initiative) } : {}),
            },
            undefined,
            () => true,
            failed,
          ),
        () => catalogAdditionConfirmed(creatureId, count),
      );
    };
    get('combat-add-form').onsubmit = (event) => {
      event.preventDefault();
      if (blocked()) return;
      get('combat-add-status').textContent = '';
      void submitReinforcement((failed) =>
        send(
          {
            kind: 'add',
            name: value('enemy-name'),
            count: Number(value('enemy-count')),
            grouped: get<HTMLInputElement>('enemy-grouped').checked,
            maxHp: Number(value('enemy-hp')),
            armorClass: Number(value('enemy-ac')),
            initiativeBonus: Number(value('enemy-bonus')),
          },
          undefined,
          () => true,
          failed,
        ),
      );
    };
  }
  function contextChanged() {
    reinforcementRequest++;
    reinforcementBusy = false;
    reinforcementSourceChosen = false;
    reinforcementResults = null;
    if (!reinforcementBooking.busy) closeReinforcements();
    get<HTMLSelectElement>('combat-creature-source').value = '';
    get<HTMLInputElement>('combat-creature-count').value = '1';
    get<HTMLInputElement>('combat-creature-grouped').checked = false;
    get<HTMLInputElement>('combat-creature-search').value = '';
    get<HTMLInputElement>('combat-creature-initiative').value = '';
    get('combat-creature-status').textContent = '';
  }
  editorSession.onDeactivate(contextChanged);
  return {
    open: openReinforcements,
    close: closeReinforcements,
    submit: submitReinforcement,
    confirmed: catalogAdditionConfirmed,
    render: renderReinforcements,
    renderContext,
    lock: lockControls,
    init,
    contextChanged,
    get reading() {
      return reinforcementBusy;
    },
    get booking() {
      return reinforcementBooking.busy;
    },
  };
}
