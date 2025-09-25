// plugins/layout-editor/src/ui/editor-menu.ts
import { createElementsButton } from "../elements/ui";
export type EditorMenuEntry =
    | { type: "item"; label: string; description?: string; onSelect: () => void; disabled?: boolean }
    | { type: "separator" };

export interface EditorMenuOptions {
    anchor: HTMLElement;
    entries: EditorMenuEntry[];
    event?: MouseEvent | PointerEvent;
    onClose?: () => void;
}

interface EditorMenuHandle {
    close(): void;
}

let activeMenu: EditorMenuHandle | null = null;

export function openEditorMenu(options: EditorMenuOptions): EditorMenuHandle | null {
    const { anchor, entries, event, onClose } = options;
    if (!anchor || !entries.length) {
        return null;
    }

    activeMenu?.close();

    const menu = document.createElement("div");
    menu.className = "sm-le-menu";

    let isOpen = true;

    const close = () => {
        if (!isOpen) return;
        isOpen = false;
        menu.remove();
        document.removeEventListener("pointerdown", handlePointerDown, true);
        document.removeEventListener("keydown", handleKeyDown, true);
        window.removeEventListener("blur", close);
        if (activeMenu && activeMenu.close === close) {
            activeMenu = null;
        }
        onClose?.();
    };

    const handlePointerDown = (ev: PointerEvent) => {
        const target = ev.target as Node | null;
        if (!target) {
            close();
            return;
        }
        if (!menu.contains(target) && !anchor.contains(target)) {
            close();
        }
    };

    const handleKeyDown = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") {
            ev.preventDefault();
            close();
        }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("blur", close);

    for (const entry of entries) {
        if (entry.type === "separator") {
            menu.createDiv({ cls: "sm-le-menu__separator" });
            continue;
        }
        const item = createElementsButton(menu, { label: "" });
        item.addClass("sm-le-menu__item");
        item.setText("");
        item.type = "button";
        item.createSpan({ cls: "sm-le-menu__label", text: entry.label });
        if (entry.description) {
            item.createSpan({ cls: "sm-le-menu__description", text: entry.description });
        }
        if (entry.disabled) {
            item.setAttr("disabled", "disabled");
            item.addClass("is-disabled");
        }
        item.onclick = ev => {
            ev.preventDefault();
            if (entry.disabled) return;
            close();
            entry.onSelect();
        };
        item.onkeydown = ev => {
            if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                if (!entry.disabled) {
                    close();
                    entry.onSelect();
                }
            }
        };
    }

    document.body.appendChild(menu);

    // Position after appending so dimensions are available.
    const anchorRect = anchor.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const offsetX = event ? event.clientX - anchorRect.left : 0;
    let left = anchorRect.left + window.scrollX + offsetX;
    let top = (event ? event.clientY : anchorRect.bottom) + window.scrollY;

    const viewportRight = window.scrollX + window.innerWidth;
    const viewportBottom = window.scrollY + window.innerHeight;

    if (left + menuRect.width > viewportRight - 8) {
        left = Math.max(8, viewportRight - menuRect.width - 8);
    }
    if (top + menuRect.height > viewportBottom - 8) {
        const above = anchorRect.top + window.scrollY - menuRect.height;
        if (above >= 8) {
            top = above;
        } else {
            top = Math.max(8, viewportBottom - menuRect.height - 8);
        }
    }

    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;

    const focusable = menu.querySelector<HTMLElement>(".sm-le-menu__item:not([disabled])");
    if (focusable) {
        focusable.focus();
    }

    const handle: EditorMenuHandle = { close };
    activeMenu = handle;
    return handle;
}
