// src/ui/modals.ts
// Übersicht / Zentrale Stelle für alle Modals
// - NameInputModal: Eingabe eines Kartennamens (Enter-Shortcut, Fokus auf Input)
// - MapSelectModal: Fuzzy-Suche über Karten (TFile-Liste), ruft Callback mit Auswahl

import { App, Modal, Setting, FuzzySuggestModal, TFile } from "obsidian";

/** Modal zur Eingabe eines neuen Kartennamens */
export class NameInputModal extends Modal {
    private value = "";
    private placeholder: string;
    private title: string;
    private ctaLabel: string;
    constructor(
        app: App,
        private onSubmit: (val: string) => void,
        options?: { placeholder?: string; title?: string; cta?: string; initialValue?: string },
    ) {
        super(app);
        this.placeholder = options?.placeholder ?? "Neue Hex Map";
        this.title = options?.title ?? "Name der neuen Karte";
        this.ctaLabel = options?.cta ?? "Erstellen";
        if (options?.initialValue) {
            this.value = options.initialValue.trim();
        }
    }
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h3", { text: this.title });

        let inputEl: HTMLInputElement | undefined;

        new Setting(contentEl)
        .addText((t) => {
            t.setPlaceholder(this.placeholder).onChange((v) => (this.value = v.trim()));
            // @ts-ignore – Obsidian hält das Input-Element intern
            inputEl = (t as any).inputEl as HTMLInputElement;
            if (this.value) {
                inputEl.value = this.value;
            }
        })
        .addButton((b) =>
        b.setButtonText(this.ctaLabel).setCta().onClick(() => this.submit()),
        );

        // Enter-Shortcut
        this.scope.register([], "Enter", () => this.submit());
        queueMicrotask(() => inputEl?.focus());
    }
    onClose() { this.contentEl.empty(); }
    private submit() {
        const name = this.value || this.placeholder;
        this.close();
        this.onSubmit(name);
    }
}

/** Fuzzy-Liste aller Karten (TFiles) */
export class MapSelectModal extends FuzzySuggestModal<TFile> {
    constructor(app: App, private files: TFile[], private onChoose: (f: TFile) => void) {
        super(app);
        this.setPlaceholder("Karte suchen…");
    }
    getItems() { return this.files; }
    getItemText(f: TFile) { return f.basename; }
    onChooseItem(f: TFile) { this.onChoose(f); }
}
