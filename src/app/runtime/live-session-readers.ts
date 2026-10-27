import type { Preparation } from '../campaign/preparation-contracts';
import type { ScenePreparation } from '../campaign/session-contracts';
import type { SessionPacket, SessionPacketVisit } from '../campaign/session-packet-contracts';
import type { Result, WorkspaceGeometry } from '../shared/contracts';
import type { AgendaPage } from './agenda-contracts';
import { type LiveView } from './live-contracts';
import { partyHealthFacts, partyProgressFacts } from './live-party-reference';
import { liveSessionRecap } from './live-session-recap';
import type { NarrativeJournal } from './narrative-journal-contracts';
import { restFrame } from './progression';
import type { SceneWorld } from './world-contracts';

type Host = {
  readonly context: WorkspaceGeometry | null;
  readonly sources: Preparation | null;
  readonly liveSourcesProblem: string;
  readonly value: (id: string) => string;
  readonly window: { campaign: Window['campaign'] };
  readonly unwrap: <T>(result: Result<T>) => T;
};

export type SessionCloseMask = {
  kind: 'combat' | 'chase';
  id: string;
  sceneId: string;
  sceneTitle: string;
  title: string;
  state: string;
};
export type SessionCloseAudit = {
  masks: SessionCloseMask[];
  treasures: { count: number; units: number; more: boolean };
  xpBooked: boolean;
  events: number;
};
export type SessionResumeVisit = {
  sceneId: string;
  sceneTitle: string;
  nextVisit: NonNullable<ScenePreparation['nextVisit']>;
  packet: SessionPacketVisit | null;
  packetBasis: string | null;
  warnings: string[];
  fallback: boolean;
  planName: string;
};
export type SessionResumePrep = {
  visits: SessionResumeVisit[];
  narratives: NarrativeJournal;
  worlds: { sceneId: string; sceneTitle: string; frame: SceneWorld; agenda: AgendaPage }[];
  problems: string[];
  narrativesAvailable: boolean;
  readiness: {
    sceneId: string;
    sceneTitle: string;
    characters: {
      characterId: string;
      name: string;
      health: string;
      progress: string;
      warning: boolean;
    }[];
  }[];
  readinessAvailable: boolean;
};

