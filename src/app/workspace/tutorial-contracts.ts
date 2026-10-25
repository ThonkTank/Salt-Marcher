export const tutorialLessonRevision = 'desktop-tutorial-day-rest-stops-v151';
export interface TutorialRun {
  version: string;
  lessonRevision: string;
  runId: string;
  state: 'new' | 'shown' | 'finished' | 'skipped';
}
export function checkedTutorialRun(value: unknown, applicationVersion: string): TutorialRun {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype)
    throw new Error('Tutoriallauf ist beschädigt.');
  const fields = ['version', 'lessonRevision', 'runId', 'state'];
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    Reflect.ownKeys(value).length !== fields.length ||
    fields.some((key) => !descriptors[key] || !('value' in descriptors[key]))
  )
    throw new Error('Tutoriallauf hat ein unbekanntes Format.');
  const row = value as TutorialRun;
  if (
    row.version !== applicationVersion ||
    typeof row.lessonRevision !== 'string' ||
    !row.lessonRevision ||
    typeof row.runId !== 'string' ||
    !row.runId ||
    !['new', 'shown', 'finished', 'skipped'].includes(row.state)
  )
    throw new Error('Tutoriallauf hat ungültige Werte.');
  return { ...row };
}
