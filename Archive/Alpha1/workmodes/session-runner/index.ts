// src/workmodes/session-runner/index.ts
// View: Stellt den Session Runner als eigenständige Obsidian-Ansicht bereit.
import { ItemView } from "obsidian";
import type { App , WorkspaceLeaf, TFile } from "obsidian";
import { SessionRunnerController, type SessionRunnerControllerCallbacks } from "./session-runner-controller";

export const VIEW_TYPE_SESSION_RUNNER = "session-runner-view";
export const VIEW_SESSION_RUNNER = VIEW_TYPE_SESSION_RUNNER;

export class SessionRunnerView extends ItemView {
    controller: SessionRunnerController;
    readonly callbacks: SessionRunnerControllerCallbacks;
    hostEl: HTMLElement | null = null;
    pendingFile: TFile | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
        this.controller = new SessionRunnerController(this.app as App);
        this.callbacks = this.controller.callbacks;
    }

    getViewType(): string {
        return VIEW_TYPE_SESSION_RUNNER;
    }

    getDisplayText(): string {
        return "Session Runner";
    }

    getIcon(): string {
        return "play";
    }

    setFile(file: TFile | null) {
        this.pendingFile = file;
        void this.controller.setFile(file ?? null);
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl;
        const content = container.children[1] as HTMLElement;
        content.empty();

        this.hostEl = content.createDiv({ cls: "sm-session-runner" });

        const fallbackFile = this.pendingFile ?? this.app.workspace.getActiveFile() ?? null;
        await this.controller.onOpen(this.hostEl, fallbackFile);
    }

    async onClose(): Promise<void> {
        await this.controller.onClose();
        this.hostEl = null;
    }
}

export function getExistingSessionRunnerLeaves(app: App): WorkspaceLeaf[] {
    return app.workspace.getLeavesOfType(VIEW_TYPE_SESSION_RUNNER);
}

export function getOrCreateSessionRunnerLeaf(app: App): WorkspaceLeaf {
    const existing = getExistingSessionRunnerLeaves(app);
    if (existing.length > 0) return existing[0];
    return app.workspace.getLeaf(false) ?? app.workspace.getLeaf(true);
}

export async function openSessionRunner(app: App, file?: TFile | null): Promise<void> {
    const leaf = getOrCreateSessionRunnerLeaf(app);
    await leaf.setViewState({ type: VIEW_TYPE_SESSION_RUNNER, active: true });
    app.workspace.revealLeaf(leaf);

    if (file) {
        const view = leaf.view instanceof SessionRunnerView ? leaf.view : null;
        view?.setFile(file);
    }
}

export async function detachSessionRunnerLeaves(app: App): Promise<void> {
    const leaves = getExistingSessionRunnerLeaves(app);
    for (const leaf of leaves) {
        await leaf.detach();
    }
}
