export type LiveMomentCategory = 'combat' | 'narrative' | 'reward' | 'travel' | 'party' | 'world';
export interface LiveMomentDraft {
  category: LiveMomentCategory;
  title: string;
  summary: string;
  followUp: '' | 'quest' | 'rumor' | 'deadline' | 'visit';
}

export function checkedLiveMomentDraft(d: LiveMomentDraft): LiveMomentDraft {
  if (
    !d ||
    Object.getPrototypeOf(d) !== Object.prototype ||
    Reflect.ownKeys(d).some(
      (k) =>
        typeof k !== 'string' ||
        !['category', 'title', 'summary', 'followUp'].includes(k) ||
        !('value' in Object.getOwnPropertyDescriptor(d, k)!),
    ) ||
    !['combat', 'narrative', 'reward', 'travel', 'party', 'world'].includes(d.category) ||
    typeof d.title !== 'string' ||
    d.title.length > 1000 ||
    typeof d.summary !== 'string' ||
    d.summary.length > 10000 ||
    !['', 'quest', 'rumor', 'deadline', 'visit'].includes(d.followUp)
  )
    throw new Error('Momententwurf ist ungültig. Gespeicherte Eingaben bleiben erhalten.');
  return { category: d.category, title: d.title, summary: d.summary, followUp: d.followUp };
}
export const sameLiveMomentDraft = (a: LiveMomentDraft | null, b: LiveMomentDraft | null) =>
  a === null
    ? b === null
    : !!b &&
      a.category === b.category &&
      a.title === b.title &&
      a.summary === b.summary &&
      a.followUp === b.followUp;
export const liveMomentDraftValue = (d: LiveMomentDraft): LiveMomentDraft | null =>
  d.title || d.summary || d.category !== 'world' || d.followUp ? checkedLiveMomentDraft(d) : null;

export const emptyLiveMomentDraft = (): LiveMomentDraft => ({
  category: 'world',
  title: '',
  summary: '',
  followUp: '',
});
export const canClearSavedLiveMoment = (
  sceneId: string,
  currentSceneId: string | null,
  saved: LiveMomentDraft,
  current: LiveMomentDraft,
) =>
  sceneId === currentSceneId &&
  saved.category === current.category &&
  saved.title === current.title &&
  saved.summary === current.summary &&
  saved.followUp === current.followUp;
export function liveMomentSavedMessage(
  followUp: LiveMomentDraft['followUp'],
  cleared: boolean,
  refreshProblem = false,
) {
  const completed = {
    quest: 'Moment gespeichert und als offene Quest vorbereitet.',
    rumor: 'Moment gespeichert und als Gerücht vorbereitet.',
    deadline: 'Moment gespeichert. Ortsfrist ist als Entwurf geöffnet.',
    visit: 'Moment gespeichert und als nächster Besuch vorbereitet.',
  } as const;
  let message = followUp ? completed[followUp] : 'Moment in der Kampagnenchronik gespeichert.';
  if (!cleared) message += ' Neuere Eingabe bleibt offen.';
  if (refreshProblem)
    message +=
      followUp === 'quest' || followUp === 'rumor'
        ? ' Wissensbinder bei Bedarf aktualisieren.'
        : ' Folgevorbereitung konnte nicht geöffnet werden.';
  return message;
}
