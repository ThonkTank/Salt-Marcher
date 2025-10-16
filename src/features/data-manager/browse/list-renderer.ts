// src/ui/data-manager/list-renderer.ts
// Rendert Library-Kacheln für Workmode-Listen wiederverwendbar über alle Apps.

export type WorkmodeFeedbackKind = "empty" | "error";

export interface WorkmodeTileMetadata<Entry> {
    readonly id: string;
    readonly cls: string;
    readonly getValue: (entry: Entry) => string | undefined;
}

export interface WorkmodeTileAction<Entry, Context = undefined> {
    readonly id: string;
    readonly label: string;
    readonly cls?: string;
    readonly execute: (entry: Entry, context: Context) => Promise<void> | void;
}

export interface RenderWorkmodeListOptions<Entry, Context = undefined> {
    readonly container: HTMLElement;
    readonly entries: readonly Entry[];
    readonly getName: (entry: Entry) => string;
    readonly metadata?: readonly WorkmodeTileMetadata<Entry>[];
    readonly actions?: readonly WorkmodeTileAction<Entry, Context>[];
    readonly actionContext?: Context;
    readonly onRenderRow?: (row: HTMLElement, entry: Entry, context: Context | undefined) => void;
}

export function renderWorkmodeFeedback(container: HTMLElement, kind: WorkmodeFeedbackKind, message: string): void {
    container.createDiv({ cls: `sm-cc-feedback sm-cc-feedback--${kind}`, text: message });
}

export function renderWorkmodeList<Entry, Context = undefined>({
    container,
    entries,
    getName,
    metadata = [],
    actions = [],
    actionContext,
    onRenderRow,
}: RenderWorkmodeListOptions<Entry, Context>): HTMLElement[] {
    const rows: HTMLElement[] = [];
    for (const entry of entries) {
        const row = container.createDiv({ cls: "sm-cc-item" });
        rows.push(row);

        const nameContainer = row.createDiv({ cls: "sm-cc-item__name-container" });
        nameContainer.createDiv({ cls: "sm-cc-item__name", text: getName(entry) });

        if (metadata.length > 0) {
            const infoContainer = row.createDiv({ cls: "sm-cc-item__info" });
            for (const field of metadata) {
                const value = field.getValue(entry);
                if (value) {
                    infoContainer.createEl("span", { cls: field.cls, text: value });
                }
            }
        }

        if (actions.length > 0) {
            const actionsContainer = row.createDiv({ cls: "sm-cc-item__actions" });
            for (const action of actions) {
                const cls = action.cls ? `sm-cc-item__action ${action.cls}` : "sm-cc-item__action";
                const button = actionsContainer.createEl("button", { text: action.label, cls });
                button.onclick = async () => {
                    await action.execute(entry, actionContext as Context);
                };
            }
        }

        if (onRenderRow) {
            onRenderRow(row, entry, actionContext as Context | undefined);
        }
    }

    return rows;
}
