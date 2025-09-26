import type { CartographerShellMode } from "../view-shell";

export type ModeRegistryHandle = {
    setModes(modes: CartographerShellMode[]): void;
    registerMode(mode: CartographerShellMode): void;
    deregisterMode(id: string): void;
    setActiveMode(id: string | null): void;
    setTriggerLabel(label: string): void;
    destroy(): void;
};

export type ModeRegistryOptions = {
    host: HTMLElement;
    initialLabel?: string;
    onSelect(modeId: string): void;
};

type ModeEntry = {
    mode: CartographerShellMode;
    button: HTMLButtonElement;
};

export function createModeRegistry(options: ModeRegistryOptions): ModeRegistryHandle {
    const { host, onSelect } = options;
    host.addClass("sm-cartographer__mode-switch");

    const dropdown = host.createDiv({ cls: "sm-mode-dropdown" });
    const trigger = dropdown.createEl("button", {
        text: options.initialLabel ?? "Mode",
        attr: { type: "button", "aria-haspopup": "listbox", "aria-expanded": "false" },
    });
    trigger.addClass("sm-mode-dropdown__trigger");

    const menu = dropdown.createDiv({ cls: "sm-mode-dropdown__menu", attr: { role: "listbox" } });

    const entries = new Map<string, ModeEntry>();
    let activeId: string | null = null;
    let unbindOutsideClick: (() => void) | null = null;
    let destroyed = false;

    const closeMenu = () => {
        dropdown.removeClass("is-open");
        trigger.setAttr("aria-expanded", "false");
        if (unbindOutsideClick) {
            unbindOutsideClick();
            unbindOutsideClick = null;
        }
    };

    const openMenu = () => {
        dropdown.addClass("is-open");
        trigger.setAttr("aria-expanded", "true");
        const onDocClick = (event: MouseEvent) => {
            if (!dropdown.contains(event.target as Node)) closeMenu();
        };
        document.addEventListener("mousedown", onDocClick);
        unbindOutsideClick = () => document.removeEventListener("mousedown", onDocClick);
    };

    trigger.onclick = () => {
        const isOpen = dropdown.classList.contains("is-open");
        if (isOpen) closeMenu();
        else openMenu();
    };

    const updateActive = () => {
        for (const entry of entries.values()) {
            const isActive = entry.mode.id === activeId;
            entry.button.classList.toggle("is-active", isActive);
            entry.button.ariaSelected = isActive ? "true" : "false";
        }
    };

    const ensureEntry = (mode: CartographerShellMode): ModeEntry => {
        const button = menu.createEl("button", {
            text: mode.label,
            attr: { role: "option", type: "button", "data-id": mode.id },
        });
        button.addClass("sm-mode-dropdown__item");
        button.onclick = () => {
            closeMenu();
            onSelect(mode.id);
        };
        const entry: ModeEntry = { mode, button };
        entries.set(mode.id, entry);
        return entry;
    };

    const removeEntry = (id: string) => {
        const entry = entries.get(id);
        if (!entry) return;
        entry.button.remove();
        entries.delete(id);
        if (activeId === id) {
            activeId = null;
        }
    };

    const setModes = (modes: CartographerShellMode[]) => {
        const incoming = new Set<string>();
        for (const mode of modes) {
            incoming.add(mode.id);
            const existing = entries.get(mode.id);
            if (existing) {
                existing.mode = mode;
                existing.button.setText(mode.label);
            } else {
                ensureEntry(mode);
            }
        }
        for (const id of Array.from(entries.keys())) {
            if (!incoming.has(id)) {
                removeEntry(id);
            }
        }
        updateActive();
    };

    const registerMode = (mode: CartographerShellMode) => {
        if (entries.has(mode.id)) {
            setModes([mode]);
            return;
        }
        ensureEntry(mode);
        updateActive();
    };

    const deregisterMode = (id: string) => {
        removeEntry(id);
        updateActive();
    };

    const setActiveMode = (id: string | null) => {
        activeId = id;
        updateActive();
        if (activeId) {
            const entry = entries.get(activeId);
            if (entry) {
                trigger.setText(entry.mode.label);
            }
        }
    };

    const setTriggerLabel = (label: string) => {
        trigger.setText(label);
    };

    const destroy = () => {
        if (destroyed) return;
        destroyed = true;
        closeMenu();
        trigger.onclick = null;
        for (const entry of entries.values()) {
            entry.button.onclick = null;
            entry.button.remove();
        }
        entries.clear();
        dropdown.remove();
    };

    return {
        setModes,
        registerMode,
        deregisterMode,
        setActiveMode,
        setTriggerLabel,
        destroy,
    };
}
