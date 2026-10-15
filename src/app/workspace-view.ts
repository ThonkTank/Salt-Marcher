// Device-local navigation only. Campaign content and session state stay in the store.
export const workspaceTabs = ['groups','treasury','atlas','preparation','live','chronicle','catalog','items','world','music','city','autonomy','dungeon'] as const;
export type WorkspaceTab = typeof workspaceTabs[number];
export interface WorkspaceView { tab: WorkspaceTab; scrollY: number }
type ViewStorage = Pick<Storage, 'getItem' | 'setItem'>;
const key = (campaignId: string) => 'workspace-view:' + campaignId;
export function readWorkspaceView(storage: ViewStorage, campaignId: string): WorkspaceView {
  try {
    const value = JSON.parse(storage.getItem(key(campaignId)) ?? 'null');
    if (value && workspaceTabs.includes(value.tab) && Number.isFinite(value.scrollY) && value.scrollY >= 0 && value.scrollY <= 10000000)
      return {tab: value.tab, scrollY: value.scrollY};
  } catch { /* An unavailable or damaged local preference must not block the campaign. */ }
  return {tab: 'atlas', scrollY: 0};
}
export function rememberWorkspaceView(storage: ViewStorage, campaignId: string, view: WorkspaceView): void {
  try { storage.setItem(key(campaignId), JSON.stringify(view)); } catch { /* Content saving remains independent. */ }
}
