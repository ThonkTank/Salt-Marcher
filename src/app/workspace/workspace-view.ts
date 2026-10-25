// Device-local navigation only. Campaign content and session state stay in the store.
export const workspaceTabs = [
  'groups',
  'treasury',
  'atlas',
  'preparation',
  'live',
  'chronicle',
  'catalog',
  'items',
  'world',
  'music',
  'city',
  'autonomy',
  'dungeon',
] as const;
export type WorkspaceTab = (typeof workspaceTabs)[number];
export interface WorkspaceView {
  tab: WorkspaceTab;
  scrollY: number;
  liveNotesTop?: number;
  liveCombat?: boolean;
}
type ViewStorage = Pick<Storage, 'getItem' | 'setItem'>;
const key = (campaignId: string) => 'workspace-view:' + campaignId;
export function readWorkspaceView(storage: ViewStorage, campaignId: string): WorkspaceView {
  try {
    const value = JSON.parse(storage.getItem(key(campaignId)) ?? 'null');
    if (
      value &&
      workspaceTabs.includes(value.tab) &&
      Number.isFinite(value.scrollY) &&
      value.scrollY >= 0 &&
      value.scrollY <= 10000000
    )
      return {
        tab: value.tab,
        scrollY: value.scrollY,
        ...(value.tab === 'live' && value.liveCombat === true ? { liveCombat: true } : {}),
        ...(value.tab === 'live' &&
        Number.isFinite(value.liveNotesTop) &&
        Math.abs(value.liveNotesTop) <= 10000
          ? { liveNotesTop: value.liveNotesTop }
          : {}),
      };
  } catch {
    /* An unavailable or damaged local preference must not block the campaign. */
  }
  return { tab: 'atlas', scrollY: 0 };
}
export function rememberWorkspaceView(
  storage: ViewStorage,
  campaignId: string,
  view: WorkspaceView,
): void {
  try {
    storage.setItem(key(campaignId), JSON.stringify(view));
  } catch {
    /* Content saving remains independent. */
  }
}

// Area positions live only in this window. The last campaign view still uses the existing local preference.
export class WorkspacePositions {
  private current: { campaign: string; tab: WorkspaceTab } | null = null;
  private positions = new Map<string, number>();
  capture(campaign: string, scrollY: number) {
    if (this.current?.campaign === campaign)
      this.positions.set(campaign + ':' + this.current.tab, scrollY);
  }
  select(campaign: string, tab: WorkspaceTab, restored?: number): number {
    this.current = { campaign, tab };
    const key = campaign + ':' + tab;
    if (restored !== undefined) this.positions.set(key, restored);
    return this.positions.get(key) ?? 0;
  }
}
