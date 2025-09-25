// src/plugins/layout-editor/inline-edit.ts
import type { InlineEditOptions } from "./types";

export function createInlineEditor(options: InlineEditOptions): HTMLElement {
    const el = options.parent.createEl(options.multiline ? "div" : "span", { cls: "sm-le-inline-edit" });
    if (options.block) el.addClass("sm-le-inline-edit--block");
    if (options.multiline) el.addClass("sm-le-inline-edit--multiline");
    el.contentEditable = "true";
    el.spellcheck = false;
    el.dataset.placeholder = options.placeholder;
    const trim = options.trim ?? true;
    const initialValue = options.value ?? "";
    if (initialValue) {
        el.setText(initialValue);
    }
    let committedValue = trim ? initialValue.trim() : initialValue;
    const readValue = () => {
        const raw = el.textContent ?? "";
        return trim ? raw.trim() : raw;
    };
    const commit = () => {
        const next = readValue();
        if (next === committedValue) return;
        committedValue = next;
        options.onCommit(next);
    };
    el.addEventListener("keydown", ev => {
        if (!options.multiline && ev.key === "Enter") {
            ev.preventDefault();
            (ev.target as HTMLElement).blur();
        } else if (options.multiline && ev.key === "Enter" && !ev.shiftKey) {
            ev.preventDefault();
            (ev.target as HTMLElement).blur();
        }
    });
    el.addEventListener("blur", () => {
        commit();
        if (!readValue()) {
            el.empty();
        }
    });
    el.addEventListener("input", () => {
        options.onInput?.(readValue());
    });
    return el;
}
