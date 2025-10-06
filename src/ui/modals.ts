// src/ui/modals.ts
// Overview / central registry for shared modals.
// - NameInputModal: collects a map name (Enter shortcut, focuses the input field).
// - MapSelectModal: fuzzy-searches maps (TFile list) and invokes a callback with the selection.

import { App, Modal, Setting, FuzzySuggestModal, TFile } from "obsidian";
import { MODAL_COPY } from "./copy";

/** Modal used to collect a new map name. */
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
        this.placeholder = options?.placeholder ?? MODAL_COPY.nameInput.placeholder;
        this.title = options?.title ?? MODAL_COPY.nameInput.title;
        this.ctaLabel = options?.cta ?? MODAL_COPY.nameInput.cta;
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
                // @ts-ignore – Obsidian keeps the input element internally
                inputEl = (t as any).inputEl as HTMLInputElement;
                if (this.value) {
                    inputEl.value = this.value;
                }
            })
            .addButton((b) => b.setButtonText(this.ctaLabel).setCta().onClick(() => this.submit()));

        // Enter shortcut.
        this.scope.register([], "Enter", () => this.submit());
        queueMicrotask(() => inputEl?.focus());
    }
    onClose() {
        this.contentEl.empty();
    }
    private submit() {
        const name = this.value || this.placeholder;
        this.close();
        this.onSubmit(name);
    }
}

/** Fuzzy list of available map files (TFiles). */
export class MapSelectModal extends FuzzySuggestModal<TFile> {
    constructor(app: App, private files: TFile[], private onChoose: (f: TFile) => void) {
        super(app);
        this.setPlaceholder(MODAL_COPY.mapSelect.placeholder);
    }
    getItems() {
        return this.files;
    }
    getItemText(f: TFile) {
        return f.basename;
    }
    onChooseItem(f: TFile) {
        this.onChoose(f);
    }
}
