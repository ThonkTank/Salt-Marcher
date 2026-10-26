import type { WorkspaceGeometry } from '../shared/contracts';
import type { WorkspaceTab } from './workspace-view';

export interface WorkspaceOpeningPorts {
  readonly owner: WorkspaceGeometry | null;
  readonly intent: number;
  readonly request: number;
  readonly failed: boolean;
  show(tab: WorkspaceTab, restored?: number): number;
  atlas(): Promise<void>;
  areas: Record<
    Exclude<WorkspaceTab, 'atlas'>,
    (owner: WorkspaceGeometry | null) => Promise<unknown>
  >;
  status(text: string, error: boolean): void;
  frame(callback: () => void): void;
  restore(tab: WorkspaceTab, scrollY: number, liveNotesTop?: number, liveCombat?: boolean): void;
}

/** Atlas readiness must not lock the workspace. Late errors and scroll restores
 * belong only to the campaign/view intent that requested them. */
export function createWorkspaceViewOpener(ports: WorkspaceOpeningPorts) {
  return async (
    tab: WorkspaceTab,
    restored?: number,
    liveNotesTop?: number,
    liveCombat?: boolean,
  ) => {
    const owner = ports.owner,
      intent = ports.intent,
      scrollY = ports.show(tab, restored),
      request = ports.request;
    const current = () =>
      ports.owner === owner && ports.intent === intent && ports.request === request;
    if (tab === 'atlas') {
      void ports.atlas().catch((error) => {
        if (current()) ports.status((error as Error).message, true);
      });
    } else await ports.areas[tab](owner);
    ports.frame(() => {
      if (current() && !ports.failed) ports.restore(tab, scrollY, liveNotesTop, liveCombat);
    });
  };
}
