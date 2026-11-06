import type { Preparation } from '../campaign/preparation-contracts';
import type { WorkspaceGeometry } from '../shared/contracts';
import { createEditorSurface } from '../shared/editor-surface';
import { preserveLiteralEdit } from '../shared/literal-text-edit';
import { agendaCountdown } from './agenda-model';
import { openExistingChase } from './chase-ui';
import type { ChronicleView } from './chronicle-contracts';
import { type LiveView } from './live-contracts';
import type { SessionCloseAudit, SessionResumePrep } from './live-session-readers';
import {
  handoffVisitSeed,
  liveSessionRecap,
  sessionCloseHandoffSuggestion,
} from './live-session-recap';
import { openTreasureDistribution } from './treasury-ui';

export type HandoffVisitDraft = {
  sceneTitle: string;
  recommendedPlanId: string | null;
  beforeVisitId: string | null;
  locationId: string | null;
  locationTitle: string;
  handoff: string;
  noteIds: string[];
  current: () => boolean;
  pending?: boolean;
  notes?: string;
};

type Host = {
  readonly context: WorkspaceGeometry | null;
  readonly data: LiveView | null;
  readonly sources: Preparation | null;
  readonly get: ReturnType<typeof createEditorSurface>['get'];
  readonly document: Document;
  readonly value: (id: string) => string;
  readonly tell: (text: string, error?: boolean) => void;
  readonly sessionChronicle: ChronicleView | null;
  readonly sessionChronicleError: string;
  readonly renderLiveSession: () => void;
  readonly dialogHost: HTMLElement;
  readonly partyAward: () => void;
  readonly readSessionCloseAudit: (
    token: string,
    scenes: LiveView['scenes'],
    events: ReturnType<typeof liveSessionRecap>['entries'],
  ) => Promise<SessionCloseAudit>;
  readonly readSessionResumePrep: (
    token: string,
    scenes: LiveView['scenes'],
    current?: () => boolean,
  ) => Promise<SessionResumePrep>;
  readonly recapFields: (review?: boolean) => import('./live-scene-contracts').SessionRecapDraft;
  readonly recapReadError: () => string | null | undefined;
  readonly queueRecapSave: (text?: import('./live-scene-contracts').SessionRecapDraft) => void;
  readonly recapBindings: () => void;
  readonly markLiveSession: (
    marker: 'start' | 'end',
    summary?: string,
    handoff?: string,
    current?: () => boolean,
  ) => Promise<boolean>;
  readonly openMomentVisit: (
    planId: string | null,
    seed: {
      title: string;
      notes: string;
      locationId: string | null;
      beforeVisitId?: string | null;
      readAloud?: string;
      noteIds?: string[];
      newPlan?: boolean;
    },
    current?: () => boolean,
    openPacket?: boolean,
  ) => Promise<boolean>;
  readonly openExistingCombat: (id: string) => Promise<void>;
  readonly changeFocus: (id: string, current?: () => boolean) => Promise<boolean>;
};

