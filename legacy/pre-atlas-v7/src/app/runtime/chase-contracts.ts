import { checkedChaseDraft, type ChaseWorkingDraft } from './chase-draft-contracts';
import type { Result } from '../shared/contracts';
export interface ChaseParticipant {
  id: string;
  characterId?: string | null;
  name: string;
  side: 'pursuer' | 'quarry';
  distance: number;
  speed: number;
  exhaustion: number;
  notes: string;
  hiddenFromPlayers?: boolean;
}
export interface ChaseState {
  id: string;
  revision: number;
  sceneId: string;
  title: string;
  status: 'running' | 'finished' | 'retired';
  round: number;
  goal: string;
  complication: string;
  outcome: string;
  participants: ChaseParticipant[];
}
export type ChaseAction =
  | { kind: 'create'; title: string; goal: string }
  | { kind: 'participant'; participant: ChaseParticipant }
  | { kind: 'participants'; participants: ChaseParticipant[] }
  | { kind: 'visibility'; participantId: string; hidden: boolean }
  | { kind: 'remove'; participantId: string }
  | {
      kind: 'round';
      changes: { participantId: string; distance: number; exhaustion: number }[];
      complication: string;
    }
  | { kind: 'finish'; outcome: string };
export interface ChaseCommand {
  commandId: string;
  campaignId: string;
  token: string;
  sceneId: string;
  chaseId: string | null;
  expectedRevision: number | null;
  action: ChaseAction;
  draftWriteId?: string;
}
export interface ChaseView {
  draft?: ChaseWorkingDraft | null;
  chase: ChaseState | null;
  recent: { id: string; title: string; status: ChaseState['status'] }[];
}
export interface ChaseAPI {
  keepChaseDraft(
    token: string,
    draft: ChaseWorkingDraft,
    expected: string | null,
  ): Promise<Result<void>>;
  chase(token: string, sceneId: string, id?: string): Promise<Result<ChaseView>>;
  executeChase(command: ChaseCommand): Promise<Result<ChaseView>>;
}
const id = (value: unknown) =>
  typeof value === 'string' && value.length > 0 && value.length <= 1000;
