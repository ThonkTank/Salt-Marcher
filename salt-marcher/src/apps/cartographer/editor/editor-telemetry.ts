// src/apps/cartographer/editor/editor-telemetry.ts
// Meldet Tool-Fehler des Cartographer-Editors und dedupliziert Nutzerhinweise.
import { Notice } from "obsidian";

export type EditorToolIssueStage =
    | "resolve"
    | "mount-panel"
    | "activate"
    | "render"
    | "deactivate"
    | "cleanup"
    | "operation";

export interface EditorToolIssuePayload {
    toolId?: string | null;
    stage: EditorToolIssueStage;
    error: unknown;
}

const noticedIssues = new Set<string>();

const TOOL_STAGE_MESSAGES: Record<EditorToolIssueStage, (toolId: string) => string> = {
    resolve: () =>
        "No editor tools are available right now. Please ensure at least one tool module loads correctly.",
    "mount-panel": (toolId) =>
        `Failed to mount the panel for "${toolId}". Please check the developer console.`,
    activate: (toolId) =>
        `The tool "${toolId}" could not be activated. Please check the developer console.`,
    render: (toolId) =>
        `The tool "${toolId}" failed to react to the rendered map. Please check the developer console.`,
    deactivate: (toolId) =>
        `The tool "${toolId}" could not be deactivated cleanly. Please check the developer console.`,
    cleanup: (toolId) =>
        `The tool "${toolId}" failed to clean up its panel. Please check the developer console.`,
    operation: (toolId) =>
        `Applying changes with "${toolId}" failed. Please check the developer console.`,
};

/**
 * Reports a tooling issue of the cartographer editor and emits a deduplicated
 * Obsidian notice so users get immediate feedback.
 */
export function reportEditorToolIssue(payload: EditorToolIssuePayload): string {
    const { stage, error } = payload;
    const toolId = payload.toolId ?? "unknown";
    const logPrefix = `[cartographer:editor] tool(${toolId}) stage(${stage}) failed`;
    console.error(logPrefix, error);

    const messageFactory = TOOL_STAGE_MESSAGES[stage];
    const userMessage = messageFactory(toolId);

    const dedupeKey = `${stage}:${toolId}`;
    if (!noticedIssues.has(dedupeKey)) {
        noticedIssues.add(dedupeKey);
        new Notice(userMessage);
    }

    return userMessage;
}

/** Test hook to reset deduplicated telemetry state. */
export function __resetEditorToolTelemetry(): void {
    noticedIssues.clear();
}
