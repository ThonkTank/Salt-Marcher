import { randomUUID } from 'node:crypto';
import type { AutonomyJob } from '../runtime/autonomy-contracts';
export function installAutonomyResources(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS autonomy_target_booking(campaign_id TEXT NOT NULL,id TEXT NOT NULL,job_id TEXT NOT NULL,actor_id TEXT NOT NULL,resource_kind TEXT NOT NULL,resource_id TEXT NOT NULL,epoch_id TEXT NOT NULL,from_ms TEXT NOT NULL,to_ms TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,job_id) REFERENCES autonomy_job(campaign_id,id),FOREIGN KEY(campaign_id,actor_id) REFERENCES autonomy_actor(campaign_id,id)) STRICT;
CREATE INDEX IF NOT EXISTS autonomy_target_time ON autonomy_target_booking(campaign_id,resource_kind,resource_id,epoch_id,from_ms,to_ms);`);
}
const instant = (n: bigint) => n.toString().padStart(30, '0');
function resource(j: AutonomyJob) {
  return j.featureId
    ? { kind: 'feature', id: j.featureId }
    : j.roomId
      ? { kind: 'room', id: j.roomId }
      : j.locationId
        ? { kind: 'location', id: j.locationId }
        : { kind: 'job', id: j.id };
}
export function targetOccupied(
  db: any,
  cam: string,
  j: AutonomyJob,
  actorId: string,
  epoch: string,
  from: bigint,
  to: bigint,
) {
  if (!j.exclusive) return false;
  const r = resource(j);
  return !!db
    .prepare(
      'SELECT 1 FROM autonomy_target_booking WHERE campaign_id=? AND resource_kind=? AND resource_id=? AND epoch_id=? AND actor_id<>? AND from_ms<? AND to_ms>? LIMIT 1',
    )
    .get(cam, r.kind, r.id, epoch, actorId, instant(to), instant(from));
}
export function bookTarget(
  db: any,
  cam: string,
  j: AutonomyJob,
  actorId: string,
  epoch: string,
  from: bigint,
  to: bigint,
) {
  if (!j.exclusive || from >= to) return;
  // Both booking views must cover a resumed job, even when its identity is unchanged.
  const booked = db
    .prepare(
      'SELECT 1 FROM autonomy_booking WHERE campaign_id=? AND job_id=? AND actor_id=? AND epoch_id=? AND from_ms<=? AND to_ms>=? LIMIT 1',
    )
    .get(cam, j.id, actorId, epoch, instant(from), instant(to));
  if (!booked)
    db.prepare('INSERT INTO autonomy_booking VALUES(?,?,?,?,?,?,?)').run(
      cam,
      randomUUID(),
      j.id,
      actorId,
      epoch,
      instant(from),
      instant(to),
    );
  const r = resource(j),
    exists = db
      .prepare(
        'SELECT 1 FROM autonomy_target_booking WHERE campaign_id=? AND job_id=? AND actor_id=? AND epoch_id=? AND from_ms<=? AND to_ms>=? LIMIT 1',
      )
      .get(cam, j.id, actorId, epoch, instant(from), instant(to));
  if (!exists)
    db.prepare('INSERT INTO autonomy_target_booking VALUES(?,?,?,?,?,?,?,?,?)').run(
      cam,
      randomUUID(),
      j.id,
      actorId,
      r.kind,
      r.id,
      epoch,
      instant(from),
      instant(to),
    );
}
export function trimTargets(db: any, cam: string, actorId: string, epoch: string, at: bigint) {
  db.prepare(
    'DELETE FROM autonomy_target_booking WHERE campaign_id=? AND actor_id=? AND epoch_id=? AND from_ms>=?',
  ).run(cam, actorId, epoch, instant(at));
  db.prepare(
    'UPDATE autonomy_target_booking SET to_ms=? WHERE campaign_id=? AND actor_id=? AND epoch_id=? AND to_ms>?',
  ).run(instant(at), cam, actorId, epoch, instant(at));
}
