// src/apps/layout/editor/element-preview.ts
import { enhanceSelectToSearch } from "../../../ui/search-dropdown";
import { getElementTypeLabel, isContainerType } from "./definitions";
import { createInlineEditor } from "./inline-edit";
import { LayoutElement, LayoutElementType } from "./types";

export interface ElementPreviewDependencies {
    host: HTMLElement;
    element: LayoutElement;
    elements: LayoutElement[];
    finalize(element: LayoutElement): void;
    ensureContainerDefaults(element: LayoutElement): void;
    applyContainerLayout(element: LayoutElement, options?: { silent?: boolean }): void;
    pushHistory(): void;
    createElement(type: LayoutElementType, options?: { parentId?: string | null }): void;
}

function autoScaleHeadlineText(target: HTMLElement, container: HTMLElement) {
    if (!container.isConnected) return;
    const maxWidth = Math.max(0, container.clientWidth - 12);
    const maxHeight = Math.max(0, container.clientHeight - 12);
    if (!maxWidth || !maxHeight) return;
    const contentLength = (target.textContent ?? "").trim().length;
    const minSize = 18;
    if (contentLength === 0) {
        const fallback = Math.max(minSize, Math.min(maxWidth, maxHeight) / 3);
        target.style.fontSize = `${Math.round(fallback)}px`;
        return;
    }
    let low = minSize;
    let high = Math.max(minSize, Math.min(maxWidth, maxHeight));
    for (let i = 0; i < 10; i++) {
        const mid = (low + high) / 2;
        target.style.fontSize = `${mid}px`;
        const fits = target.scrollWidth <= maxWidth && target.scrollHeight <= maxHeight;
        if (fits) {
            low = mid;
        } else {
            high = mid - 1;
        }
    }
    target.style.fontSize = `${Math.floor(low)}px`;
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

    if (element.type === "label") {
        const block = preview.createDiv({ cls: "sm-le-preview__headline" });
        const inner = block.createDiv({ cls: "sm-le-preview__headline-inner" });
        let labelEl: HTMLElement;
        const applyScale = () => {
            if (!labelEl) return;
            window.requestAnimationFrame(() => autoScaleHeadlineText(labelEl, inner));
        };
        labelEl = createInlineEditor({
            parent: inner,
            value: element.label,
            placeholder: "Überschrift eingeben…",
            multiline: true,
            block: true,
            trim: false,
            onInput: () => {
                autoScaleHeadlineText(labelEl, inner);
            },
            onCommit: value => {
                commitLabel(value);
                applyScale();
            },
        });
        labelEl.addClass("sm-le-preview__headline-text");
        applyScale();
        if (element.description !== undefined) {
            element.description = undefined;
        }
        return;
    }

    if (element.type === "separator") {
        const header = preview.createDiv({ cls: "sm-le-preview__separator" });
        const label = createInlineEditor({
            parent: header,
            value: element.label,
            placeholder: "Titel eingeben…",
            onCommit: commitLabel,
        });
        label.addClass("sm-le-preview__label");
        preview.createEl("hr", { cls: "sm-le-preview__divider" });
        return;
    }

    if (element.type === "text-input") {
        const field = preview.createDiv({ cls: "sm-le-preview__input-only" });
        const input = field.createEl("input", { attr: { type: "text" }, cls: "sm-le-preview__input" }) as HTMLInputElement;
        input.value = element.defaultValue ?? "";
        input.placeholder = "";
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
        if (element.placeholder) {
            element.placeholder = undefined;
        }
        return;
    }

    if (element.type === "textarea") {
        const field = preview.createEl("label", { cls: "sm-le-preview__field" });
        const labelHost = field.createSpan({ cls: "sm-le-preview__label" });
        createInlineEditor({
            parent: labelHost,
            value: element.label,
            placeholder: "Label eingeben…",
            onCommit: commitLabel,
        });

        const textarea = field.createEl("textarea", { cls: "sm-le-preview__textarea" }) as HTMLTextAreaElement;
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

        return;
    }

    if (element.type === "dropdown" || element.type === "search-dropdown") {
        const field = preview.createEl("label", { cls: "sm-le-preview__field" });
        const labelHost = field.createSpan({ cls: "sm-le-preview__label" });
        createInlineEditor({
            parent: labelHost,
            value: element.label,
            placeholder: "Label eingeben…",
            onCommit: commitLabel,
        });

        const select = field.createEl("select", { cls: "sm-le-preview__select" }) as HTMLSelectElement;
        const defaultPlaceholder = element.type === "dropdown" ? "Option wählen…" : "Suchen…";

        const renderSelectOptions = () => {
            select.innerHTML = "";
            const placeholderText = element.placeholder ?? defaultPlaceholder;
            const placeholderOption = select.createEl("option", { value: "", text: placeholderText });
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
                    placeholderOption.selected = true;
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
        return;
    }

    if (isContainerType(element.type)) {
        deps.ensureContainerDefaults(element);
        const frame = preview.createDiv({ cls: "sm-le-preview__container" });
        const header = frame.createDiv({ cls: "sm-le-preview__container-header" });
        createInlineEditor({
            parent: header,
            value: element.label,
            placeholder: "Container benennen…",
            onCommit: commitLabel,
        }).addClass("sm-le-preview__label");
        const body = frame.createDiv({ cls: "sm-le-preview__container-body" });
        const children = Array.isArray(element.children)
            ? element.children
                  .map(childId => deps.elements.find(el => el.id === childId))
                  .filter((child): child is LayoutElement => !!child)
            : [];
        if (!children.length) {
            body.createDiv({ cls: "sm-le-preview__container-placeholder", text: "Leerer Container" });
        } else {
            for (const child of children) {
                const row = body.createDiv({ cls: "sm-le-container-chip" });
                row.setText(child.label || getElementTypeLabel(child.type));
            }
        }
        return;
    }

    const fallback = preview.createDiv({ cls: "sm-le-preview__field" });
    const labelHost = fallback.createSpan({ cls: "sm-le-preview__label" });
    createInlineEditor({
        parent: labelHost,
        value: element.label,
        placeholder: "Label eingeben…",
        onCommit: commitLabel,
    });
}
