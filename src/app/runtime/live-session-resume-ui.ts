import type { Preparation } from '../campaign/preparation-contracts';
import type { SessionPacketVisit } from '../campaign/session-packet-contracts';
import { selectLivePacketVisit } from '../campaign/session-packet-ui';
import type { Result, WorkspaceGeometry } from '../shared/contracts';
import { createEditorSurface } from '../shared/editor-surface';
import { agendaCountdown } from './agenda-model';
import { openExistingChase } from './chase-ui';
import type { ChronicleView } from './chronicle-contracts';
import { type LiveView } from './live-contracts';
import type { HandoffVisitDraft } from './live-session-close-ui';
import type {
  SessionCloseAudit,
  SessionCloseMask,
  SessionResumePrep,
  SessionResumeVisit,
} from './live-session-readers';
import { latestCompletedSessionHandoff, liveSessionRecap } from './live-session-recap';
import { openNarrativeJournal } from './narrative-journal-ui';
import { openTreasureDistribution } from './treasury-ui';

type Host = {
  readonly openPartyRest: (sceneId: string) => Promise<void>;
  readonly openLive: (planId?: string, visitId?: string) => Promise<boolean | undefined>;
  readonly readAloudText: string;
  readonly useKnowledgeReadAloud: (text: string, title: string) => void;
  readonly groupPeople: (id: string) => string;
  readonly openHandoffVisit: (draft: HandoffVisitDraft) => void;
  readonly context: WorkspaceGeometry | null;
  readonly data: LiveView | null;
  readonly sources: Preparation | null;
  readonly get: ReturnType<typeof createEditorSurface>['get'];
  readonly document: Document;
  readonly window: { campaign: Window['campaign']; confirm: (message: string) => boolean };
  readonly unwrap: <T>(result: Result<T>) => T;
  readonly tell: (text: string, error?: boolean) => void;
  readonly flushLive: () => Promise<boolean>;
  readonly sessionChronicle: ChronicleView | null;
  readonly sessionChronicleError: string;
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
  readonly openExistingCombat: (id: string) => Promise<void>;
  readonly changeFocus: (id: string, current?: () => boolean) => Promise<boolean>;
  readonly startLiveSession: (sceneId?: string, current?: () => boolean) => Promise<boolean>;
  readonly openLocationNotebook: (id: string, current?: () => boolean) => Promise<void>;
  readonly openLivePacket: () => Promise<void>;
  readonly formatSceneInstant: (ms: string) => string;
};

