import { enhanceSelectToSearch } from "../../search-dropdown";
import type { LayoutElement } from "../../types";
import type { LayoutElementComponent } from "../base";

function renderSelect(
    element: LayoutElement,
    preview: HTMLElement,
    finalize: (element: LayoutElement) => void,
) {
    const field = preview.createEl("label", { cls: "sm-le-preview__field" });
    const labelHost = field.createSpan({ cls: "sm-le-preview__label" });
    const labelText = element.label?.trim() ?? "";
    if (labelText) {
        labelHost.setText(labelText);
    } else {
        labelHost.style.display = "none";
    }

    const select = field.createEl("select", { cls: "sm-le-preview__select" }) as HTMLSelectElement;
    const defaultPlaceholder = "Suchen…";

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
        const searchInput = (select as any)._smSearchInput as HTMLInputElement | undefined;
        if (searchInput) {
            searchInput.value = element.defaultValue ?? "";
            searchInput.placeholder = placeholderText;
        }
    };

    renderSelectOptions();
    enhanceSelectToSearch(select, element.placeholder ?? defaultPlaceholder);
    const searchInput = (select as any)._smSearchInput as HTMLInputElement | undefined;
    if (searchInput) {
        searchInput.addEventListener("blur", () => {
            const next = searchInput.value;
            element.defaultValue = next ? next : undefined;
            finalize(element);
        });
    }

    select.onchange = () => {
        const value = select.value || undefined;
        if (value === element.defaultValue) return;
        element.defaultValue = value;
        const searchInput = (select as any)._smSearchInput as HTMLInputElement | undefined;
        if (searchInput) {
            searchInput.value = value ?? "";
        }
        finalize(element);
    };
}

const searchDropdownComponent: LayoutElementComponent = {
    definition: {
        type: "search-dropdown",
        buttonLabel: "Such-Dropdown",
        defaultLabel: "",
        category: "element",
        paletteGroup: "input",
        defaultPlaceholder: "Suchen…",
        options: ["Erster Eintrag", "Zweiter Eintrag"],
        width: 280,
        height: 160,
    },
    renderPreview({ preview, element, finalize }) {
        renderSelect(element, preview, finalize);
    },
    renderInspector({ renderLabelField, renderPlaceholderField, renderOptionsEditor }) {
        renderLabelField({ label: "Bezeichnung" });
        renderPlaceholderField({ label: "Platzhalter" });
        renderOptionsEditor({});
    },
};

export default searchDropdownComponent;
