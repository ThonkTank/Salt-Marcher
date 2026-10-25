import type { Result } from './contracts';
export type MaskKind = 'combat' | 'chase';
export type MaskState = 'preparing' | 'running' | 'finished' | 'retired';
export interface MaskHistoryQuery {
  kind: MaskKind;
  state: 'all' | 'active' | 'finished' | 'retired';
  search: string;
  after: string | null;
}
export interface MaskHistoryItem {
  kind: MaskKind;
  id: string;
  title: string;
  state: MaskState;
  round: number;
  summary: string;
}
export interface MaskHistoryPage {
  campaignId: string;
  sceneId: string;
  query: MaskHistoryQuery;
  items: MaskHistoryItem[];
  total: number;
  next: string | null;
}
export interface MaskHistoryAPI {
  maskHistory(
    token: string,
    sceneId: string,
    query: MaskHistoryQuery,
  ): Promise<Result<MaskHistoryPage>>;
}
export function checkedMaskHistoryQuery(q: MaskHistoryQuery) {
  if (
    !q ||
    typeof q !== 'object' ||
    !['combat', 'chase'].includes(q.kind) ||
    !['all', 'active', 'finished', 'retired'].includes(q.state) ||
    typeof q.search !== 'string' ||
    q.search.length > 1000 ||
    (q.after !== null && (typeof q.after !== 'string' || q.after.length > 4096))
  )
    throw new Error('Suchvorgabe für gespeicherte Begegnungen prüfen.');
  return q;
}
export function checkedMaskHistoryPage(
  p: MaskHistoryPage,
  cam: string,
  sceneId: string,
  q: MaskHistoryQuery,
) {
  checkedMaskHistoryQuery(q);
  if (
    !p ||
    p.campaignId !== cam ||
    p.sceneId !== sceneId ||
    JSON.stringify(p.query) !== JSON.stringify(q) ||
    !Array.isArray(p.items) ||
    p.items.length > 20 ||
    !Number.isSafeInteger(p.total) ||
    p.total < 0 ||
    p.total < p.items.length ||
    (p.next !== null && (typeof p.next !== 'string' || !p.next || p.next.length > 4096)) ||
    new Set(p.items.map((i) => i?.id)).size !== p.items.length ||
    p.items.some(
      (i) =>
        !i ||
        i.kind !== q.kind ||
        typeof i.id !== 'string' ||
        !i.id ||
        i.id.length > 1000 ||
        typeof i.title !== 'string' ||
        !i.title.trim() ||
        i.title.length > 1000 ||
        !['preparing', 'running', 'finished', 'retired'].includes(i.state) ||
        !Number.isSafeInteger(i.round) ||
        i.round < 0 ||
        typeof i.summary !== 'string' ||
        i.summary.length > 240,
    )
  )
    throw new Error('Suchantwort gehört nicht zur gewählten Gruppe oder Suchseite.');
  return p;
}
