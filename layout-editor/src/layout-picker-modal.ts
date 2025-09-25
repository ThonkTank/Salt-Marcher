// plugins/layout-editor/src/layout-picker-modal.ts
import { App, Modal } from "obsidian";
import type { SavedLayout } from "./types";
import { enhanceSelectToSearch } from "./search-dropdown";
import {
    createElementsButton,
    createElementsHeading,
    createElementsMeta,
    createElementsParagraph,
    createElementsSelect,
    createElementsStatus,
} from "./elements/ui";

interface LayoutPickerModalOptions {
    loadLayouts: () => Promise<SavedLayout[]>;
    onPick: (layoutId: string) => void;
}

export class LayoutPickerModal extends Modal {
    private readonly loadLayouts: () => Promise<SavedLayout[]>;
    private readonly onPick: (layoutId: string) => void;

    private layouts: SavedLayout[] = [];
    private selectedId: string | null = null;
    private selectEl: HTMLSelectElement | null = null;
    private statusEl: HTMLElement | null = null;
    private detailsEl: HTMLElement | null = null;
    private submitBtn: HTMLButtonElement | null = null;

    constructor(app: App, options: LayoutPickerModalOptions) {
        super(app);
        this.loadLayouts = options.loadLayouts;
        this.onPick = options.onPick;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("sm-le-layout-picker");

        const heading = createElementsHeading(contentEl, 3, "Gespeichertes Layout laden");
        heading.addClass("sm-le-layout-picker__heading");
        createElementsParagraph(contentEl, "Wähle ein Layout aus deiner Bibliothek, das in den Editor geladen werden soll.");

        this.selectEl = createElementsSelect(contentEl, { options: [], disabled: true });
        this.selectEl.classList.add("sm-le-layout-picker__select");
        this.selectEl.size = 1;
        this.selectEl.disabled = true;
        this.selectEl.addEventListener("change", () => this.handleSelectionChange());

        this.statusEl = createElementsStatus(contentEl, {
            text: "Layouts werden geladen …",
        });
        this.statusEl.addClass("sm-le-layout-picker__status");
        this.detailsEl = contentEl.createDiv({ cls: "sm-le-layout-picker__details" });

        const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });
        const cancelBtn = createElementsButton(buttonContainer, { label: "Abbrechen" });
        cancelBtn.onclick = () => this.close();
        this.submitBtn = createElementsButton(buttonContainer, { label: "Layout laden", variant: "primary" });
        this.submitBtn.classList.add("mod-cta");
        this.submitBtn.disabled = true;
        this.submitBtn.onclick = () => this.submit();

        this.scope.register([], "Enter", () => this.submit());

        await this.fetchLayouts();
    }

    onClose() {
        this.contentEl.empty();
        this.layouts = [];
        this.selectedId = null;
        this.selectEl = null;
        this.statusEl = null;
        this.detailsEl = null;
        this.submitBtn = null;
    }

    private async fetchLayouts() {
        if (!this.selectEl || !this.statusEl) return;
        try {
            const layouts = await this.loadLayouts();
            this.layouts = layouts;
            if (!layouts.length) {
                this.statusEl.setText("Keine gespeicherten Layouts gefunden.");
                this.selectEl.style.display = "none";
                this.submitBtn?.setAttribute("disabled", "disabled");
                return;
            }

            this.populateSelect();
            this.statusEl?.remove();
            this.statusEl = null;
            this.selectEl.disabled = false;
            this.selectEl.style.display = "";
            enhanceSelectToSearch(this.selectEl, "Layout suchen …");
            this.handleSelectionChange();
        } catch (error) {
            console.error("LayoutPickerModal: failed to load layouts", error);
            if (!this.statusEl) {
                this.statusEl = createElementsStatus(this.contentEl, {
                    text: "Layouts konnten nicht geladen werden.",
                    tone: "warning",
                });
                this.statusEl.addClass("sm-le-layout-picker__status");
            } else {
                this.statusEl.setText("Layouts konnten nicht geladen werden.");
            }
            this.selectEl.style.display = "none";
            this.submitBtn?.setAttribute("disabled", "disabled");
        }
    }

    private populateSelect() {
        if (!this.selectEl) return;
        const select = this.selectEl;
        const previous = this.selectedId;
        select.innerHTML = "";
        for (const layout of this.layouts) {
            const option = select.createEl("option", { value: layout.id });
            option.text = layout.name || layout.id;
        }
        if (!this.layouts.length) {
            this.selectedId = null;
            return;
        }
        const match = previous && this.layouts.some(layout => layout.id === previous);
        const firstId = match ? previous : this.layouts[0].id;
        select.value = firstId;
        this.selectedId = firstId;
    }

    private handleSelectionChange() {
        if (!this.selectEl) return;
        this.selectedId = this.selectEl.value || null;
        this.updateDetails();
        this.updateSubmitState();
    }

    private updateDetails() {
        if (!this.detailsEl) return;
        if (!this.selectedId) {
            this.detailsEl.empty();
            return;
        }
        const layout = this.layouts.find(item => item.id === this.selectedId);
        this.detailsEl.empty();
        if (!layout) return;
        const updated = formatTimestamp(layout.updatedAt);
        const created = layout.createdAt !== layout.updatedAt ? formatTimestamp(layout.createdAt) : null;
        const metaParts = [`Größe: ${layout.canvasWidth} × ${layout.canvasHeight}`];
        metaParts.push(`Elemente: ${layout.elements.length}`);
        createElementsMeta(this.detailsEl, metaParts.join(" · "));
        const updatedEl = createElementsMeta(this.detailsEl, `Zuletzt aktualisiert: ${updated}`);
        if (created) {
            createElementsMeta(this.detailsEl, `Erstellt: ${created}`);
        }
        updatedEl.classList.add("sm-le-layout-picker__meta");
    }

    private updateSubmitState() {
        if (!this.submitBtn) return;
        if (this.selectedId) {
            this.submitBtn.disabled = false;
            this.submitBtn.removeAttribute("disabled");
        } else {
            this.submitBtn.disabled = true;
            this.submitBtn.setAttribute("disabled", "disabled");
        }
    }

    private submit() {
        const layoutId = this.selectedId;
        if (!layoutId) return;
        this.close();
        this.onPick(layoutId);
    }
}

function formatTimestamp(value: string): string {
    try {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
            return date.toLocaleString();
        }
    } catch (error) {
        console.warn("LayoutPickerModal: unable to format timestamp", value, error);
    }
    return value;
}