export function chaseActionControls(input: {
  title: string;
  participantName: string;
  participantCount: number;
  outcome: string;
}) {
  return {
    start: !!input.title.trim(),
    addParticipant: !!input.participantName.trim(),
    advanceRound: input.participantCount > 0,
    finish: !!input.outcome.trim(),
  };
}
export function checkedChaseParticipant(value: ChaseParticipant): ChaseParticipant {
  const p = value;
  if (
    !p ||
    typeof p !== 'object' ||
    Array.isArray(p) ||
    !id(p.id) ||
    (p.characterId !== undefined && p.characterId !== null && !id(p.characterId)) ||
    typeof p.name !== 'string' ||
    !p.name.trim() ||
    p.name.length > 1000 ||
    !['pursuer', 'quarry'].includes(p.side) ||
    ![p.distance, p.speed, p.exhaustion].every(Number.isSafeInteger) ||
    Math.abs(p.distance) > 1000000 ||
    p.speed < 0 ||
    p.speed > 1000000 ||
    p.exhaustion < 0 ||
    p.exhaustion > 6 ||
    typeof p.notes !== 'string' ||
    p.notes.length > 4000 ||
    (p.hiddenFromPlayers !== undefined &&
      (typeof p.hiddenFromPlayers !== 'boolean' || !!p.characterId))
  )
    throw new Error('Verfolgungsteilnehmer prüfen.');
  return p;
}
export function checkedChase(value: ChaseState): ChaseState {
  const s = value,
    characters =
      s?.participants
        ?.map((p) => p?.characterId)
        .filter((id): id is string => typeof id === 'string') ?? [];
  if (
    !s ||
    typeof s !== 'object' ||
    Array.isArray(s) ||
    !id(s.id) ||
    !id(s.sceneId) ||
    !Number.isSafeInteger(s.revision) ||
    s.revision < 1 ||
    !['running', 'finished', 'retired'].includes(s.status) ||
    !Number.isSafeInteger(s.round) ||
    s.round < 0 ||
    s.round > 1000000 ||
    typeof s.title !== 'string' ||
    !s.title.trim() ||
    s.title.length > 1000 ||
    typeof s.goal !== 'string' ||
    s.goal.length > 4000 ||
    typeof s.complication !== 'string' ||
    s.complication.length > 4000 ||
    typeof s.outcome !== 'string' ||
    s.outcome.length > 10000 ||
    (s.status === 'finished' && !s.outcome.trim()) ||
    (s.status !== 'finished' && !!s.outcome) ||
    !Array.isArray(s.participants) ||
    s.participants.length > 1000 ||
    new Set(s.participants.map((p) => p?.id)).size !== s.participants.length ||
    new Set(characters).size !== characters.length
  )
    throw new Error('Verfolgungsstand beschädigt.');
  s.participants.forEach(checkedChaseParticipant);
  return s;
}
export function checkedChaseView(value: ChaseView): ChaseView {
  const v = value;
  if (
    !v ||
    typeof v !== 'object' ||
    Array.isArray(v) ||
    (v.chase !== null && !v.chase) ||
    !Array.isArray(v.recent) ||
    v.recent.length > 30
  )
    throw new Error('Verfolgungsansicht beschädigt.');
  if (v.chase) checkedChase(v.chase);
  if (v.draft) {
    checkedChaseDraft(v.draft);
    if (
      !v.chase ||
      v.draft.chaseId !== v.chase.id ||
      v.draft.sceneId !== v.chase.sceneId ||
      v.draft.revision > v.chase.revision
    )
      throw new Error('Verfolgungsentwurf besitzt einen anderen Owner.');
  }
  for (const r of v.recent)
    if (
      !r ||
      typeof r !== 'object' ||
      Array.isArray(r) ||
      !id(r.id) ||
      typeof r.title !== 'string' ||
      !r.title.trim() ||
      r.title.length > 1000 ||
      !['running', 'finished', 'retired'].includes(r.status)
    )
      throw new Error('Verfolgungsansicht beschädigt.');
  return v;
}
export function applyChaseAction(
  value: ChaseState,
  action: Exclude<ChaseAction, { kind: 'create' }>,
): ChaseState {
  const s = structuredClone(checkedChase(value));
  if (s.status !== 'running')
    throw new Error(
      s.status === 'finished'
        ? 'Verfolgung wurde abgeschlossen.'
        : 'Verfolgung gehört zu einer archivierten Scene.',
    );
  if (
    !action ||
    !['participant', 'participants', 'visibility', 'remove', 'round', 'finish'].includes(
      action.kind,
    )
  )
    throw new Error('Unbekannte Verfolgungsaktion.');
  if (action.kind === 'participant') {
    checkedChaseParticipant(action.participant);
    const at = s.participants.findIndex((p) => p.id === action.participant.id);
    if (at < 0) s.participants.push(structuredClone(action.participant));
    else s.participants[at] = structuredClone(action.participant);
  } else if (action.kind === 'participants') {
    if (
      !Array.isArray(action.participants) ||
      !action.participants.length ||
      s.participants.length + action.participants.length > 1000
    )
      throw new Error('Scene-Gruppe enthält keine übernehmbaren Teilnehmer.');
    for (const p of action.participants) checkedChaseParticipant(p);
    const ids = new Set(s.participants.map((p) => p.id)),
      characters = new Set(s.participants.map((p) => p.characterId).filter(Boolean));
    if (
      action.participants.some(
        (p) => ids.has(p.id) || (p.characterId && characters.has(p.characterId)),
      ) ||
      new Set(action.participants.map((p) => p.id)).size !== action.participants.length ||
      new Set(action.participants.map((p) => p.characterId).filter(Boolean)).size !==
        action.participants.filter((p) => p.characterId).length
    )
      throw new Error('Scene-Gruppe enthält bereits übernommene Teilnehmer.');
    s.participants.push(...structuredClone(action.participants));
  } else if (action.kind === 'visibility') {
    const p = s.participants.find((p) => p.id === action.participantId);
    if (!p || p.characterId || typeof action.hidden !== 'boolean')
      throw new Error('Spielersichtbarkeit der Verfolgung prüfen.');
    if (action.hidden) p.hiddenFromPlayers = true;
    else delete p.hiddenFromPlayers;
  } else if (action.kind === 'remove') {
    const at = s.participants.findIndex((p) => p.id === action.participantId);
    if (at < 0) throw new Error('Verfolgungsteilnehmer fehlt.');
    s.participants.splice(at, 1);
  } else if (action.kind === 'round') {
    if (
      !Array.isArray(action.changes) ||
      !s.participants.length ||
      action.changes.length !== s.participants.length ||
      new Set(action.changes.map((c) => c?.participantId)).size !== action.changes.length ||
      typeof action.complication !== 'string' ||
      action.complication.length > 4000
    )
      throw new Error('Rundenänderung vollständig und eindeutig angeben.');
    for (const change of action.changes) {
      const p = s.participants.find((p) => p.id === change?.participantId);
      if (
        !p ||
        !Number.isSafeInteger(change.distance) ||
        Math.abs(change.distance) > 1000000 ||
        !Number.isSafeInteger(change.exhaustion) ||
        change.exhaustion < 0 ||
        change.exhaustion > 6
      )
        throw new Error('Rundenänderung prüfen.');
      p.distance = change.distance;
      p.exhaustion = change.exhaustion;
    }
    s.round++;
    s.complication = action.complication;
  } else {
    if (
      typeof action.outcome !== 'string' ||
      !action.outcome.trim() ||
      action.outcome.length > 10000
    )
      throw new Error('Abschluss benötigt ein Ergebnis.');
    s.status = 'finished';
    s.outcome = action.outcome;
  }
  s.revision++;
  return checkedChase(s);
}
