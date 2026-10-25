import { createHash } from 'node:crypto';
import type {
  DungeonTrace,
  DungeonJourney,
  DungeonPursuit,
  DungeonPreview,
  DungeonRequest,
} from '../atlas/dungeon-contracts';
import { readLiveScene } from './live';
import { position } from './world';
import { dungeonTraces, discoverDungeonTrack, dungeonTraceById } from './dungeon-senses';
import { trackAt } from '../runtime/track-model';
const hash = (s: string) => createHash('sha256').update(s).digest('hex'),
  distance = (a: any, b: any) =>
    a.scopeId !== b.scopeId || a.floorId !== b.floorId
      ? Infinity
      : Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const start = (t: DungeonTrace, direction: DungeonPursuit['direction']) =>
    direction === 'forward' ? t.from : t.to,
  end = (t: DungeonTrace, direction: DungeonPursuit['direction']) =>
    direction === 'forward' ? t.to : t.from;
export function pursuitSegment(
  db: any,
  cam: string,
  sceneId: string,
  t: DungeonTrace,
  p: DungeonPursuit,
  preview: (request: DungeonRequest) => DungeonPreview,
) {
  const scene = readLiveScene(db, cam, sceneId),
    at = position(db, cam, sceneId).dungeon,
    condition = trackAt(t, scene.clock.epochId, scene.clock.instantMs);
  if (!at || distance(at, start(t, p.direction)) > 3)
    throw new Error('Gruppe zuerst an den Anfang der gewählten Spur bringen.');
  if (t.hidden || !condition.alive)
    throw new Error('Die Spur ist unterdrückt oder bereits verloren.');
  if (p.score < condition.dc)
    throw new Error(
      'Erneute Wahrnehmungs-/Überlebensprüfung benötigt: Ergebnis ' +
        p.score +
        ' gegen SG ' +
        condition.dc +
        '.',
    );
  const path = t.path?.length ? t.path : [t.from, t.to],
    points = p.direction === 'forward' ? path : path.slice().reverse(),
    request: DungeonRequest = {
      sceneId,
      destination: end(t, p.direction),
      waypoints: [start(t, p.direction), ...points.slice(1, -1)],
      speedMetersPerMinute: 18,
      factor: 1,
      finalSeconds: null,
    };
  const prepared = preview(request);
  discoverDungeonTrack(db, cam, sceneId, t, condition.dc);
  return prepared;
}
export function startPursuit(
  db: any,
  cam: string,
  sceneId: string,
  traceId: string,
  score: number,
  direction: DungeonPursuit['direction'],
  skill: DungeonPursuit['skill'],
  preview: (request: DungeonRequest) => DungeonPreview,
) {
  if (
    !Number.isFinite(score) ||
    score < -100 ||
    score > 100 ||
    !['forward', 'backward'].includes(direction) ||
    !['perception', 'survival'].includes(skill)
  )
    throw new Error('Prüfergebnis, Richtung und Fertigkeit prüfen.');
  const t = dungeonTraceById(db, cam, traceId),
    p: DungeonPursuit = {
      profile: 'dungeon-pursuit-v1',
      direction,
      skill,
      score,
      currentTraceId: t.id,
      followedTraceIds: [t.id],
      candidates: [],
      state: 'following',
      reason: '',
      traceBasis: hash(JSON.stringify(t)),
    };
  return { ...pursuitSegment(db, cam, sceneId, t, p, preview), pursuit: p };
}
export function pursuitCandidates(db: any, cam: string, j: DungeonJourney) {
  const p = j.pursuit!,
    current = dungeonTraceById(db, cam, p.currentTraceId),
    scene = readLiveScene(db, cam, j.request.sceneId),
    at = position(db, cam, scene.id).dungeon!,
    endpoint = end(current, p.direction),
    visited = new Set(p.followedTraceIds);
  return dungeonTraces(db, cam, at.scopeId)
    .filter(
      (t) =>
        !visited.has(t.id) &&
        t.sceneId !== scene.id &&
        !t.hidden &&
        (!current.sourceKnown || t.actorId === current.actorId) &&
        distance(start(t, p.direction), endpoint) <= 0.2 &&
        (p.direction === 'forward'
          ? BigInt(t.instantMs) >= BigInt(current.instantMs)
          : BigInt(t.instantMs) <= BigInt(current.instantMs)),
    )
    .map((t) => ({
      id: t.id,
      condition: trackAt(t, scene.clock.epochId, scene.clock.instantMs),
      sourceKnown: t.sourceKnown ?? false,
      sourceActorId: t.sourceKnown ? t.actorId : null,
    }));
}
export function continuePursuit(
  db: any,
  cam: string,
  j: DungeonJourney,
  score: number,
  traceId: string | null,
  preview: (request: DungeonRequest) => DungeonPreview,
) {
  const p = j.pursuit!;
  if (!Number.isFinite(score) || score < -100 || score > 100)
    throw new Error('Prüfergebnis eingeben.');
  if (p.followedTraceIds.length >= 1000)
    throw new Error('Verfolgungslimit erreicht. Eine neue Verfolgung vorbereiten.');
  p.score = score;
  if (j.nextIndex < j.route.length && p.state === 'check') {
    const t = dungeonTraceById(db, cam, p.currentTraceId),
      scene = readLiveScene(db, cam, j.request.sceneId),
      condition = trackAt(t, scene.clock.epochId, scene.clock.instantMs);
    if (t.hidden || !condition.alive || score < condition.dc) {
      j.reason = 'Aktuelle Spur benötigt Ergebnis mindestens ' + condition.dc + '.';
      return;
    }
    const part = preview({ ...j.request, waypoints: j.route.slice(j.nextIndex, -1) });
    Object.assign(j, part);
    j.nextIndex = 0;
    j.status = 'active';
    j.reason = 'Aktuelle Spur nach neuer Prüfung bestätigt.';
    p.traceBasis = hash(JSON.stringify(t));
    p.state = 'following';
    p.reason = '';
    discoverDungeonTrack(db, cam, j.request.sceneId, t, condition.dc);
    return;
  }
  const candidates = pursuitCandidates(db, cam, j);
  p.candidates = candidates.map((c) => c.id);
  let candidate = traceId
    ? candidates.find((c) => c.id === traceId)
    : candidates.length === 1
      ? candidates[0]
      : null;
  if (traceId && !candidate) throw new Error('Die gewählte Spur schließt nicht an die Fährte an.');
  if (!candidate) {
    p.state = candidates.length ? 'ambiguous' : 'lost';
    p.reason = candidates.length
      ? 'Kreuzende Spuren. Neue Prüfung und nächste Spur als GM auswählen.'
      : 'Fährte endet oder weist eine Lücke auf. Als GM suchen oder eine neue Spur ergänzen.';
    j.status = 'decision';
    j.reason = p.reason;
    return;
  }
  if (!candidate.condition.alive || score < candidate.condition.dc) {
    p.state = 'check';
    p.reason =
      'Schwache Spur: Ergebnis ' +
      score +
      ' gegen SG ' +
      candidate.condition.dc +
      '. Neue Prüfung als GM bestätigen.';
    j.status = 'decision';
    j.reason = p.reason;
    return;
  }
  const t = dungeonTraceById(db, cam, candidate.id),
    part = pursuitSegment(db, cam, j.request.sceneId, t, p, preview);
  Object.assign(j, part);
  j.nextIndex = 0;
  j.status = 'active';
  j.reason = 'Folgt der nächsten Spur.';
  p.currentTraceId = t.id;
  p.followedTraceIds.push(t.id);
  p.traceBasis = hash(JSON.stringify(t));
  p.state = 'following';
  p.reason = '';
  p.candidates = [];
}
export function pursuitGuard(db: any, cam: string, j: DungeonJourney) {
  const p = j.pursuit;
  if (!p) return null;
  const scene = readLiveScene(db, cam, j.request.sceneId),
    t = dungeonTraceById(db, cam, p.currentTraceId),
    condition = trackAt(t, scene.clock.epochId, scene.clock.instantMs);
  if (hash(JSON.stringify(t)) !== p.traceBasis)
    return 'Spur wurde korrigiert. Verfolgung als GM neu vorbereiten.';
  if (t.hidden || !condition.alive)
    return 'Spur ist inzwischen verloren. Neue Suche als GM bestätigen.';
  if (p.score < condition.dc)
    return 'Spur ist schwächer geworden. Erneute Prüfung benötigt: SG ' + condition.dc + '.';
  return null;
}
