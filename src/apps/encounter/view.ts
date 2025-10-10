// src/apps/encounter/view.ts
// Bindet den Encounter-Presenter an die Workspace-Ansicht und Obsidian-Leaves.
import { ItemView, WorkspaceLeaf, type App } from "obsidian";
import { EncounterPresenter, type EncounterPersistedState } from "./presenter";
import { EncounterWorkspaceView } from "./workspace-view";
import { getCenterLeaf } from "../../core/layout";

export const VIEW_ENCOUNTER = "salt-encounter";

export class EncounterView extends ItemView {
    private presenter: EncounterPresenter | null = null;
    private detachPresenter?: () => void;
    private pendingState: EncounterPersistedState | null = null;
    private workspaceView: EncounterWorkspaceView | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() { return VIEW_ENCOUNTER; }
    getDisplayText() { return "Encounter"; }
    getIcon() { return "swords" as any; }

    async onOpen() {
        const workspaceView = new EncounterWorkspaceView(this.app, this.contentEl);
        workspaceView.mount();
        this.workspaceView = workspaceView;

        const presenter = new EncounterPresenter(this.pendingState);
        this.pendingState = null;
        this.presenter = presenter;

        workspaceView.setPresenter(presenter);
        this.detachPresenter = presenter.subscribe((state) => {
            this.workspaceView?.render(state);
        });
    }

    async onClose() {
        this.detachPresenter?.();
        this.presenter?.dispose();

        this.detachPresenter = undefined;
        this.presenter = null;
        this.pendingState = null;

        this.workspaceView?.setPresenter(null);
        this.workspaceView?.unmount();
        this.workspaceView = null;
    }

    getViewData(): EncounterPersistedState | null {
        return this.presenter?.getState() ?? this.pendingState;
    }

    setViewData(data: EncounterPersistedState) {
        if (this.presenter) {
            this.presenter.restore(data);
        } else {
            this.pendingState = data;
        }
    }
}

/** Opens the encounter calculator in the centre workspace pane. */
export async function openEncounter(app: App): Promise<void> {
    const leaf = getCenterLeaf(app);
    await leaf.setViewState({ type: VIEW_ENCOUNTER, active: true });
    app.workspace.revealLeaf(leaf);
}
