import { prepareTravelHistoryValidation, validTravelHistoryTimeStep } from './travel-history';
import { validClockCalendar, validInstant } from '../runtime/time-plan-model';
import { advanceInstant } from '../runtime/live-contracts';
import { hash, readLiveScene, readLive, clock } from './live-read';
export function validateLiveBackup(db: any, campaignId: string) {
  prepareTravelHistoryValidation(db);
  readLive(db, campaignId);
  for (const row of db.prepare('SELECT id FROM live_scene WHERE campaign_id=?').all(campaignId))
    readLiveScene(db, campaignId, row.id);
  const last = new Map<string, { ordinal: number; to: string; revision: number }>();
  for (const row of db
    .prepare('SELECT * FROM scene_time_step WHERE campaign_id=? ORDER BY scene_id,ordinal')
    .iterate(campaignId)) {
    if (hash(row.payload) !== row.checksum) throw new Error('Zeitverlauf beschädigt.');
    const step = JSON.parse(row.payload),
      current = clock(db, campaignId, row.scene_id);
    if (
      !(
        validTravelHistoryTimeStep(db, campaignId, row.scene_id, step) ||
        (step.calendarVersion === 'relative-v1' &&
          advanceInstant(step.from, step.amount, step.unit) === step.to) ||
        (step.calendarVersion === 'campaign-calendar-v1' &&
          validClockCalendar(step.calendar) &&
          validInstant(step.from) &&
          validInstant(step.to) &&
          BigInt(step.to) > BigInt(step.from))
      ) ||
      step.epochId !== current.epochId ||
      !Number.isSafeInteger(step.beforeRevision) ||
      step.beforeRevision < 0 ||
      step.afterRevision !== step.beforeRevision + 1 ||
      step.afterRevision > current.revision ||
      (step.recordedAt !== undefined &&
        (typeof step.recordedAt !== 'string' ||
          !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(step.recordedAt) ||
          !Number.isFinite(Date.parse(step.recordedAt))))
    )
      throw new Error('Zeitverlauf ist nicht konsistent.');
    const previous = last.get(row.scene_id);
    if (
      previous
        ? row.ordinal !== previous.ordinal + 1 ||
          step.from !== previous.to ||
          step.beforeRevision !== previous.revision
        : row.ordinal !== 0
    )
      throw new Error('Zeitverlauf hat eine Lücke.');
    const receipt = db
      .prepare('SELECT room_id,revision FROM receipt WHERE command_id=?')
      .get(row.command_id);
    if (!receipt || receipt.room_id !== row.scene_id || receipt.revision !== step.afterRevision)
      throw new Error('Zeitverlauf hat kein passendes Commitreceipt.');
    last.set(row.scene_id, { ordinal: row.ordinal, to: step.to, revision: step.afterRevision });
  }
  for (const [id, step] of last) {
    const current = clock(db, campaignId, id);
    if (current.instantMs !== step.to || current.revision !== step.revision)
      throw new Error('Sceneuhr entspricht nicht dem bestätigten Zeitverlauf.');
  }
}