export function createLiveSessionReaders(host: Host) {
  async function readSessionCloseAudit(
    token: string,
    scenes: LiveView['scenes'],
    events: ReturnType<typeof liveSessionRecap>['entries'],
  ): Promise<SessionCloseAudit> {
    const [rows, treasureResult] = await Promise.all([
        Promise.all(
          scenes.map(async (scene) => {
            const [combatResult, chaseResult] = await Promise.all([
              host.window.campaign.combat(token, scene.id),
              host.window.campaign.chase(token, scene.id),
            ]);
            return { scene, combat: host.unwrap(combatResult), chase: host.unwrap(chaseResult) };
          }),
        ),
        host.window.campaign.treasures(token, null),
      ]),
      treasures = host.unwrap(treasureResult),
      masks: SessionCloseMask[] = [],
      seen = new Set<string>();
    for (const row of rows) {
      for (const combat of row.combat.recent)
        if (['preparing', 'running'].includes(combat.phase) && !seen.has('combat:' + combat.id)) {
          seen.add('combat:' + combat.id);
          masks.push({
            kind: 'combat',
            id: combat.id,
            sceneId: row.scene.id,
            sceneTitle: row.scene.title || 'Unbenannte Gruppe',
            title: combat.title,
            state: combat.phase === 'preparing' ? 'in Vorbereitung' : 'läuft',
          });
        }
      for (const chase of row.chase.recent)
        if (chase.status === 'running' && !seen.has('chase:' + chase.id)) {
          seen.add('chase:' + chase.id);
          masks.push({
            kind: 'chase',
            id: chase.id,
            sceneId: row.scene.id,
            sceneTitle: row.scene.title || 'Unbenannte Gruppe',
            title: chase.title,
            state: 'läuft',
          });
        }
    }
    const openTreasures = treasures.items.filter((item) => item.available > 0);
    return {
      masks,
      treasures: {
        count: openTreasures.length,
        units: openTreasures.reduce((sum, item) => sum + item.available, 0),
        more: !!treasures.next,
      },
      xpBooked: events.some((entry) => entry.title.startsWith('XP-Abrechnung:')),
      events: events.length,
    };
  }
  async function readSessionResumePrep(
    token: string,
    scenes: LiveView['scenes'],
    current: () => boolean = () => host.context?.token === token,
  ): Promise<SessionResumePrep> {
    const plans = (host.sources?.plans ?? [])
        .filter((plan) => plan.scenes.length)
        .map((plan) => ({ id: plan.id, name: plan.name, revision: plan.revision })),
      problems: string[] = host.sources
        ? []
        : [host.liveSourcesProblem || 'Vorbereitungspläne nicht verfügbar.'],
      packets = new Map<string, Promise<SessionPacket | null>>();
    const preferred = host.value('live-session-plan'),
      preferredIndex = plans.findIndex((plan) => plan.id === preferred);
    if (preferredIndex > 0) plans.unshift(plans.splice(preferredIndex, 1)[0]!);
    const check = () => {
      if (!current()) throw new Error('Wiederaufnahme inzwischen beendet.');
    };
    async function read<T>(label: string, load: () => Promise<Result<T>>): Promise<T | null> {
      check();
      try {
        const value = host.unwrap(await load());
        check();
        return value;
      } catch (error) {
        check();
        problems.push(label + ': ' + (error as Error).message);
        return null;
      }
    }
    const packetFor = (planId: string) => {
      let p = packets.get(planId);
      if (!p) {
        p = read('Mappe ' + planId, () => host.window.campaign.sessionPacket(token, planId));
        packets.set(planId, p);
      }
      return p;
    };
    const fallbackFor = async (sceneId: string) => {
      for (const plan of plans) {
        const progress = await read('Besuchsstand ' + plan.name, () =>
          host.window.campaign.sessionProgress(token, plan.id, sceneId),
        );
        if (!progress) continue;
        if (progress.planId !== plan.id || progress.planRevision !== plan.revision) {
          problems.push('Plan ' + plan.name + ' wurde geändert. Erneut laden.');
          continue;
        }
        const visit = progress.visits.find(
          (item) => !item.focused?.outcome || item.focused.outcome.status === 'open',
        );
        if (visit)
          return {
            nextVisit: {
              planId: plan.id,
              planRevision: plan.revision,
              visitId: visit.id,
              title: visit.title,
            },
            planName: plan.name || 'Unbenannter Plan',
          };
      }
      return null;
    };
    const visits: SessionResumeVisit[] = [],
      worlds: SessionResumePrep['worlds'] = [];
    // A scene is read at a time; fallback stops at its first usable plan.
    // Failures are retained as missing evidence instead of erasing healthy cards.
    for (const scene of scenes) {
      check();
      const [preparation, frame, agenda] = await Promise.all([
        read('Vorbereitung ' + scene.title, () =>
          host.window.campaign.scenePreparation(token, scene.id),
        ),
        read('Weltlage ' + scene.title, () => host.window.campaign.sceneWorld(token, scene.id)),
        read('Agenda ' + scene.title, () =>
          host.window.campaign.agenda(token, {
            sceneId: scene.id,
            search: '',
            location: 'current',
            horizonDays: 2,
            includePast: false,
            after: null,
          }),
        ),
      ]);
      check();
      if (frame && agenda)
        worlds.push({
          sceneId: scene.id,
          sceneTitle: scene.title || 'Unbenannte Gruppe',
          frame,
          agenda,
        });
      const sequential = preparation?.nextVisit,
        target = sequential
          ? {
              nextVisit: sequential,
              planName: plans.find((p) => p.id === sequential.planId)?.name || 'Unbenannter Plan',
            }
          : preparation
            ? await fallbackFor(scene.id)
            : null;
      if (!target) continue;
      let packet = await packetFor(target.nextVisit.planId);
      check();
      if (
        packet &&
        (packet.planId !== target.nextVisit.planId ||
          packet.planRevision !== target.nextVisit.planRevision)
      ) {
        problems.push('Vorbereitung und Mappe gehören zu verschiedenen Planständen. Erneut laden.');
        packet = null;
      }
      const visit = packet?.visits.find((v) => v.id === target.nextVisit.visitId) ?? null,
        warnings = [...(packet?.warnings ?? [])];
      if (!visit) warnings.push('Die angezeigte Besuchsmappe ist nicht verfügbar. Erneut laden.');
      visits.push({
        sceneId: scene.id,
        sceneTitle: scene.title || 'Unbenannte Gruppe',
        ...target,
        packet: visit,
        packetBasis: visit ? packet!.basis : null,
        warnings: [...warnings],
        fallback: !sequential,
      });
    }
    const progress = await read('Partywerte', () => host.window.campaign.progress(token));
    const readiness: SessionResumePrep['readiness'] = progress
      ? scenes.map((scene) => ({
          sceneId: scene.id,
          sceneTitle: scene.title || 'Unbenannte Gruppe',
          characters: progress.characters
            .filter((character) => character.active && character.sceneId === scene.id)
            .map((character) => {
              const frame = restFrame(character),
                status = character.health ?? character.lastCombatStatus;
              return {
                characterId: character.characterId,
                name: character.name,
                health: partyHealthFacts(character),
                progress: partyProgressFacts(character),
                warning:
                  !character.health ||
                  character.health.hp === 0 ||
                  !!character.health.death?.dead ||
                  !!character.health.death?.stable ||
                  !!status?.conditions ||
                  character.xp === null ||
                  !frame ||
                  frame.overdue,
              };
            }),
        }))
      : [];
    const narratives = await read('Auftragsjournal', () =>
      host.window.campaign.narrativeJournal(token, {
        search: '',
        kind: 'all',
        status: 'open',
        after: null,
      }),
    );
    check();
    return {
      visits,
      worlds,
      narratives: narratives ?? { entries: [], counts: { open: 0, closed: 0 }, next: null },
      problems,
      narrativesAvailable: !!narratives,
      readiness,
      readinessAvailable: !!progress,
    };
  }

  return { readSessionCloseAudit, readSessionResumePrep };
}
