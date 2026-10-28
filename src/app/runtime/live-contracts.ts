import {
  type CharacterProfile,
  type Character,
  type LiveScene,
  type SessionRecapDraft,
  type TimeUnit,
} from './live-scene-contracts';
import { checkedLiveMomentDraft, type LiveMomentDraft } from './live-moment-drafts';
import type { VisitOutcomeStatus } from './visit-outcome-contracts';
import type { Result } from '../shared/contracts';
export function checkedSessionRecapDraft(draft: SessionRecapDraft): SessionRecapDraft {
  const invalid = () =>
    new Error('Rückblickentwurf ist ungültig. Gespeicherte Texte bleiben erhalten.');
  if (!draft || typeof draft !== 'object' || Object.getPrototypeOf(draft) !== Object.prototype)
    throw invalid();
  for (const key of Reflect.ownKeys(draft)) {
    if (typeof key !== 'string' || !['summary', 'handoff'].includes(key)) throw invalid();
    const field = Object.getOwnPropertyDescriptor(draft, key)!;
    if (!('value' in field) || !field.enumerable) throw invalid();
  }
  if (
    typeof draft.summary !== 'string' ||
    typeof draft.handoff !== 'string' ||
    draft.summary.length > 10000 ||
    draft.handoff.length > 10000
  )
    throw invalid();
  return draft;
}
export interface LiveView {
  recapDraft?: SessionRecapDraft | null;
  recapDraftError?: string;
  rosterRevision: number;
  roster: Character[];
  archivedRosterCount?: number;
  primaryId: string | null;
  focusId: string | null;
  focusRevision: number | null;
  scenes: {
    id: string;
    title: string;
    primary: boolean;
    locationId?: string | null;
    locationTitle?: string | null;
    members: number;
    membershipRevision: number;
    clock: LiveScene['clock'];
  }[];
  archiveCount: number;
  scene: LiveScene | null;
}
export type LiveAction =
  | { kind: 'initialize'; expectedRosterRevision: number }
  | { kind: 'create-character'; profile: CharacterProfile }
  | { kind: 'profile'; characterId: string; expectedRevision: number; profile: CharacterProfile }
  | {
      kind: 'archive-character';
      characterId: string;
      expectedRevision: number;
      expectedMembershipRevision: number;
      expectedRosterRevision: number;
      expectedFocusRevision: number | null;
      archived: boolean;
      confirmName: string;
      reason: string;
    }
  | {
      kind: 'membership';
      characterId: string;
      expectedRevision: number;
      expectedRosterRevision: number;
      active: boolean;
      targetSceneId: string | null;
      expectedFocusRevision: number | null;
    }
  | {
      kind: 'apply-visit';
      planId: string;
      expectedPlanRevision: number;
      visitId: string;
      sceneId: string;
      expectedRevision: number;
      expectedVisitRevision?: number;
    }
  | {
      kind: 'visit-outcome';
      sceneId: string;
      expectedRevision: number;
      adoptionId: string;
      status: VisitOutcomeStatus;
      outcome: string;
    }
  | {
      kind: 'scene-content';
      sceneId: string;
      expectedRevision: number;
      title: string;
      notes: string;
      readAloud?: string;
      locationId: string | null;
    }
  | { kind: 'focus'; sceneId: string; expectedRevision: number }
  | {
      kind: 'scene-roster';
      sceneId: string;
      expectedRosterRevision: number;
      expectedFocusRevision: number;
      expectedSceneMembershipRevision: number;
      memberIds: string[];
    }
  | {
      kind: 'move';
      sceneId: string;
      expectedRosterRevision: number;
      expectedFocusRevision: number;
      expectedClockRevision: number;
      expectedSceneMembershipRevision: number;
      memberIds: string[];
      target:
        | { kind: 'new'; title: string; expectedContentRevision: number }
        | {
            kind: 'existing';
            sceneId: string;
            expectedClockRevision: number;
            expectedMembershipRevision: number;
          };
    }
  | {
      kind: 'live-moment';
      sceneId: string;
      expectedRevision: number;
      category: 'combat' | 'narrative' | 'reward' | 'travel' | 'party' | 'world';
      title: string;
      summary: string;
      draft?: LiveMomentDraft;
      followUp?: { kind: 'quest' | 'rumor'; id: string } | null;
    }
  | {
      kind: 'session-marker';
      sceneId: string;
      expectedRevision: number;
      marker: 'start' | 'end';
      summary: string;
      handoff?: string;
    }
  | {
      kind: 'advance-clock';
      sceneId: string;
      expectedRevision: number;
      amount: number;
      unit: TimeUnit;
      calendarVersion: 'relative-v1';
      reason: string;
    }
  | {
      kind: 'advance-clock';
      sceneId: string;
      expectedRevision: number;
      calendarVersion: 'campaign-calendar-v1';
      calendar: { revision: number; daySeconds: number };
      toInstantMs: string;
      expectedFocusRevision: number;
      eventTarget?: import('./clock-event-contracts').ClockEventTarget;
      reason: string;
    };
