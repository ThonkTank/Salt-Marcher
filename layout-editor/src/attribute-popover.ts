// src/plugins/layout-editor/attribute-popover.ts
import { ATTRIBUTE_GROUPS } from "./definitions";
import type { AttributePopoverState, LayoutElement } from "./types";

export interface AttributePopoverCallbacks {
    getElementById(id: string): LayoutElement | undefined;
    syncElementElement(element: LayoutElement): void;
    refreshExport(): void;
    renderInspector(): void;
    updateStatus(): void;
    pushHistory(): void;
}

export class AttributePopoverController {
    private state: AttributePopoverState | null = null;

    constructor(private readonly callbacks: AttributePopoverCallbacks) {}

    get activeElementId(): string | null {
        return this.state?.elementId ?? null;
    }

    open(element: LayoutElement, anchor: HTMLElement) {
        this.close();

        const container = document.createElement("div");
        container.className = "sm-le-attr-popover";
        container.style.position = "absolute";
        container.style.zIndex = "1000";
        container.style.visibility = "hidden";
        container.addEventListener("pointerdown", ev => ev.stopPropagation());

        const heading = document.createElement("div");
        heading.className = "sm-le-attr-popover__heading";
        heading.textContent = "Attribute";
        container.appendChild(heading);

        const hint = document.createElement("div");
        hint.className = "sm-le-attr-popover__hint";
        hint.textContent = "Mehrfachauswahl möglich.";
        container.appendChild(hint);

        const scroll = document.createElement("div");
        scroll.className = "sm-le-attr-popover__scroll";
        container.appendChild(scroll);

        const clearBtn = document.createElement("button");
        clearBtn.className = "sm-le-attr-popover__clear";
        clearBtn.textContent = "Alle entfernen";
        clearBtn.addEventListener("click", ev => {
            ev.preventDefault();
            if (element.attributes.length === 0) return;
            element.attributes = [];
            this.callbacks.syncElementElement(element);
            this.callbacks.refreshExport();
            this.callbacks.renderInspector();
            this.refresh();
            this.callbacks.updateStatus();
            this.callbacks.pushHistory();
        });
        container.appendChild(clearBtn);

        for (const group of ATTRIBUTE_GROUPS) {
            const groupEl = document.createElement("div");
            groupEl.className = "sm-le-attr-popover__group";
            const title = document.createElement("div");
            title.className = "sm-le-attr-popover__group-title";
            title.textContent = group.label;
            groupEl.appendChild(title);
            for (const option of group.options) {
                const optionLabel = document.createElement("label");
                optionLabel.className = "sm-le-attr-popover__option";
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.dataset.attr = option.value;
                checkbox.checked = element.attributes.includes(option.value);
                checkbox.addEventListener("change", () => {
                    if (checkbox.checked) {
                        if (!element.attributes.includes(option.value)) {
                            element.attributes = [...element.attributes, option.value];
                        }
                    } else {
                        element.attributes = element.attributes.filter(v => v !== option.value);
                    }
                    this.callbacks.syncElementElement(element);
                    this.callbacks.refreshExport();
                    this.callbacks.renderInspector();
                    this.refresh();
                    this.callbacks.updateStatus();
                    this.callbacks.pushHistory();
                });
                const labelText = document.createElement("span");
                labelText.textContent = option.label;
                optionLabel.appendChild(checkbox);
                optionLabel.appendChild(labelText);
                groupEl.appendChild(optionLabel);
            }
            scroll.appendChild(groupEl);
        }

        const onPointerDown = (ev: PointerEvent) => {
            if (!(ev.target instanceof Node)) return;
            if (!container.contains(ev.target) && ev.target !== anchor && !anchor.contains(ev.target as Node)) {
                this.close();
            }
        };
        const onKeyDown = (ev: KeyboardEvent) => {
            if (ev.key === "Escape") {
                this.close();
            }
        };

        document.body.appendChild(container);
        const dispose = () => {
            document.removeEventListener("pointerdown", onPointerDown, true);
            document.removeEventListener("keydown", onKeyDown, true);
            container.remove();
        };
        document.addEventListener("pointerdown", onPointerDown, true);
        document.addEventListener("keydown", onKeyDown, true);

        this.state = {
            elementId: element.id,
            container,
            anchor,
            dispose,
        };
        this.position();
        container.style.visibility = "visible";
    }

    close() {
        if (!this.state) return;
        this.state.dispose();
        this.state = null;
    }

    refresh() {
        if (!this.state) return;
        const element = this.callbacks.getElementById(this.state.elementId);
        if (!element) {
            this.close();
            return;
        }
        const checkboxes = this.state.container.querySelectorAll<HTMLInputElement>("input[type='checkbox'][data-attr]");
        checkboxes.forEach(checkbox => {
            const attr = checkbox.dataset.attr;
            if (!attr) return;
            checkbox.checked = element.attributes.includes(attr);
        });
    }

    position() {
        if (!this.state) return;
        const { container, anchor } = this.state;
        const anchorRect = anchor.getBoundingClientRect();
        const popRect = container.getBoundingClientRect();
        const margin = 8;
        let left = anchorRect.left + window.scrollX;
        let top = anchorRect.bottom + window.scrollY + margin;
        const viewportWidth = window.innerWidth + window.scrollX;
        const viewportHeight = window.innerHeight + window.scrollY;
        if (left + popRect.width > viewportWidth - margin) {
            left = viewportWidth - popRect.width - margin;
        }
        if (left < margin) left = margin;
        if (top + popRect.height > viewportHeight - margin) {
            top = anchorRect.top + window.scrollY - popRect.height - margin;
        }
        if (top < margin) top = margin;
        container.style.left = `${Math.round(left)}px`;
        container.style.top = `${Math.round(top)}px`;
    }
}
