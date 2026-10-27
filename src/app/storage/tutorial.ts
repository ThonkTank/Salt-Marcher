import { checkedRow } from './sqlite-connection';
import { randomUUID } from 'node:crypto';
import {
  checkedTutorialRun,
  tutorialLessonRevision,
  type TutorialRun,
} from '../workspace/tutorial-contracts';
import type { SqliteDatabase } from './sqlite-connection';
export function storedTutorial(
  db: SqliteDatabase,
  applicationVersion: string,
  state?: 'shown' | 'finished' | 'skipped',
): TutorialRun {
  if (state !== undefined && !['shown', 'finished', 'skipped'].includes(state))
    throw new Error('Ungültiger Tutorialstatus.');
  return db
    .transaction(() => {
      const key = `tutorial:app:${applicationVersion}`,
        saved = db.prepare('SELECT value FROM settings WHERE key=?').get(key);
      const prior: TutorialRun | null = saved
        ? checkedTutorialRun(
            JSON.parse(checkedRow(saved, { value: 'text' }).value),
            applicationVersion,
          )
        : null;
      // Onboarding belongs to an installed app version. Edited help stays available
      // without resetting this version's completed or dismissed run.
      const run: TutorialRun = prior ?? {
        version: applicationVersion,
        lessonRevision: tutorialLessonRevision,
        runId: randomUUID(),
        state: 'new',
      };
      if (state && run.state !== 'finished' && run.state !== 'skipped') run.state = state;
      db.prepare(
        'INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      ).run(key, JSON.stringify(run));
      return run;
    })
    .immediate();
}