export interface LiveCommand {
  commandId: string;
  campaignId: string;
  token: string;
  action: LiveAction;
}
export interface LiveAck {
  recapDraft?: SessionRecapDraft | null;
  commandId: string;
  targetId: string;
  revision: number;
  rosterRevision: number;
  archivedRosterCount?: number;
  scene?: LiveScene;
  character?: Character;
  session?: {
    primaryId: string;
    focusId: string;
    focusRevision: number;
    retired: { id: string; clock: LiveScene['clock'] }[];
    members: Pick<Character, 'id' | 'active' | 'membershipRevision' | 'sceneId'>[];
    groups: { id: string; membershipRevision: number; members: number }[];
    createdScene?: LiveView['scenes'][number];
    archiveCount: number;
  };
}
export function advanceInstant(instantMs: string, amount: number, unit: TimeUnit): string {
  const factors: Record<TimeUnit, bigint> = {
    seconds: 1000n,
    minutes: 60000n,
    hours: 3600000n,
    days: 86400000n,
  };
  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    !Object.hasOwn(factors, unit) ||
    !/^(0|[1-9][0-9]{0,29})$/.test(instantMs)
  )
    throw new Error('Zeitspanne benötigt eine positive ganze Zahl und eine gültige Einheit.');
  const next = BigInt(instantMs) + BigInt(amount) * factors[unit];
  if (next.toString().length > 30) throw new Error('Zeitwert zu groß.');
  return next.toString();
}
export function formatInstant(instantMs: string, daySeconds = 86400): string {
  const seconds = BigInt(instantMs) / 1000n;
  const pad = (n: bigint) => n.toString().padStart(2, '0');
  return (
    'Tag ' +
    seconds / BigInt(daySeconds) +
    ' · ' +
    pad((seconds % BigInt(daySeconds)) / 3600n) +
    ':' +
    pad((seconds / 60n) % 60n) +
    ':' +
    pad(seconds % 60n)
  );
}
export interface LiveAPI {
  keepLiveMomentDraft(
    token: string,
    sceneId: string,
    draft: LiveMomentDraft | null,
    expected: LiveMomentDraft | null,
  ): Promise<Result<void>>;
  keepSessionRecapDraft(
    token: string,
    draft: SessionRecapDraft,
    expected: SessionRecapDraft | null,
  ): Promise<Result<void>>;
  archivedRoster(
    token: string,
    after: string | null,
    search: string,
  ): Promise<Result<{ items: Character[]; next: string | null; total: number }>>;
  live(token: string): Promise<Result<LiveView>>;
  liveScene(token: string, id: string): Promise<Result<LiveScene>>;
  liveArchives(
    token: string,
    after: string | null,
  ): Promise<Result<{ items: { id: string; title: string }[]; next: string | null }>>;
  executeLive(command: LiveCommand): Promise<Result<LiveAck>>;
  liveStatus(command: LiveCommand, token: string): Promise<Result<LiveStatus>>;
}
export interface LiveStatus {
  outcome: 'applied' | 'not-applied' | 'conflict';
  receipt: LiveAck | null;
  targetChanged: boolean;
  currentScene?: LiveScene;
  currentCharacter?: Character;
}
export function checkedCharacterProfile(value: CharacterProfile): CharacterProfile {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype)
    throw new Error('Ungültiges Charakterprofil.');
  const keys = [
    'name',
    'archive',
    'playerName',
    'species',
    'characterClass',
    'armorClass',
    'passivePerception',
    'passiveInsight',
    'passiveInvestigation',
    'languages',
    'speedFeet',
  ];
  if (Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !keys.includes(key)))
    throw new Error('Unbekanntes Profilfeld.');
  for (const key of Reflect.ownKeys(value))
    if (!('value' in Object.getOwnPropertyDescriptor(value, key)!))
      throw new Error('Profil benötigt eigene Werte.');
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 1000)
    throw new Error('Charaktername fehlt.');
  for (const text of [value.playerName, value.species, value.characterClass])
    if (text !== undefined && (typeof text !== 'string' || text.length > 1000))
      throw new Error('Ungültiger Profiltext.');
  for (const number of [
    value.armorClass,
    value.passivePerception,
    value.passiveInsight,
    value.passiveInvestigation,
    value.speedFeet,
  ])
    if (number !== undefined && (!Number.isSafeInteger(number) || number < 0))
      throw new Error('Profilwerte müssen nichtnegative ganze Zahlen sein.');
  if (
    value.languages !== undefined &&
    (!Array.isArray(value.languages) ||
      value.languages.length > 100 ||
      value.languages.some((t) => typeof t !== 'string' || !t.trim() || t.length > 1000))
  )
    throw new Error('Sprachen benötigen geordnete, nichtleere Namen.');
  if (value.archive !== undefined) {
    const a = value.archive;
    if (
      !a ||
      Object.getPrototypeOf(a) !== Object.prototype ||
      Reflect.ownKeys(a).some((k) => k !== 'recordedAt' && k !== 'reason') ||
      typeof a.recordedAt !== 'string' ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(a.recordedAt) ||
      !Number.isFinite(Date.parse(a.recordedAt)) ||
      typeof a.reason !== 'string' ||
      a.reason.length > 4000
    )
      throw new Error('Charakterarchiv ist ungültig.');
  }
  return { ...value };
}
export function validateLiveCommand(command: LiveCommand) {
  if (
    !command ||
    ![command.commandId, command.campaignId, command.token].every(
      (v) => typeof v === 'string' && !!v && v.length <= 1000,
    ) ||
    !command.action
  )
    throw new Error('Ungültiger Liveauftrag.');
  const action = command.action;
  if (
    'expectedRevision' in action &&
    (!Number.isSafeInteger(action.expectedRevision) || action.expectedRevision < 0)
  )
    throw new Error('Ungültige Zielrevision.');
  if (
    'expectedRosterRevision' in action &&
    (!Number.isSafeInteger(action.expectedRosterRevision) || action.expectedRosterRevision < 0)
  )
    throw new Error('Ungültige Partyrevision.');
  if (
    'expectedPlanRevision' in action &&
    (!Number.isSafeInteger(action.expectedPlanRevision) || action.expectedPlanRevision < 0)
  )
    throw new Error('Ungültige Planrevision.');
  if (
    (action.kind === 'move' || action.kind === 'scene-roster') &&
    (!Number.isSafeInteger(action.expectedSceneMembershipRevision) ||
      action.expectedSceneMembershipRevision < 0 ||
      !Number.isSafeInteger(action.expectedFocusRevision) ||
      action.expectedFocusRevision < 0)
  )
    throw new Error('Ungültige Gruppenrevision.');
  if (
    action.kind === 'visit-outcome' &&
    (!['open', 'completed', 'skipped'].includes(action.status) ||
      typeof action.outcome !== 'string' ||
      action.outcome.length > 2000000)
  )
    throw new Error('Besuchsergebnis prüfen.');
  const fields = action as unknown as Record<string, unknown>;
  for (const key of ['characterId', 'sceneId', 'planId', 'visitId', 'adoptionId']) {
    const id = fields[key];
    if (key in fields && (typeof id !== 'string' || !id || id.length > 1000))
      throw new Error('Ungültiges Änderungsziel.');
  }
  if (
    'locationId' in action &&
    action.locationId !== null &&
    (typeof action.locationId !== 'string' || !action.locationId || action.locationId.length > 1000)
  )
    throw new Error('Ungültiger Szenenort.');
  if (
    action.kind === 'live-moment' &&
    (!['combat', 'narrative', 'reward', 'travel', 'party', 'world'].includes(action.category) ||
      typeof action.title !== 'string' ||
      !action.title.trim() ||
      action.title.length > 1000 ||
      typeof action.summary !== 'string' ||
      action.summary.length > 10000)
  )
    throw new Error('Chronikeintrag benötigt einen Titel und höchstens 10.000 Zeichen Notiz.');
  if (action.kind === 'live-moment' && action.draft !== undefined) {
    const d = checkedLiveMomentDraft(action.draft);
    if (d.title !== action.title || d.summary !== action.summary || d.category !== action.category)
      throw new Error('Momententwurf passt nicht zum Chronikereignis.');
  }
  if (
    action.kind === 'live-moment' &&
    action.followUp !== undefined &&
    action.followUp !== null &&
    (!['quest', 'rumor'].includes(action.followUp.kind) ||
      typeof action.followUp.id !== 'string' ||
      !action.followUp.id ||
      action.followUp.id.length > 1000)
  )
    throw new Error('Ungültige Folgespur.');
  if (
    action.kind === 'session-marker' &&
    (!['start', 'end'].includes(action.marker) ||
      typeof action.summary !== 'string' ||
      action.summary.length > 10000 ||
      (action.handoff !== undefined &&
        (typeof action.handoff !== 'string' || action.handoff.length > 10000)))
  )
    throw new Error(
      'Spielabend-Markierung benötigt gültige Rückblick- und Übergabetexte mit höchstens 10.000 Zeichen.',
    );
}
