// src/apps/cartographer/view-shell.ts
// View-Layer: rendert DOM-Struktur und leitet UI-Ereignisse an den Presenter weiter.

import type { App, TFile } from "obsidian";
import type { HexCoord } from "./presenter";
import { createMapHeader, type MapHeaderSaveMode } from "../../ui/map-header";
import { createViewContainer } from "../../ui/view-container";

export type CartographerShellMode = { id: string; label: string };

export interface CartographerShellCallbacks {
    onModeSelect(id: string): void;
    onOpen(file: TFile): void | Promise<void>;
    onCreate(file: TFile): void | Promise<void>;
    onDelete(file: TFile): void | Promise<void>;
    onSave(mode: MapHeaderSaveMode, file: TFile | null): Promise<boolean> | boolean;
    onHexClick(coord: HexCoord, event: CustomEvent<HexCoord>): void | Promise<void>;
}

export interface CartographerShellOptions {
    app: App;
    host: HTMLElement;
    initialFile: TFile | null;
    modes: CartographerShellMode[];
    callbacks: CartographerShellCallbacks;
}

export interface CartographerShellHandle {
    readonly host: HTMLElement;
    readonly mapHost: HTMLElement;
    readonly sidebarHost: HTMLElement;
    setFileLabel(file: TFile | null): void;
    setModeActive(id: string): void;
    setModeLabel(label: string): void;
    setOverlay(content: string | null): void;
    clearMap(): void;
    destroy(): void;
}

type ModeMenuItem = { modeId: string; item: HTMLButtonElement };

type Cleanup = () => void;

export function createCartographerShell(options: CartographerShellOptions): CartographerShellHandle {
    const { app, host, initialFile, modes, callbacks } = options;

    host.empty();
    host.classList.add("sm-cartographer");

    const headerHost = host.createDiv({ cls: "sm-cartographer__header" });
    const body = host.createDiv({ cls: "sm-cartographer__body" });

    const mapWrapper = body.createDiv({ cls: "sm-cartographer__map" });
    const mapView = createViewContainer(mapWrapper, { camera: false });
    const mapHost = mapView.stageEl;
    const sidebarHost = body.createDiv({ cls: "sm-cartographer__sidebar" });

    const modeMenuItems: ModeMenuItem[] = [];
    let modeTriggerBtn: HTMLButtonElement | null = null;
    let modeDropdownEl: HTMLElement | null = null;
    let unbindOutsideClick: Cleanup | null = null;

    const closeMenu = () => {
        if (!modeDropdownEl || !modeTriggerBtn) return;
        modeDropdownEl.classList.remove("is-open");
        modeTriggerBtn.setAttr("aria-expanded", "false");
        if (unbindOutsideClick) {
            unbindOutsideClick();
            unbindOutsideClick = null;
        }
    };

    const openMenu = () => {
        if (!modeDropdownEl || !modeTriggerBtn) return;
        modeDropdownEl.classList.add("is-open");
        modeTriggerBtn.setAttr("aria-expanded", "true");
        const onDocClick = (ev: MouseEvent) => {
            if (!modeDropdownEl?.contains(ev.target as Node)) closeMenu();
        };
        document.addEventListener("mousedown", onDocClick);
        unbindOutsideClick = () => document.removeEventListener("mousedown", onDocClick);
    };

    const headerHandle = createMapHeader(app, headerHost, {
        title: "Cartographer",
        initialFile,
        onOpen: async (file) => {
            await callbacks.onOpen(file);
        },
        onCreate: async (file) => {
            await callbacks.onCreate(file);
        },
        onDelete: async (file) => {
            await callbacks.onDelete(file);
        },
        onSave: async (mode, file) => {
            return await callbacks.onSave(mode, file);
        },
        titleRightSlot: (slot) => {
            slot.classList.add("sm-cartographer__mode-switch");
            const dropdown = slot.createDiv({ cls: "sm-mode-dropdown" });
            modeDropdownEl = dropdown;

            modeTriggerBtn = dropdown.createEl("button", {
                text: modes[0]?.label ?? "Mode",
                attr: { type: "button", "aria-haspopup": "listbox", "aria-expanded": "false" },
            });
            modeTriggerBtn.classList.add("sm-mode-dropdown__trigger");
            modeTriggerBtn.onclick = () => {
                if (!modeDropdownEl) return;
                const isOpen = modeDropdownEl.classList.contains("is-open");
                if (isOpen) closeMenu();
                else openMenu();
            };

            const menuEl = dropdown.createDiv({ cls: "sm-mode-dropdown__menu", attr: { role: "listbox" } });

            for (const mode of modes) {
                const item = menuEl.createEl("button", {
                    text: mode.label,
                    attr: { role: "option", type: "button", "data-id": mode.id },
                });
                item.classList.add("sm-mode-dropdown__item");
                item.onclick = () => {
                    closeMenu();
                    callbacks.onModeSelect(mode.id);
                };
                modeMenuItems.push({ modeId: mode.id, item });
            }
        },
    });

    const onHexClick = async (event: Event) => {
        const ev = event as CustomEvent<HexCoord>;
        if (ev.cancelable) ev.preventDefault();
        ev.stopPropagation();
        await callbacks.onHexClick(ev.detail, ev);
    };
    mapHost.addEventListener("hex:click", onHexClick as EventListener, { passive: false });

    const setModeActive = (id: string) => {
        for (const entry of modeMenuItems) {
            const isActive = entry.modeId === id;
            entry.item.classList.toggle("is-active", isActive);
            entry.item.ariaSelected = isActive ? "true" : "false";
        }
    };

    const setModeLabel = (label: string) => {
        if (modeTriggerBtn) {
            modeTriggerBtn.textContent = label;
        }
    };

    const destroy = () => {
        closeMenu();
        mapHost.removeEventListener("hex:click", onHexClick as EventListener);
        headerHandle.destroy();
        mapView.destroy();
        host.empty();
        host.removeClass("sm-cartographer");
    };

    const handle: CartographerShellHandle = {
        host,
        mapHost,
        sidebarHost,
        setFileLabel: (file) => {
            headerHandle.setFileLabel(file);
        },
        setModeActive,
        setModeLabel,
        setOverlay: (content) => {
            mapView.setOverlay(content);
        },
        clearMap: () => {
            mapHost.empty();
        },
        destroy,
    };

    return handle;
}
