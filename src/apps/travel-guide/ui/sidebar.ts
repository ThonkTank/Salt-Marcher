export type Sidebar = {
    root: HTMLElement;
    controlsHost: HTMLElement;
    setTitle?: (title: string) => void;
    setTile(rc: { r: number; c: number } | null): void;
    setSpeed(v: number): void;
    onSpeedChange(fn: (v: number) => void): void;
    destroy(): void;
};

export function createSidebar(host: HTMLElement): Sidebar {
    host.empty();
    host.classList.add("sm-tg-sidebar");

    const root = host.createDiv({ cls: "sm-tg-sidebar__inner" });

    const controlsHost = root.createDiv({ cls: "sm-tg-sidebar__controls" });

    const tileRow = root.createDiv({ cls: "sm-tg-sidebar__row" });
    tileRow.createSpan({ cls: "sm-tg-sidebar__label", text: "Aktuelles Hex" });
    const tileValue = tileRow.createSpan({ cls: "sm-tg-sidebar__value", text: "—" });

    const speedRow = root.createDiv({ cls: "sm-tg-sidebar__row" });
    speedRow.createSpan({ cls: "sm-tg-sidebar__label", text: "Token-Speed" });
    const speedInput = speedRow.createEl("input", {
        type: "number",
        cls: "sm-tg-sidebar__speed-input",
        attr: { step: "0.1", min: "0.1", value: "1" },
    }) as HTMLInputElement;

    let onChange: (v: number) => void = () => {};
    speedInput.onchange = () => {
        const v = parseFloat(speedInput.value);
        const val = Number.isFinite(v) && v > 0 ? v : 1;
        speedInput.value = String(val);
        onChange(val);
    };

    const setTile = (rc: { r: number; c: number } | null) => {
        tileValue.textContent = rc ? `${rc.r},${rc.c}` : "—";
    };
    const setSpeed = (v: number) => {
        const next = String(v);
        if (speedInput.value !== next) speedInput.value = next;
    };
    const setTitle = (title: string) => {
        if (title && title.trim().length > 0) {
            host.dataset.mapTitle = title;
        } else {
            delete host.dataset.mapTitle;
        }
    };

    return {
        root,
        setTitle,
        controlsHost,
        setTile,
        setSpeed,
        onSpeedChange: (fn) => (onChange = fn),
        destroy: () => {
            host.empty();
            delete host.dataset.mapTitle;
        },
    };
}
