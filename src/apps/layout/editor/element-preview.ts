// src/apps/layout/editor/element-preview.ts
import { Setting } from "obsidian";
import { enhanceSelectToSearch } from "../../../ui/search-dropdown";
import {
    getElementTypeLabel,
    isContainerType,
} from "./definitions";
import { createInlineEditor } from "./inline-edit";
import { LayoutContainerAlign, LayoutElement } from "./types";

export interface ElementPreviewDependencies {
    host: HTMLElement;
    element: LayoutElement;
    elements: LayoutElement[];
    finalize(element: LayoutElement): void;
    ensureContainerDefaults(element: LayoutElement): void;
    applyContainerLayout(element: LayoutElement, options?: { silent?: boolean }): void;
    pushHistory(): void;
}

export function renderElementPreview(deps: ElementPreviewDependencies) {
    const { host, element } = deps;
    host.empty();
    host.toggleClass("sm-le-box__content", true);
    const preview = host.createDiv({ cls: `sm-le-preview sm-le-preview--${element.type}` });

    const commitLabel = (value: string) => {
        const next = value || "";
        if (next === element.label) return;
        element.label = next;
        deps.finalize(element);
    };

    const createPlaceholderEditor = (
        parent: HTMLElement,
        placeholder: string,
        value: string | undefined,
        onChange: (next: string | undefined) => void,
    ) => {
        const editor = createInlineEditor({
            parent,
            value: value ?? "",
            placeholder,
            onInput: val => {
                onChange(val || undefined);
            },
            onCommit: val => {
                const next = val || undefined;
                if (next === value) return;
                onChange(next);
                deps.finalize(element);
            },
        });
        editor.addClass("sm-le-inline-meta");
        return editor;
    };

    const createSetting = (options?: { withDescription?: boolean }) => {
        const setting = new Setting(preview);
        setting.settingEl.addClass("sm-le-preview__setting");
        setting.setName("");
        if (options?.withDescription ?? true) {
            setting.setDesc("");
        }
        return setting;
    };

    if (element.type === "label") {
        const setting = createSetting();
        const labelEl = createInlineEditor({
            parent: setting.nameEl,
            value: element.label,
            placeholder: "Text eingeben…",
            multiline: true,
            block: true,
            trim: false,
            onCommit: commitLabel,
        });
        labelEl.addClass("setting-item-name");
        const descHost = setting.descEl ?? setting.infoEl.createDiv({ cls: "setting-item-description" });
        const desc = createInlineEditor({
            parent: descHost,
            value: element.description ?? "",
            placeholder: "Zusatztext hinzufügen…",
            multiline: true,
            block: true,
            trim: false,
            onCommit: value => {
                const next = value || undefined;
                if (next === element.description) return;
                element.description = next;
                deps.finalize(element);
            },
        });
        desc.addClass("setting-item-description");
        return;
    }

    if (element.type === "box") {
        const setting = createSetting();
        setting.settingEl.addClass("sm-le-preview__setting--box");
        const title = createInlineEditor({
            parent: setting.nameEl,
            value: element.label,
            placeholder: "Titel eingeben…",
            onCommit: commitLabel,
            block: true,
        });
        title.addClass("setting-item-name");
        const descHost = setting.descEl ?? setting.infoEl.createDiv({ cls: "setting-item-description" });
        const desc = createInlineEditor({
            parent: descHost,
            value: element.description ?? "",
            placeholder: "Beschreibung hinzufügen…",
            multiline: true,
            block: true,
            trim: false,
            onCommit: value => {
                const next = value || undefined;
                if (next === element.description) return;
                element.description = next;
                deps.finalize(element);
            },
        });
        desc.addClass("setting-item-description");
        return;
    }

    if (element.type === "separator") {
        const setting = createSetting({ withDescription: false });
        setting.controlEl.detach();
        const label = createInlineEditor({
            parent: setting.nameEl,
            value: element.label,
            placeholder: "Titel eingeben…",
            onCommit: commitLabel,
        });
        label.addClass("setting-item-name");
        setting.settingEl.createEl("hr", { cls: "sm-le-preview__divider" });
        return;
    }

    if (element.type === "text-input" || element.type === "textarea") {
        const setting = createSetting();
        const label = createInlineEditor({
            parent: setting.nameEl,
            value: element.label,
            placeholder: "Label eingeben…",
            onCommit: commitLabel,
        });
        label.addClass("setting-item-name");

        setting.controlEl.empty();
        const placeholderHost = setting.descEl ?? setting.infoEl.createDiv({ cls: "setting-item-description" });

        if (element.type === "textarea") {
            const textarea = setting.controlEl.createEl("textarea", { cls: "sm-le-preview__textarea" }) as HTMLTextAreaElement;
            textarea.value = element.defaultValue ?? "";
            textarea.placeholder = element.placeholder ?? "";
            textarea.rows = 4;
            let lastValue = textarea.value;
            textarea.addEventListener("input", () => {
                element.defaultValue = textarea.value ? textarea.value : undefined;
            });
            textarea.addEventListener("blur", () => {
                const next = textarea.value;
                if (next === lastValue) return;
                lastValue = next;
                element.defaultValue = next ? next : undefined;
                deps.finalize(element);
            });
            createPlaceholderEditor(placeholderHost, "Platzhalter hinzufügen…", element.placeholder, next => {
                textarea.placeholder = next ?? "";
                element.placeholder = next;
            });
        } else {
            const input = setting.controlEl.createEl("input", { attr: { type: "text" }, cls: "sm-le-preview__input" }) as HTMLInputElement;
            input.value = element.defaultValue ?? "";
            input.placeholder = element.placeholder ?? "";
            let lastValue = input.value;
            input.addEventListener("input", () => {
                element.defaultValue = input.value ? input.value : undefined;
            });
            input.addEventListener("blur", () => {
                const next = input.value;
                if (next === lastValue) return;
                lastValue = next;
                element.defaultValue = next ? next : undefined;
                deps.finalize(element);
            });
            createPlaceholderEditor(placeholderHost, "Platzhalter hinzufügen…", element.placeholder, next => {
                input.placeholder = next ?? "";
                element.placeholder = next;
            });
        }
        return;
    }

    if (element.type === "dropdown" || element.type === "search-dropdown") {
        const setting = createSetting();
        const label = createInlineEditor({
            parent: setting.nameEl,
            value: element.label,
            placeholder: "Label eingeben…",
            onCommit: commitLabel,
        });
        label.addClass("setting-item-name");

        setting.controlEl.empty();
        const select = setting.controlEl.createEl("select", { cls: "sm-le-preview__select" }) as HTMLSelectElement;
        const defaultPlaceholder = element.type === "dropdown" ? "Option wählen…" : "Suchen…";
        let placeholderOption: HTMLOptionElement | null = null;

        const renderSelectOptions = () => {
            select.innerHTML = "";
            const placeholderText = element.placeholder ?? defaultPlaceholder;
            placeholderOption = select.createEl("option", { value: "", text: placeholderText });
            placeholderOption.disabled = true;
            if (!element.defaultValue) {
                placeholderOption.selected = true;
            }
            const optionValues = element.options && element.options.length ? element.options : null;
            if (!optionValues) {
                select.createEl("option", { value: "opt-1", text: "Erste Option" });
            } else {
                for (const opt of optionValues) {
                    const optionEl = select.createEl("option", { value: opt, text: opt });
                    if (element.defaultValue && element.defaultValue === opt) {
                        optionEl.selected = true;
                    }
                }
                if (element.defaultValue && !optionValues.includes(element.defaultValue)) {
                    element.defaultValue = undefined;
                    if (placeholderOption) placeholderOption.selected = true;
                }
            }
            if (element.type === "search-dropdown") {
                const searchInput = (select as any)._smSearchInput as HTMLInputElement | undefined;
                if (searchInput) {
                    searchInput.value = element.defaultValue ?? "";
                    searchInput.placeholder = placeholderText;
                }
            }
        };

        renderSelectOptions();
        if (element.type === "search-dropdown") {
            enhanceSelectToSearch(select, element.placeholder ?? defaultPlaceholder);
            const searchInput = (select as any)._smSearchInput as HTMLInputElement | undefined;
            if (searchInput) {
                searchInput.value = element.defaultValue ?? "";
            }
        }

        select.onchange = () => {
            const value = select.value || undefined;
            if (value === element.defaultValue) return;
            element.defaultValue = value;
            if (element.type === "search-dropdown") {
                const searchInput = (select as any)._smSearchInput as HTMLInputElement | undefined;
                if (searchInput) {
                    searchInput.value = value ?? "";
                }
            }
            deps.finalize(element);
        };

        const descHost = setting.descEl ?? setting.infoEl.createDiv({ cls: "setting-item-description" });
        createPlaceholderEditor(descHost, "Platzhalter hinzufügen…", element.placeholder, next => {
            element.placeholder = next;
            renderSelectOptions();
        });

        const optionList = descHost.createDiv({ cls: "sm-le-inline-options" });
        const renderOptionList = () => {
            optionList.empty();
            const optionValues = element.options ?? [];
            if (!optionValues.length) {
                optionList.createDiv({ cls: "sm-le-inline-options__empty", text: "Noch keine Optionen." });
                return;
            }
            optionValues.forEach((opt, index) => {
                const row = optionList.createDiv({ cls: "sm-le-inline-option" });
                const editor = createInlineEditor({
                    parent: row,
                    value: opt,
                    placeholder: "Option…",
                    onCommit: value => {
                        const next = value || opt;
                        if (next === opt) return;
                        const nextOptions = [...(element.options ?? [])];
                        nextOptions[index] = next;
                        element.options = nextOptions;
                        if (element.defaultValue && element.defaultValue === opt) {
                            element.defaultValue = next;
                        }
                        renderSelectOptions();
                        deps.finalize(element);
                    },
                });
                editor.addClass("sm-le-inline-option__label");
                const remove = row.createSpan({ cls: "sm-le-inline-option__remove", text: "✕" });
                remove.onclick = ev => {
                    ev.preventDefault();
                    const nextOptions = (element.options ?? []).filter((_, idx) => idx !== index);
                    element.options = nextOptions.length ? nextOptions : undefined;
                    if (element.defaultValue && !nextOptions.includes(element.defaultValue)) {
                        element.defaultValue = undefined;
                    }
                    renderSelectOptions();
                    renderOptionList();
                    deps.finalize(element);
                };
            });
        };
        renderOptionList();

        const addOption = descHost.createEl("button", { cls: "sm-le-inline-add", text: "Option hinzufügen" });
        addOption.onclick = ev => {
            ev.preventDefault();
            const nextOptions = [...(element.options ?? [])];
            const labelText = `Option ${nextOptions.length + 1}`;
            nextOptions.push(labelText);
            element.options = nextOptions;
            renderSelectOptions();
            renderOptionList();
            deps.finalize(element);
        };
        return;
    }

    if (isContainerType(element.type)) {
        deps.ensureContainerDefaults(element);
        const header = preview.createDiv({ cls: "sm-le-preview__container-header" });
        createInlineEditor({
            parent: header,
            value: element.label,
            placeholder: "Container benennen…",
            onCommit: commitLabel,
        }).addClass("sm-le-preview__label");

        const controls = preview.createDiv({ cls: "sm-le-preview__layout" });
        const layout = element.layout!;

        const gapWrap = controls.createDiv({ cls: "sm-le-inline-control" });
        gapWrap.createSpan({ text: "Abstand" });
        const gapInput = gapWrap.createEl("input", { cls: "sm-le-inline-number", attr: { type: "number", min: "0" } }) as HTMLInputElement;
        gapInput.value = String(Math.round(layout.gap));
        gapInput.onchange = () => {
            const next = Math.max(0, parseInt(gapInput.value, 10) || 0);
            if (next === layout.gap) return;
            layout.gap = next;
            gapInput.value = String(next);
            deps.applyContainerLayout(element);
            deps.pushHistory();
        };

        const paddingWrap = controls.createDiv({ cls: "sm-le-inline-control" });
        paddingWrap.createSpan({ text: "Innenabstand" });
        const paddingInput = paddingWrap.createEl("input", {
            cls: "sm-le-inline-number",
            attr: { type: "number", min: "0" },
        }) as HTMLInputElement;
        paddingInput.value = String(Math.round(layout.padding));
        paddingInput.onchange = () => {
            const next = Math.max(0, parseInt(paddingInput.value, 10) || 0);
            if (next === layout.padding) return;
            layout.padding = next;
            paddingInput.value = String(next);
            deps.applyContainerLayout(element);
            deps.pushHistory();
        };

        const alignWrap = controls.createDiv({ cls: "sm-le-inline-control" });
        alignWrap.createSpan({ text: "Ausrichtung" });
        const alignSelect = alignWrap.createEl("select", { cls: "sm-le-inline-select" }) as HTMLSelectElement;
        const alignOptions: Array<[LayoutContainerAlign, string]> =
            element.type === "vbox"
                ? [
                      ["start", "Links"],
                      ["center", "Zentriert"],
                      ["end", "Rechts"],
                      ["stretch", "Breite"],
                  ]
                : [
                      ["start", "Oben"],
                      ["center", "Zentriert"],
                      ["end", "Unten"],
                      ["stretch", "Höhe"],
                  ];
        for (const [value, labelText] of alignOptions) {
            const option = alignSelect.createEl("option", { value, text: labelText });
            if (layout.align === value) option.selected = true;
        }
        alignSelect.onchange = () => {
            const next = (alignSelect.value as LayoutContainerAlign) ?? layout.align;
            if (next === layout.align) return;
            layout.align = next;
            deps.applyContainerLayout(element);
            deps.pushHistory();
        };

        const summary = preview.createDiv({ cls: "sm-le-preview__container-summary" });
        const children = Array.isArray(element.children)
            ? element.children
                  .map(childId => deps.elements.find(el => el.id === childId))
                  .filter((child): child is LayoutElement => !!child)
            : [];
        if (!children.length) {
            summary.createDiv({ cls: "sm-le-inline-options__empty", text: "Keine Elemente verknüpft." });
        } else {
            for (const child of children) {
                const row = summary.createDiv({ cls: "sm-le-container-chip" });
                row.setText(child.label || getElementTypeLabel(child.type));
            }
        }
        return;
    }

    const fallback = createSetting();
    const label = createInlineEditor({
        parent: fallback.nameEl,
        value: element.label,
        placeholder: "Label eingeben…",
        onCommit: commitLabel,
    });
    label.addClass("setting-item-name");
}