export function createLiveSessionResumeUI(host: Host) {
  let sessionResumeRequest = 0;
  let sessionResumeButton: HTMLButtonElement;
  interface ResumeLease {
    current: () => boolean;
    dismiss: () => void;
    focus: (id: string) => Promise<boolean>;
  }
  async function openMaskFromResume(mask: SessionCloseMask, lease: ResumeLease) {
    lease.dismiss();
    if (!(await lease.focus(mask.sceneId))) return;
    if (mask.kind === 'combat') {
      await host.openExistingCombat(mask.id);
      if (lease.current()) host.get('combat-panel').scrollIntoView({ block: 'start' });
    } else {
      await openExistingChase(mask.id);
      if (lease.current()) host.get('chase-panel').scrollIntoView({ block: 'start' });
    }
  }

  async function checkedResumeVisit(row: SessionResumeVisit, lease: ResumeLease) {
    if (!lease.current()) return false;
    if (!row.packet || !row.packetBasis)
      throw new Error('Besuchsmappe nicht verfügbar. Wiederaufnahme erneut laden.');
    const packet = host.unwrap(
      await host.window.campaign.sessionPacket(host.context!.token, row.nextVisit.planId),
    );
    if (!lease.current()) return false;
    if (
      packet.planId !== row.nextVisit.planId ||
      packet.planRevision !== row.nextVisit.planRevision ||
      packet.basis !== row.packetBasis ||
      !packet.visits.some((v) => v.id === row.nextVisit.visitId)
    )
      throw new Error(
        'Die angezeigte Vorbereitung wurde geändert. Dialog schließen, erneut öffnen und Aktion neu wählen.',
      );
    return true;
  }
  async function openVisitFromResume(row: SessionResumeVisit, lease: ResumeLease) {
    if (!(await checkedResumeVisit(row, lease))) return;
    lease.dismiss();
    if (!(await lease.focus(row.sceneId))) return;
    if (!(await host.openLive(row.nextVisit.planId, row.nextVisit.visitId)) || !lease.current())
      return;
    host.get<HTMLDetailsElement>('adoption-picker').open = true;
    host.get<HTMLButtonElement>('adoption-preview').click();
  }
  async function openPacketFromResume(row: SessionResumeVisit, lease: ResumeLease) {
    if (!(await checkedResumeVisit(row, lease))) return;
    lease.dismiss();
    if (!(await lease.focus(row.sceneId))) return;
    const plan = host.get<HTMLSelectElement>('live-session-plan');
    plan.value = row.nextVisit.planId;
    plan.dispatchEvent(new Event('change'));
    await host.openLivePacket();
    if (!lease.current()) return;
    selectLivePacketVisit(row.nextVisit.visitId);
  }
  async function startOpeningFromResume(
    row: SessionResumeVisit,
    readAloud: string | null,
    lease: ResumeLease,
  ) {
    if (!(await checkedResumeVisit(row, lease))) return;
    lease.dismiss();
    if (!(await lease.focus(row.sceneId))) return;
    const originalText = host.readAloudText;
    if (
      !(await host.startLiveSession(undefined, lease.current)) ||
      !lease.current() ||
      host.data?.scene?.id !== row.sceneId
    )
      return;
    if (host.readAloudText !== originalText)
      throw new Error(
        'Spielabend läuft. Neuere eigene Prosa bleibt erhalten; den Eröffnungstext erneut ausdrücklich wählen.',
      );
    if (readAloud) {
      host.useKnowledgeReadAloud(readAloud, row.nextVisit.title || 'Eröffnung');
      if (!(await host.flushLive()))
        throw new Error('Spielabend läuft, aber der Eröffnungstext ist noch nicht gespeichert.');
      if (!lease.current()) return;
    }
    const plan = host.get<HTMLSelectElement>('live-session-plan');
    plan.value = row.nextVisit.planId;
    plan.dispatchEvent(new Event('change'));
    await host.openLivePacket();
    if (!lease.current()) return;
    selectLivePacketVisit(row.nextVisit.visitId);
    host.get('live-session-result').textContent =
      'Spielabend begonnen. Die Eröffnung liegt am Szenentisch bereit; Spielerfreigabe und Besuchsübernahme bleiben getrennt.';
  }
  async function openWorldFromResume(
    sceneId: string,
    target: 'travel' | 'agenda',
    lease: ResumeLease,
  ) {
    lease.dismiss();
    if (!(await lease.focus(sceneId))) return;
    if (target === 'agenda') host.get<HTMLButtonElement>('live-agenda-open').click();
    else {
      const button = host.get<HTMLButtonElement>('live-travel-toggle');
      if (button.getAttribute('aria-expanded') !== 'true') button.click();
      host.get('live-world-panel').scrollIntoView({ block: 'start' });
    }
  }

  async function openReadinessFromResume(
    sceneId: string,
    target: 'party' | 'rest',
    lease: ResumeLease,
  ) {
    lease.dismiss();
    if (!(await lease.focus(sceneId))) return;
    if (target === 'rest') await host.openPartyRest(sceneId);
    else {
      const reference = host.get('live-party-reference');
      reference.scrollIntoView({ block: 'start' });
      reference.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    }
  }

  function renderSessionResume(
    audit: SessionCloseAudit,
    prep: SessionResumePrep,
    auditProblem?: string,
  ) {
    const dialog = host.get<HTMLDialogElement>('live-session-resume-dialog'),
      owner = host.context,
      token = owner?.token,
      campaignId = owner?.campaign.id,
      run = sessionResumeRequest;
    const signature = () =>
      JSON.stringify([
        host.data?.focusId,
        host.data?.focusRevision,
        host.data?.scene?.id,
        host.data?.scene?.membershipRevision,
        host.data?.scene?.locationId,
        host.data?.scene?.clock,
      ]);
    const shown = signature();
    let busy = false;
    const bind = (
      button: HTMLButtonElement,
      action: (lease: ResumeLease) => Promise<unknown>,
      targetId = host.data?.scene?.id,
    ) => {
      const targetSignature = () => {
          const scene = host.data?.scenes.find((scene) => scene.id === targetId);
          return JSON.stringify(
            scene
              ? [
                  scene.id,
                  scene.title,
                  scene.primary,
                  scene.members,
                  scene.membershipRevision,
                  scene.clock.epochId,
                  scene.clock.revision,
                  scene.clock.instantMs,
                ]
              : null,
          );
        },
        targetShown = targetSignature();
      button.onclick = () => {
        if (
          button.disabled ||
          busy ||
          !button.isConnected ||
          !dialog.open ||
          host.context !== owner ||
          host.context?.token !== token ||
          host.context?.campaign.id !== campaignId ||
          run !== sessionResumeRequest ||
          signature() !== shown ||
          targetSignature() !== targetShown
        )
          return;
        busy = true;
        button.disabled = true;
        host.get('live-session-resume-status').textContent = 'Die angezeigte Auswahl wird geprüft…';
        let stamp = run,
          dismissed = false,
          expected = shown;
        const alive = () =>
          host.context === owner &&
          host.context?.token === token &&
          host.context?.campaign.id === campaignId &&
          sessionResumeRequest === stamp;
        const current = () =>
          alive() &&
          (dismissed || dialog.open) &&
          signature() === expected &&
          targetSignature() === targetShown;
        const lease: ResumeLease = {
          current,
          dismiss: () => {
            if (!current()) return;
            stamp = ++sessionResumeRequest;
            dismissed = true;
            dialog.close();
          },
          focus: async (id) => {
            if (!current()) return false;
            if (host.data?.focusId !== id) {
              if (!(await host.changeFocus(id, current)) || !alive() || host.data?.focusId !== id)
                return false;
              expected = signature();
            }
            return current() && host.data?.scene?.id === id;
          },
        };
        void Promise.resolve()
          .then(() => {
            if (current()) return action(lease);
          })
          .catch((error) => {
            if (current()) {
              if (dialog.open)
                host.get('live-session-resume-status').textContent = (error as Error).message;
              host.tell((error as Error).message, true);
            }
          })
          .finally(() => {
            if (alive()) {
              busy = false;
              button.disabled = false;
            }
          });
      };
    };
    const groups = host.get('live-session-resume-groups'),
      readiness = host.get('live-session-resume-readiness'),
      masks = host.get('live-session-resume-masks'),
      visits = host.get('live-session-resume-visits'),
      narratives = host.get('live-session-resume-narratives'),
      worlds = host.get('live-session-resume-worlds');
    groups.replaceChildren();
    readiness.replaceChildren();
    masks.replaceChildren();
    visits.replaceChildren();
    narratives.replaceChildren();
    worlds.replaceChildren();
    host.get('live-session-resume-handoff').textContent =
      latestCompletedSessionHandoff(
        host.sessionChronicle?.entries ?? [],
        host.sessionChronicle?.latestSessionMarker,
      ) || 'Keine Übergabe aus dem letzten Spielabend.';
    for (const group of host.data?.scenes ?? []) {
      const card = host.document.createElement('article'),
        body = host.document.createElement('div'),
        title = host.document.createElement('strong'),
        facts = host.document.createElement('p'),
        button = host.document.createElement('button'),
        open = audit.masks.filter((mask) => mask.sceneId === group.id);
      title.textContent =
        (group.title || 'Unbenannte Gruppe') + (group.primary ? ' · Hauptgruppe' : '');
      facts.textContent =
        host.groupPeople(group.id) +
        ' · ' +
        host.formatSceneInstant(group.clock.instantMs) +
        (open.length
          ? ' · ' + open.length + ' laufende ' + (open.length === 1 ? 'Szene' : 'Szenen')
          : '');
      button.type = 'button';
      button.textContent = 'Spielabend hier beginnen';
      bind(
        button,
        async (lease) => {
          lease.dismiss();
          if (await lease.focus(group.id)) await host.startLiveSession(undefined, lease.current);
        },
        group.id,
      );
      body.append(title, facts);
      card.append(body, button);
      const details = host.document.createElement('details'),
        summary = host.document.createElement('summary'),
        briefing = host.document.createElement('div'),
        actions = host.document.createElement('div'),
        party = prep.readiness.find((r) => r.sceneId === group.id),
        world = prep.worlds.find((r) => r.sceneId === group.id),
        visit = prep.visits.find((r) => r.sceneId === group.id),
        locationId = world?.agenda.scene?.locationId ?? world?.frame.scene.locationId ?? null;
      const issues =
          (party?.characters.filter((c) => c.warning).length ?? 0) +
          open.length +
          (world?.frame.notices.length ?? 0) +
          (visit?.warnings.length ?? 0) +
          (!prep.readinessAvailable || !party?.characters.length ? 1 : 0) +
          (!world ? 1 : 0) +
          (!prep.narrativesAvailable ? 1 : 0) +
          (auditProblem ? 1 : 0),
        state = host.document.createElement('strong');
      state.className = issues ? 'session-resume-briefing-alert' : 'session-resume-briefing-ready';
      state.textContent =
        auditProblem ||
        !prep.readinessAvailable ||
        !world ||
        !prep.narrativesAvailable ||
        prep.problems.length
          ? 'Stand unvollständig'
          : issues
            ? issues + ' Punkte prüfen'
            : 'Startklar';
      card.append(state);
      briefing.className = 'session-resume-briefing-grid';
      card.className = 'session-resume-briefing';
      summary.textContent = 'Startbriefing anzeigen';
      details.open = group.id === host.data?.focusId;
      const section = (heading: string, lines: string[]) => {
        const block = host.document.createElement('section'),
          h = host.document.createElement('strong'),
          list = host.document.createElement('ul');
        h.textContent = heading;
        for (const text of lines) {
          const item = host.document.createElement('li');
          item.textContent = text;
          list.append(item);
        }
        block.append(h, list);
        briefing.append(block);
      };
      const handoff = latestCompletedSessionHandoff(
        host.sessionChronicle?.entries ?? [],
        host.sessionChronicle?.latestSessionMarker,
      );
      section('Übergabe', [handoff || 'Keine Übergabe aus dem letzten Spielabend.']);
      section(
        'Party',
        !prep.readinessAvailable
          ? ['Gruppenbereitschaft noch nicht geprüft.']
          : party?.characters.length
            ? party.characters.map((c) => c.name + ' · ' + c.health + ' · ' + c.progress)
            : ['Leere Party'],
      );
      section(
        'Weltlage',
        world
          ? [
              world.frame.date + ' · ' + (world.agenda.scene?.locationTitle || 'Ohne Ortsbindung'),
              world.frame.weather ? world.frame.weather.label : 'Kein Wetter',
              world.frame.journey
                ? 'Reise · ' + world.frame.journey.status
                : 'Keine laufende Reise.',
              ...world.agenda.items.slice(0, 3).map((i) => i.event.name + ' · ' + i.state),
              ...world.frame.notices.slice(0, 3).map((n) => 'Offene Weltentscheidung · ' + n.text),
            ]
          : ['Weltlage noch nicht geprüft.'],
      );
      const readAloud = visit?.packet?.blocks.find((b) => b.kind === 'read-aloud');
      section(
        'Einstieg',
        visit
          ? [
              visit.nextVisit.title,
              readAloud?.text || 'Kein vorbereiteter Vorlesetext.',
              ...visit.warnings,
            ]
          : ['Kein weiterer vorbereiteter Besuch.'],
      );
      const narratives = prep.narratives.entries.filter(
        (e) => locationId && e.view.state.locationId === locationId,
      );
      section(
        'Offene Fäden',
        !prep.narrativesAvailable
          ? ['Auftragsjournal noch nicht geprüft.']
          : narratives.length
            ? narratives.slice(0, 5).map((e) => e.note.title)
            : ['Keine offenen Aufträge oder Gerüchte an diesem Ort.'],
      );
      section(
        'Laufende Szenen',
        auditProblem
          ? ['Laufende Szenen noch nicht geprüft.']
          : open.length
            ? open.map((m) => (m.kind === 'combat' ? 'Kampf' : 'Verfolgung') + ' · ' + m.title)
            : ['Keine laufenden Kämpfe oder Verfolgungen.'],
      );
      const add = (label: string, work: (lease: ResumeLease) => Promise<unknown>) => {
        const b = host.document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        bind(b, work, group.id);
        actions.append(b);
      };
      if (visit) {
        add(
          readAloud ? 'Spielabend beginnen + Text in Szene' : 'Spielabend beginnen + Mappe',
          (lease) => startOpeningFromResume(visit, readAloud?.text ?? null, lease),
        );
        add('Mappe öffnen', (lease) => openPacketFromResume(visit, lease));
      }
      if (handoff.trim()) {
        const planId =
          visit?.nextVisit.planId ??
          (host.data?.scene?.id === group.id ? host.data.scene.adoption?.planId : null) ??
          host.sources?.selection.planId ??
          host.sources?.plans[0]?.id ??
          null;
        add('Einstieg aus Übergabe vorbereiten…', async (lease) => {
          lease.dismiss();
          if (!(await lease.focus(group.id))) return;
          host.openHandoffVisit({
            sceneTitle: group.title || 'Unbenannte Gruppe',
            recommendedPlanId: planId,
            beforeVisitId: visit?.nextVisit.visitId ?? null,
            locationId,
            locationTitle: world?.agenda.scene?.locationTitle || 'Aktueller Gruppenort',
            handoff,
            noteIds: narratives.slice(0, 20).map((entry) => entry.note.id),
            current: lease.current,
          });
        });
      }
      if (locationId)
        add('Ortsmappe öffnen', async (lease) => {
          lease.dismiss();
          if (await lease.focus(group.id))
            await host.openLocationNotebook(locationId, lease.current);
        });
      add('Partywerte öffnen', (lease) => openReadinessFromResume(group.id, 'party', lease));
      add('Agenda öffnen', (lease) => openWorldFromResume(group.id, 'agenda', lease));
      actions.className = 'toolbar';
      details.append(summary, briefing);
      card.append(details, actions);
      groups.append(card);
    }
    for (const group of prep.readiness ?? []) {
      const card = host.document.createElement('article'),
        title = host.document.createElement('strong'),
        list = host.document.createElement('ul'),
        actions = host.document.createElement('div');
      title.textContent = group.sceneTitle;
      for (const character of group.characters) {
        const item = host.document.createElement('li'),
          name = host.document.createElement('strong'),
          facts = host.document.createElement('span');
        name.textContent = character.name;
        facts.textContent = character.health + ' · ' + character.progress;
        if (character.warning) item.className = 'session-resume-character-warning';
        item.append(name, facts);
        list.append(item);
      }
      if (!group.characters.length) {
        const item = host.document.createElement('li');
        item.className = 'caption';
        item.textContent = 'Leere Party – die Szene bleibt als Startgruppe verfügbar.';
        list.append(item);
      }
      for (const [label, target] of [
        ['Partywerte öffnen', 'party'],
        ['Rast planen…', 'rest'],
      ] as const) {
        const button = host.document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        bind(
          button,
          (lease) => openReadinessFromResume(group.sceneId, target, lease),
          group.sceneId,
        );
        actions.append(button);
      }
      actions.className = 'toolbar';
      card.append(title, list, actions);
      readiness.append(card);
    }
    if (prep.readinessAvailable === false) {
      const missing = host.document.createElement('p');
      missing.textContent = 'Partywerte konnten noch nicht geprüft werden.';
      readiness.append(missing);
    }
    for (const mask of audit.masks) {
      const card = host.document.createElement('article'),
        body = host.document.createElement('div'),
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
      bind(button, (lease) => openMaskFromResume(mask, lease), mask.sceneId);
      body.append(title, facts);
      card.append(body, button);
      masks.append(card);
    }
    if (!audit.masks.length) {
      const empty = host.document.createElement('p');
      empty.className = 'caption';
      empty.textContent = auditProblem
        ? 'Laufende Kämpfe und Verfolgungen konnten nicht geprüft werden: ' + auditProblem
        : 'Keine laufenden Kämpfe oder Verfolgungen.';
      masks.append(empty);
    }
    for (const sourceRow of prep.visits) {
      const row = structuredClone(sourceRow);
      const card = host.document.createElement('article'),
        body = host.document.createElement('div'),
        title = host.document.createElement('strong'),
        facts = host.document.createElement('p'),
        actions = host.document.createElement('div');
      card.className = 'session-resume-visit';
      title.textContent = row.nextVisit.title || 'Unbenannter Besuch';
      facts.textContent =
        (row.fallback
          ? 'Vorgeschlagener Einstieg aus „' + row.planName + '“'
          : 'Nächster vorbereiteter Besuch') +
        ' · ' +
        row.sceneTitle +
        (row.packet?.location ? ' · ' + row.packet.location : '');
      body.append(title, facts);
      card.append(body);
      const readAloud = row.packet?.blocks.find((block) => block.kind === 'read-aloud');
      if (readAloud) {
        const details = host.document.createElement('details'),
          summary = host.document.createElement('summary'),
          quote = host.document.createElement('blockquote'),
          heading = host.document.createElement('strong'),
          text = host.document.createElement('p');
        summary.textContent = 'Eröffnungstext aufklappen';
        heading.textContent = readAloud.heading;
        text.textContent = readAloud.text;
        quote.append(heading, text);
        details.append(summary, quote);
        card.append(details);
      } else {
        const missing = host.document.createElement('p');
        missing.className = 'caption';
        missing.textContent = 'Noch kein vorbereiteter Eröffnungstext.';
        card.append(missing);
      }
      if (row.packet) {
        const counts = new Map<SessionPacketVisit['blocks'][number]['kind'], number>();
        for (const block of row.packet.blocks)
          counts.set(block.kind, (counts.get(block.kind) ?? 0) + 1);
        const inventory = host.document.createElement('p');
        inventory.className = 'caption';
        inventory.textContent =
          [
            counts.get('gm') && counts.get('gm') + ' GM-Hinweise',
            counts.get('reference') && counts.get('reference') + ' Referenzen',
            counts.get('encounter') && counts.get('encounter') + ' Begegnungsblöcke',
            counts.get('reward') && counts.get('reward') + ' Belohnungen',
          ]
            .filter(Boolean)
            .join(' · ') || 'Keine weiteren Mappenblöcke.';
        card.append(inventory);
      }
      if (row.warnings.length) {
        const warning = host.document.createElement('p');
        warning.className = 'session-resume-warning';
        warning.textContent =
          row.warnings.length +
          ' offene Mappenquelle' +
          (row.warnings.length === 1 ? '' : 'n') +
          ' · ' +
          row.warnings.slice(0, 2).join(' · ');
        card.append(warning);
      }
      for (const [label, action] of [
        ['Übernahme prüfen', (lease: ResumeLease) => openVisitFromResume(row, lease)],
        ['Mappe öffnen', (lease: ResumeLease) => openPacketFromResume(row, lease)],
        [
          readAloud ? 'Spielabend beginnen + Text in Szene' : 'Spielabend beginnen + Mappe',
          (lease: ResumeLease) => startOpeningFromResume(row, readAloud?.text ?? null, lease),
        ],
      ] as const) {
        const button = host.document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        bind(button, action, row.sceneId);
        if (!row.packet || !row.packetBasis) button.disabled = true;
        if (label.startsWith('Spielabend beginnen')) button.className = 'session-resume-start';
        actions.append(button);
      }
      actions.className = 'toolbar';
      card.append(actions);
      visits.append(card);
    }
    if (!prep.visits.length) {
      const empty = host.document.createElement('p');
      empty.className = 'caption';
      empty.textContent = prep.problems?.length
        ? 'Vorbereitete Besuche konnten nicht vollständig geprüft werden.'
        : host.sources?.plans.some((plan) => plan.scenes.length)
          ? 'Alle vorbereiteten Besuche wurden für diese Gruppen abgeschlossen oder übersprungen.'
          : 'Noch kein Spielabendplan mit Besuchen vorbereitet.';
      visits.append(empty);
    }
    for (const row of prep.worlds) {
      const card = host.document.createElement('article'),
        heading = host.document.createElement('div'),
        title = host.document.createElement('strong'),
        facts = host.document.createElement('p'),
        details = host.document.createElement('p'),
        events = host.document.createElement('ul'),
        actions = host.document.createElement('div');
      title.textContent = row.sceneTitle;
      facts.textContent = [
        row.frame.date,
        row.agenda.scene?.locationTitle || 'Ohne Ortsbindung',
        row.frame.weather
          ? row.frame.weather.label + ' · ' + row.frame.weather.effects.temperatureC + ' °C'
          : 'Kein Wetter',
      ].join(' · ');
      const journey = row.frame.journey;
      details.textContent =
        journey && !['arrived', 'ended'].includes(journey.status)
          ? 'Reise ' +
            ({ active: 'unterwegs', paused: 'pausiert', interrupted: 'angehalten' } as const)[
              journey.status as 'active' | 'paused' | 'interrupted'
            ] +
            ' · ' +
            Math.max(0, journey.nextIndex - 1) +
            ' / ' +
            Math.max(0, journey.route.length - 1) +
            ' Abschnitte' +
            (journey.reason ? ' · ' + journey.reason : '')
          : row.frame.weather?.effects.combatNote || 'Keine laufende Reise.';
      for (const item of row.agenda.items.slice(0, 3)) {
        const li = host.document.createElement('li'),
          delta = String(
            BigInt(item.state === 'active' ? item.endMs : item.startMs) -
              BigInt(row.agenda.scene?.instantMs ?? '0'),
          );
        li.textContent =
          item.event.name +
          ' · ' +
          (item.state === 'active' ? 'jetzt aktiv, noch ' : 'in ') +
          agendaCountdown(row.agenda.calendar, delta);
        events.append(li);
      }
      if (!events.childElementCount) {
        const li = host.document.createElement('li');
        li.textContent = 'Keine Ereignisse am Gruppenort in den nächsten zwei Tagen.';
        events.append(li);
      }
      if (row.frame.notices.length) {
        const notice = host.document.createElement('p');
        notice.className = 'session-resume-warning';
        notice.textContent =
          row.frame.notices.length +
          ' offene ' +
          (row.frame.notices.length === 1 ? 'Weltentscheidung' : 'Weltentscheidungen') +
          ' · ' +
          row.frame.notices
            .slice(0, 2)
            .map((n) => n.text)
            .join(' · ');
        card.append(notice);
      }
      for (const [label, target] of [
        ['Reisekarte öffnen', 'travel'],
        ['Agenda öffnen', 'agenda'],
      ] as const) {
        const button = host.document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        bind(button, (lease) => openWorldFromResume(row.sceneId, target, lease), row.sceneId);
        actions.append(button);
      }
      heading.append(title, facts);
      actions.className = 'toolbar';
      card.prepend(heading, details, events);
      card.append(actions);
      worlds.append(card);
    }
    for (const entry of prep.narratives.entries.slice(0, 6)) {
      const item = host.document.createElement('p'),
        strong = host.document.createElement('strong');
      strong.textContent = entry.note.title || 'Unbenannter Auftrag';
      item.append(
        strong,
        host.document.createTextNode(
          ' · ' +
            (entry.note.kind === 'quest' ? 'Quest' : 'Gerücht') +
            (entry.locationName ? ' · ' + entry.locationName : ''),
        ),
      );
      narratives.append(item);
    }
    if (!prep.narratives.entries.length) {
      const empty = host.document.createElement('p');
      empty.className = 'caption';
      empty.textContent =
        prep.narrativesAvailable === false
          ? 'Auftragsjournal nicht verfügbar; offene Inhalte sind nicht geprüft.'
          : 'Keine offenen Quests oder Gerüchte.';
      narratives.append(empty);
    }
    host.get('live-session-resume-narrative-count').textContent =
      prep.narrativesAvailable === false
        ? 'Auftragsjournal konnte nicht geprüft werden.'
        : prep.narratives.counts.open + ' offene Aufträge und Gerüchte';
    host.get('live-session-resume-loot-status').textContent = auditProblem
      ? 'Beute konnte nicht geprüft werden: ' + auditProblem
      : audit.treasures.count
        ? audit.treasures.count +
          ' unverteilte Schatzpositionen · ' +
          audit.treasures.units +
          ' Einheiten' +
          (audit.treasures.more ? ' · weitere vorhanden' : '')
        : 'Keine unverteilte Beute auf der ersten Schatzseite.';
  }
  async function openSessionResume() {
    const owner = host.context,
      token = owner?.token,
      focus = host.data?.focusId,
      revision = host.data?.focusRevision,
      dialog = host.get<HTMLDialogElement>('live-session-resume-dialog');
    if (
      !owner ||
      !token ||
      !host.data?.scene ||
      host.sessionChronicleError ||
      dialog.open ||
      liveSessionRecap(host.sessionChronicle?.entries ?? []).open
    )
      return;
    const run = ++sessionResumeRequest,
      current = () =>
        host.context === owner &&
        host.context?.token === token &&
        run === sessionResumeRequest &&
        host.data?.focusId === focus &&
        host.data?.focusRevision === revision;
    if (!(await host.flushLive()) || !current()) return;
    const scenes = host.data!.scenes.map((scene) => ({ ...scene, clock: { ...scene.clock } }));
    dialog.showModal();
    dialog.setAttribute('aria-busy', 'true');
    host.get('live-session-resume-status').textContent = 'Leitungsstand wird zusammengestellt…';
    for (const id of [
      'live-session-resume-groups',
      'live-session-resume-readiness',
      'live-session-resume-masks',
      'live-session-resume-visits',
      'live-session-resume-narratives',
      'live-session-resume-worlds',
    ])
      host.get(id).replaceChildren();
    try {
      let auditProblem: string | undefined;
      const loadingPrep: SessionResumePrep = {
        visits: [],
        worlds: [],
        narratives: { entries: [], next: null, counts: { open: 0, closed: 0 } },
        narrativesAvailable: false,
        readiness: [],
        readinessAvailable: false,
        problems: ['Vorbereitungsquellen werden noch geladen.'],
      };
      const auditPromise = host
        .readSessionCloseAudit(token, scenes, [])
        .catch((error) => {
          auditProblem = (error as Error).message;
          return {
            masks: [],
            treasures: { count: 0, units: 0, more: false },
            xpBooked: false,
            events: 0,
          } as SessionCloseAudit;
        })
        .then((audit) => {
          if (current() && dialog.open) {
            renderSessionResume(audit, loadingPrep, auditProblem);
            host.get('live-session-resume-status').textContent =
              'Startgruppen verfügbar. Weitere Vorbereitungsquellen werden geladen…';
          }
          return audit;
        });
      const [audit, prep] = await Promise.all([
        auditPromise,
        host.readSessionResumePrep(token, scenes, () => current() && dialog.open),
      ]);
      if (!current() || !dialog.open) return;
      if (auditProblem) prep.problems.unshift('Laufstand nicht geprüft: ' + auditProblem);
      renderSessionResume(audit, prep, auditProblem);
      host.get('live-session-resume-status').textContent = prep.problems.length
        ? 'Einzelne Quellen fehlen: ' +
          prep.problems.slice(0, 3).join(' · ') +
          (prep.problems.length > 3
            ? ' · ' + (prep.problems.length - 3) + ' weitere fehlende Quellen'
            : '') +
          '. Gesunde Einträge bleiben verfügbar.'
        : 'Wähle eine Startgruppe oder öffne zuerst einen vorbereiteten Stand.';
    } catch (error) {
      if (current() && dialog.open)
        host.get('live-session-resume-status').textContent =
          'Leitungsstand konnte nicht geladen werden: ' + (error as Error).message;
    } finally {
      if (current()) dialog.setAttribute('aria-busy', 'false');
    }
  }

  function init() {
    sessionResumeButton = host.document.createElement('button');
    sessionResumeButton.id = 'live-session-resume';
    sessionResumeButton.type = 'button';
    sessionResumeButton.textContent = 'Nächsten Abend vorbereiten…';
    host.get('live-session-start').after(sessionResumeButton);
    sessionResumeButton.onclick = () => void openSessionResume();
    const resumeDialog = host.document.createElement('dialog');
    resumeDialog.id = 'live-session-resume-dialog';
    resumeDialog.innerHTML =
      '<div class="toolbar"><h2>Nächsten Spielabend aufnehmen</h2><button id="live-session-resume-x" type="button">Schließen</button></div><p id="live-session-resume-status" role="status"></p><section class="session-resume-handoff"><h3>Letzte Übergabe</h3><p id="live-session-resume-handoff"></p></section><section><h3>Startbriefings</h3><p class="caption">Pro Gruppe: Übergabe, Party, Weltlage, offene Fäden und Eröffnung.</p><div id="live-session-resume-groups"></div></section><section><h3>Gruppenbereitschaft</h3><div id="live-session-resume-readiness"></div></section><section><h3>Weltlage der Gruppen</h3><div id="live-session-resume-worlds"></div></section><section><h3>Nächste vorbereitete Besuche</h3><div id="live-session-resume-visits"></div></section><section><h3>Laufende Szenen</h3><div id="live-session-resume-masks"></div></section><section class="session-resume-narrative"><div class="toolbar"><div><h3>Offene Aufträge und Gerüchte</h3><p id="live-session-resume-narrative-count"></p></div><button id="live-session-resume-narrative-open" type="button">Auftragsjournal öffnen…</button></div><div id="live-session-resume-narratives"></div></section><section class="session-close-check"><div><h3>Beute</h3><p id="live-session-resume-loot-status"></p></div><button id="live-session-resume-loot" type="button">Beute verteilen…</button></section><section class="session-close-check"><div><h3>Partyfortschritt</h3><p>XP, Tagesbelastung und Empfänger vor dem Start prüfen.</p></div><button id="live-session-resume-xp" type="button">XP abrechnen…</button></section><div class="toolbar"><span class="grow"></span><button id="live-session-resume-close" type="button">Schließen</button></div>';
    host.dialogHost.append(resumeDialog);

    for (const id of ['live-session-resume-x', 'live-session-resume-close'])
      host.get<HTMLButtonElement>(id).onclick = () => {
        sessionResumeRequest++;
        resumeDialog.close();
      };
    resumeDialog.addEventListener('cancel', () => sessionResumeRequest++);
    host.get('live-session-resume-loot').onclick = () => {
      sessionResumeRequest++;
      resumeDialog.close();
      void openTreasureDistribution(undefined, host.data?.scene?.id).catch((error) =>
        host.tell(error.message, true),
      );
    };
    host.get('live-session-resume-xp').onclick = () => {
      sessionResumeRequest++;
      resumeDialog.close();
      host.partyAward();
    };
    host.get('live-session-resume-narrative-open').onclick = () => {
      sessionResumeRequest++;
      resumeDialog.close();
      void openNarrativeJournal().catch((error) => host.tell(error.message, true));
    };
  }

  function reset() {
    sessionResumeRequest++;
    const dialog = host.get('live-session-resume-dialog') as HTMLDialogElement | null;
    if (dialog?.open) dialog.close();
  }
  function renderButton(open: boolean, hasMarker: boolean, disabled: boolean) {
    sessionResumeButton.hidden = open || !hasMarker;
    sessionResumeButton.disabled = disabled;
  }

  return { init, reset, renderButton, renderSessionResume, openSessionResume };
}