export function createLiveSessionCloseUI(host: Host) {
  let sessionCloseRequest = 0;
  let handoffVisitDraft: HandoffVisitDraft | null = null;
  type SessionCloseOpeningBasis = Omit<HandoffVisitDraft, 'handoff' | 'pending'> & {
    generation: number;
  };
  let sessionCloseOpeningBasis: SessionCloseOpeningBasis | null = null;
  function currentSessionCloseReview() {
    const basis = sessionCloseOpeningBasis;
    return (
      !!basis &&
      basis.generation === sessionCloseRequest &&
      host.get<HTMLDialogElement>('live-session-close-dialog').open &&
      basis.current()
    );
  }
  function renderSessionCloseAudit(audit: SessionCloseAudit, current: () => boolean) {
    const active = host.data?.roster.filter((character) => character.active).length ?? 0,
      groups = host.data?.scenes.length ?? 0;
    host.get('live-session-close-facts').textContent =
      audit.events +
      ' bestätigte Ereignisse · ' +
      active +
      ' aktive Figuren · ' +
      groups +
      ' ' +
      (groups === 1 ? 'Gruppe' : 'Gruppen');
    host.get('live-session-close-xp-status').textContent = audit.xpBooked
      ? 'Spielabend-XP wurden in diesem Rückblick bereits abgerechnet.'
      : 'Für diesen Spielabend ist noch keine XP-Abrechnung im Rückblick erfasst.';
    host.get('live-session-close-loot-status').textContent = audit.treasures.count
      ? audit.treasures.count +
        ' unverteilte ' +
        (audit.treasures.count === 1 ? 'Schatzposition' : 'Schatzpositionen') +
        ' · ' +
        audit.treasures.units +
        ' verfügbare Einheiten' +
        (audit.treasures.more ? ' · weitere Schätze vorhanden' : '')
      : 'Keine unverteilte Beute auf der ersten Schatzseite.';
    const root = host.get('live-session-close-masks');
    root.replaceChildren();
    if (!audit.masks.length) {
      const empty = host.document.createElement('p');
      empty.className = 'caption';
      empty.textContent = 'Keine laufenden Kämpfe oder Verfolgungen.';
      root.append(empty);
      return;
    }
    for (const mask of audit.masks) {
      const card = host.document.createElement('article'),
        text = host.document.createElement('div'),
        title = host.document.createElement('strong'),
        facts = host.document.createElement('p'),
        button = host.document.createElement('button');
      title.textContent = mask.title;
      facts.textContent =
        (mask.kind === 'combat' ? 'Kampf' : 'Verfolgung') +
        ' · ' +
        mask.state +
        ' · ' +
        mask.sceneTitle;
      button.type = 'button';
      button.textContent = 'Öffnen';
      button.onclick = () =>
        void (async () => {
          if (!button.isConnected || !current()) return;
          const basis = sessionCloseOpeningBasis;
          leaveSessionCloseReview();
          const run = sessionCloseRequest;
          if (
            !(await host.changeFocus(
              mask.sceneId,
              () => run === sessionCloseRequest && !!basis?.current(),
            )) ||
            host.data?.scene?.id !== mask.sceneId
          )
            return;
          if (mask.kind === 'combat') {
            await host.openExistingCombat(mask.id);
            host.get('combat-panel').scrollIntoView({ block: 'start' });
          } else {
            await openExistingChase(mask.id);
            host.get('chase-panel').scrollIntoView({ block: 'start' });
          }
        })().catch((error) => host.tell(error.message, true));
      text.append(title, facts);
      card.append(text, button);
      root.append(card);
    }
  }
  async function loadSessionCloseReview(preserveSummary = false) {
    const token = host.context?.token,
      recap = liveSessionRecap(
        host.sessionChronicle?.entries ?? [],
        host.sessionChronicle?.latestSessionMarker,
      ),
      dialog = host.get<HTMLDialogElement>('live-session-close-dialog'),
      scene = host.data?.scene,
      scenes = host.data?.scenes;
    if (
      !token ||
      !scene ||
      !scenes ||
      host.sessionChronicleError ||
      host.recapReadError() ||
      !recap.open
    ) {
      host.renderLiveSession();
      return;
    }
    const run = ++sessionCloseRequest,
      selectedPlan =
        scene.adoption?.planId ||
        host.value('live-session-plan') ||
        host.sources?.selection.planId ||
        host.sources?.plans[0]?.id ||
        null,
      locationId = scene.locationId ?? null;
    const owner = host.context,
      signature = () =>
        JSON.stringify([
          host.data?.focusId,
          host.data?.focusRevision,
          host.data?.rosterRevision,
          host.data?.scene?.id,
          host.data?.scene?.locationId,
          host.data?.scene?.membershipRevision,
          host.data?.scene?.clock,
          host.data?.scenes.map((row) => [row.id, row.membershipRevision, row.clock]),
        ]),
      shown = signature();
    const current = () =>
        host.context === owner && host.context?.token === token && signature() === shown,
      reviewCurrent = () =>
        current() && !host.recapReadError() && run === sessionCloseRequest && dialog.open;
    sessionCloseOpeningBasis = {
      generation: run,
      current,
      sceneTitle: scene.title || 'Unbenannte Gruppe',
      recommendedPlanId: selectedPlan,
      beforeVisitId: null,
      locationId,
      locationTitle:
        host.sources?.locations.find((row) => row.document.id === locationId)?.document.name ||
        'Aktueller Gruppenort',
      noteIds: [],
    };
    if (!preserveSummary) {
      host.get<HTMLTextAreaElement>('live-session-close-summary').value =
        host.value('live-session-summary');
      host.get<HTMLTextAreaElement>('live-session-close-handoff').value =
        host.value('live-session-handoff');
    }
    if (!dialog.open) dialog.showModal();
    dialog.setAttribute('aria-busy', 'true');
    host.get('live-session-close-status').textContent = 'Offene Spielstände werden geprüft…';
    host.get<HTMLButtonElement>('live-session-close-confirm').disabled = true;
    host.get<HTMLButtonElement>('live-session-close-prepare').disabled = true;
    host.get<HTMLButtonElement>('live-session-close-refresh').disabled = true;
    host.get('live-session-close-masks').replaceChildren();
    host.get('live-session-close-suggestion').textContent = '';
    host.get<HTMLButtonElement>('live-session-close-use-suggestion').disabled = true;
    try {
      const [audit, advice] = await Promise.all([
        host.readSessionCloseAudit(token, scenes, recap.entries),
        host
          .readSessionResumePrep(
            token,
            scenes.filter((row) => row.id === scene.id),
            reviewCurrent,
          )
          .then((value) => ({
            value: value.problems.length ? null : value,
            error: value.problems.length ? new Error(value.problems.join(' · ')) : null,
          }))
          .catch((error: Error) => ({ value: null, error })),
      ]);
      if (!reviewCurrent()) {
        if (host.context === owner && run === sessionCloseRequest && dialog.open)
          host.get('live-session-close-status').textContent =
            'Gruppenstand geändert. Erneut prüfen.';
        return;
      }
      renderSessionCloseAudit(audit, reviewCurrent);
      if (advice.value) {
        const prep = advice.value;
        const visit = prep.visits.find((row) => row.sceneId === scene.id),
          world = prep.worlds.find((row) => row.sceneId === scene.id),
          openingLocationId =
            world?.agenda.scene?.locationId ?? world?.frame.scene.locationId ?? locationId,
          localNarratives = prep.narratives.entries.filter(
            (entry) => openingLocationId && entry.view.state.locationId === openingLocationId,
          ),
          journey = world?.frame.journey,
          journeyText =
            journey && !['arrived', 'ended'].includes(journey.status)
              ? ({ active: 'unterwegs', paused: 'pausiert', interrupted: 'angehalten' } as const)[
                  journey.status as 'active' | 'paused' | 'interrupted'
                ] +
                ' · ' +
                Math.max(0, journey.nextIndex - 1) +
                ' / ' +
                Math.max(0, journey.route.length - 1) +
                ' Abschnitte' +
                (journey.reason ? ' · ' + journey.reason : '')
              : null,
          agenda =
            world?.agenda.items.slice(0, 3).map((item) => {
              const delta = String(
                BigInt(item.state === 'active' ? item.endMs : item.startMs) -
                  BigInt(world.agenda.scene?.instantMs ?? '0'),
              );
              return (
                item.event.name +
                ' · ' +
                (item.state === 'active' ? 'jetzt aktiv, noch ' : 'in ') +
                agendaCountdown(world.agenda.calendar, delta)
              );
            }) ?? [],
          narratives = prep.narratives.entries
            .slice(0, 4)
            .map(
              (entry) =>
                (entry.note.title || 'Unbenannter Auftrag') +
                (entry.locationName ? ' · ' + entry.locationName : ''),
            ),
          suggestion = sessionCloseHandoffSuggestion({
            sceneTitle: scene.title,
            locationTitle: world?.agenda.scene?.locationTitle || null,
            masks: audit.masks,
            treasureCount: audit.treasures.count,
            xpBooked: audit.xpBooked,
            nextVisit: visit
              ? { title: visit.nextVisit.title, location: visit.packet?.location }
              : null,
            journey: journeyText,
            agenda,
            narratives,
            notices: world?.frame.notices.slice(0, 3).map((notice) => notice.text) ?? [],
          });
        sessionCloseOpeningBasis = {
          generation: run,
          current,
          sceneTitle: scene.title || 'Unbenannte Gruppe',
          recommendedPlanId: visit?.nextVisit.planId ?? selectedPlan,
          beforeVisitId: visit?.nextVisit.visitId ?? null,
          locationId: openingLocationId,
          locationTitle:
            world?.agenda.scene?.locationTitle ||
            sessionCloseOpeningBasis?.locationTitle ||
            'Aktueller Gruppenort',
          noteIds: localNarratives.slice(0, 20).map((entry) => entry.note.id),
        };
        host.get('live-session-close-suggestion').textContent = suggestion;
        host.get<HTMLButtonElement>('live-session-close-use-suggestion').disabled = false;
      } else
        host.get('live-session-close-suggestion').textContent =
          'Vorschlag nicht verfügbar: ' +
          advice.error?.message +
          '. Eigene Übergabe ist weiterhin möglich.';
      host.get('live-session-close-status').textContent =
        audit.masks.length || audit.treasures.count || !audit.xpBooked
          ? 'Prüfung abgeschlossen. Offene Punkte bleiben erhalten, wenn du den Spielabend jetzt beendest.'
          : 'Alles geprüft. Der Spielabend kann abgeschlossen werden.';
      host.get<HTMLButtonElement>('live-session-close-confirm').disabled = false;
      host.get<HTMLButtonElement>('live-session-close-prepare').disabled = false;
    } catch (error) {
      if (reviewCurrent())
        host.get('live-session-close-status').textContent =
          'Prüfung fehlgeschlagen: ' + (error as Error).message;
    } finally {
      if (run === sessionCloseRequest) {
        dialog.setAttribute('aria-busy', 'false');
        host.get<HTMLButtonElement>('live-session-close-refresh').disabled = false;
      }
    }
  }

  async function finishLiveSession(prepareOpening = false) {
    const token = host.context?.token,
      n = sessionCloseRequest,
      dialog = host.get<HTMLDialogElement>('live-session-close-dialog'),
      basis = sessionCloseOpeningBasis;
    if (
      !token ||
      !dialog.open ||
      host.get<HTMLButtonElement>('live-session-close-confirm').disabled
    )
      return;
    if (!currentSessionCloseReview()) {
      host.get('live-session-close-status').textContent = 'Gruppenstand geändert. Erneut prüfen.';
      return;
    }
    const current = () => basis === sessionCloseOpeningBasis && currentSessionCloseReview();
    const { summary, handoff } = host.recapFields();
    host.get<HTMLButtonElement>('live-session-close-confirm').disabled = true;
    host.get<HTMLButtonElement>('live-session-close-prepare').disabled = true;
    const confirmed = await host.markLiveSession('end', summary, handoff, current);
    if (host.context?.token !== token || n !== sessionCloseRequest || !dialog.open || !current())
      return;
    if (confirmed) {
      sessionCloseRequest++;
      sessionCloseOpeningBasis = null;
      dialog.close();
      if (prepareOpening && basis) openHandoffVisit({ ...basis, handoff });
    } else {
      host.get<HTMLButtonElement>('live-session-close-confirm').disabled = false;
      host.get<HTMLButtonElement>('live-session-close-prepare').disabled = false;
    }
  }
  function openHandoffVisit(draft: HandoffVisitDraft) {
    if (!draft.current()) return;
    draft.notes = draft.handoff;
    handoffVisitDraft = draft;
    host.get<HTMLFormElement>('handoff-visit-form').inert = false;
    const seed = handoffVisitSeed(draft.handoff, draft.sceneTitle),
      plans = host.get<HTMLSelectElement>('handoff-visit-plan');
    plans.replaceChildren(new Option('Neuen Plan „Nächster Spielabend“ anlegen', ''));
    for (const plan of host.sources?.plans ?? [])
      plans.add(new Option(plan.name || 'Unbenannter Plan', plan.id));
    if (
      draft.recommendedPlanId &&
      ![...plans.options].some((option) => option.value === draft.recommendedPlanId)
    )
      plans.add(
        new Option(
          'Bisher gewählter Spielabend · Verfügbarkeit wird geprüft',
          draft.recommendedPlanId,
        ),
      );
    plans.value = draft.recommendedPlanId ?? '';
    host.get<HTMLInputElement>('handoff-visit-title').value = seed.title;
    host.get<HTMLTextAreaElement>('handoff-visit-read-aloud').value = '';
    host.get<HTMLTextAreaElement>('handoff-visit-notes').value = seed.notes;
    host.get('handoff-visit-location').textContent = draft.locationId
      ? 'Ort: ' + draft.locationTitle
      : 'Ohne Ortsbindung';
    host.get('handoff-visit-sources').textContent = draft.noteIds.length
      ? draft.noteIds.length +
        ' offene Ortsquelle' +
        (draft.noteIds.length === 1 ? '' : 'n') +
        ' werden an die Mappe gebunden.'
      : 'Keine offene Ortsquelle zum Binden.';
    host.get('handoff-visit-status').textContent = '';
    host.get<HTMLDialogElement>('handoff-visit-dialog').showModal();
    host.get<HTMLInputElement>('handoff-visit-title').focus();
  }
  function initHandoffVisitDialog() {
    const dialog = host.document.createElement('dialog');
    dialog.id = 'handoff-visit-dialog';
    dialog.innerHTML =
      '<form id="handoff-visit-form"><h2>Übergabe als Einstieg vorbereiten</h2><label>Spielabendplan<select id="handoff-visit-plan"></select></label><label>Titel<input id="handoff-visit-title" maxlength="1000" required></label><p id="handoff-visit-location" class="caption"></p><label>Zum Vorlesen<textarea id="handoff-visit-read-aloud" rows="4" placeholder="Was hören die Spieler zu Beginn?"></textarea></label><label>Private GM-Notizen<textarea id="handoff-visit-notes" rows="8"></textarea></label><p id="handoff-visit-sources" class="caption"></p><p class="caption">Im vorgeschlagenen Plan wird der Einstieg vor den nächsten Besuch gesetzt, in einem anderen Plan am Ende. Vorlesetext bleibt privat, bis du ihn am Spieltisch ausdrücklich freigibst.</p><p id="handoff-visit-status" role="status"></p><div class="toolbar"><button type="submit">Einstieg vorbereiten</button><button id="handoff-visit-open" type="submit">Vorbereiten + Mappe öffnen</button><button id="handoff-visit-cancel" type="button">Abbrechen</button></div></form>';
    host.dialogHost.append(dialog);
    const close = () => {
      handoffVisitDraft = null;
      dialog.close();
    };
    host.get('handoff-visit-notes').addEventListener('input', () => {
      const draft = handoffVisitDraft;
      if (draft && !draft.pending && draft.current())
        draft.notes = preserveLiteralEdit(
          draft.notes ?? draft.handoff,
          host.value('handoff-visit-notes'),
        );
    });
    host.get('handoff-visit-cancel').onclick = close;
    dialog.addEventListener('cancel', () => {
      handoffVisitDraft = null;
    });
    host.get<HTMLFormElement>('handoff-visit-form').onsubmit = (event) => {
      event.preventDefault();
      const draft = handoffVisitDraft;
      if (!draft || !draft.current() || draft.pending) return;
      if (host.get<HTMLSelectElement>('handoff-visit-plan').selectedIndex < 0) {
        host.get('handoff-visit-status').textContent =
          'Zielplan auswählen oder ausdrücklich einen neuen Plan anlegen.';
        return;
      }
      const planId = host.value('handoff-visit-plan') || null,
        form = host.get<HTMLFormElement>('handoff-visit-form'),
        openPacket = (event.submitter as HTMLElement | null)?.id === 'handoff-visit-open';
      draft.pending = true;
      form.inert = true;
      host.get('handoff-visit-status').textContent = 'Einstieg und Mappe werden gespeichert…';
      void host
        .openMomentVisit(
          planId,
          {
            title: host.value('handoff-visit-title'),
            notes: preserveLiteralEdit(
              draft.notes ?? draft.handoff,
              host.value('handoff-visit-notes'),
            ),
            readAloud: host.value('handoff-visit-read-aloud'),
            noteIds: draft.noteIds,
            locationId: draft.locationId,
            newPlan: planId === null,
            beforeVisitId: planId === draft.recommendedPlanId ? draft.beforeVisitId : null,
          },
          () => handoffVisitDraft === draft && draft.current(),
          openPacket,
        )
        .then((opened) => {
          if (handoffVisitDraft === draft && draft.current()) {
            close();
            host.tell(
              openPacket
                ? opened
                  ? 'Übergabe vorbereitet und GM-Mappe geöffnet.'
                  : 'Übergabe vorbereitet; GM-Mappe konnte nicht geöffnet werden.'
                : 'Übergabe als vollständiger nächster Besuch vorbereitet.',
              openPacket && !opened,
            );
          }
        })
        .catch((error) => {
          if (handoffVisitDraft === draft && draft.current())
            host.get('handoff-visit-status').textContent = (error as Error).message;
        })
        .finally(() => {
          if (handoffVisitDraft === draft) {
            draft.pending = false;
            if (form.isConnected) form.inert = false;
          }
        });
    };
  }
  function leaveSessionCloseReview() {
    host.get<HTMLTextAreaElement>('live-session-summary').value = host.value(
      'live-session-close-summary',
    );
    host.get<HTMLTextAreaElement>('live-session-handoff').value = host.value(
      'live-session-close-handoff',
    );
    sessionCloseOpeningBasis = null;
    sessionCloseRequest++;
    host.get<HTMLDialogElement>('live-session-close-dialog').close();
  }

  function init() {
    initHandoffVisitDialog();
    const closeDialog = host.document.createElement('dialog');
    closeDialog.id = 'live-session-close-dialog';
    closeDialog.innerHTML =
      '<div class="toolbar"><h2>Spielabend abschließen</h2><button id="live-session-close-x" type="button">Schließen</button></div><p id="live-session-close-status" role="status"></p><p id="live-session-close-facts" class="session-close-facts"></p><section><h3>Laufende Szenen</h3><div id="live-session-close-masks"></div></section><section class="session-close-check"><div><h3>Spielabend-XP</h3><p id="live-session-close-xp-status"></p></div><button id="live-session-close-xp" type="button">XP abrechnen…</button></section><section class="session-close-check"><div><h3>Beute</h3><p id="live-session-close-loot-status"></p></div><button id="live-session-close-loot" type="button">Beute verteilen…</button></section><section class="session-close-suggestion"><div class="toolbar"><h3>Vorschlag für den nächsten Einstieg</h3><button id="live-session-close-use-suggestion" type="button">Vorschlag übernehmen</button></div><pre id="live-session-close-suggestion"></pre></section><p id="live-session-close-draft-status" class="caption" role="status"></p><button id="live-session-close-draft-retry" type="button" hidden>Eigene Fassung erneut sichern…</button><label>Rückblick<textarea id="live-session-close-summary" maxlength="10000" placeholder="Was ist heute geschehen?"></textarea></label><label>Nächster Spielabend<textarea id="live-session-close-handoff" maxlength="10000" placeholder="Einstieg, offene Szenen und Vorbereitung"></textarea></label><p class="caption">Offene Kämpfe, Verfolgungen und Beute bleiben nach dem Abschluss erhalten.</p><div class="toolbar"><button id="live-session-close-refresh" type="button">Erneut prüfen</button><span class="grow"></span><button id="live-session-close-cancel" type="button">Abbrechen</button><button id="live-session-close-confirm" type="button">Spielabend jetzt beenden</button><button id="live-session-close-prepare" type="button">Beenden + Einstieg vorbereiten…</button></div>';
    host.dialogHost.append(closeDialog);
    for (const id of ['live-session-close-x', 'live-session-close-cancel'])
      host.get<HTMLButtonElement>(id).onclick = () => {
        leaveSessionCloseReview();
      };
    host.get('live-session-close-refresh').onclick = () => void loadSessionCloseReview(true);
    host.get('live-session-close-confirm').onclick = () => void finishLiveSession();
    host.get('live-session-close-prepare').onclick = () => void finishLiveSession(true);
    host.get('live-session-close-xp').onclick = () => {
      if (!currentSessionCloseReview()) return;
      leaveSessionCloseReview();
      host.partyAward();
    };
    host.get('live-session-close-loot').onclick = () => {
      if (!currentSessionCloseReview()) return;
      leaveSessionCloseReview();
      void openTreasureDistribution(undefined, host.data?.scene?.id).catch((error) =>
        host.tell(error.message, true),
      );
    };
    host.get('live-session-close-use-suggestion').onclick = () => {
      if (
        !currentSessionCloseReview() ||
        closeDialog.getAttribute('aria-busy') === 'true' ||
        host.get<HTMLButtonElement>('live-session-close-use-suggestion').disabled
      )
        return;
      host.get<HTMLTextAreaElement>('live-session-close-handoff').value =
        host.get('live-session-close-suggestion').textContent ?? '';
      host.queueRecapSave();
    };
    closeDialog.addEventListener('cancel', leaveSessionCloseReview);
    host.recapBindings();
  }

  function reset() {
    sessionCloseRequest++;
    sessionCloseOpeningBasis = null;
    handoffVisitDraft = null;
    for (const id of ['live-session-close-dialog', 'handoff-visit-dialog']) {
      const dialog = host.get(id) as HTMLDialogElement | null;
      if (dialog?.open) dialog.close();
    }
  }

  return { init, reset, loadSessionCloseReview, initHandoffVisitDialog, openHandoffVisit };
}
