export type Sidebar = {
    root: HTMLElement;
    setTile(rc: { r: number; c: number } | null): void;
    setSpeed(v: number): void;
    onSpeedChange(fn: (v: number) => void): void;
    destroy(): void;
};

export function createSidebar(host: HTMLElement): Sidebar {
    const root = host.createDiv({ cls: "sm-tg-side" });
    root.createEl("h4", { text: "Status" });

    const sideEls: { tile?: HTMLSpanElement; speed?: HTMLInputElement } = {};
    const rowTile = root.createDiv({ cls: "row" });
    rowTile.createEl("span", { text: "Aktuelles Hex:" });
    sideEls.tile = rowTile.createEl("span", { text: "—" });

    const rowSpeed = root.createDiv({ cls: "row" });
    rowSpeed.createEl("span", { text: "Token-Speed:" });
    sideEls.speed = rowSpeed.createEl("input", {
        type: "number",
        attr: { step: "0.1", min: "0.1", value: "1" },
    }) as HTMLInputElement;

    let onChange: (v: number) => void = () => {};
    sideEls.speed.onchange = () => {
        const v = parseFloat(sideEls.speed!.value);
        const val = Number.isFinite(v) && v > 0 ? v : 1;
        sideEls.speed!.value = String(val);
        onChange(val);
    };

    const setTile = (rc: { r: number; c: number } | null) => {
        sideEls.tile!.textContent = rc ? `${rc.r},${rc.c}` : "—";
    };
    const setSpeed = (v: number) => {
        if (sideEls.speed!.value !== String(v)) sideEls.speed!.value = String(v);
    };

        return {
            root,
            setTile,
            setSpeed,
            onSpeedChange: (fn) => (onChange = fn),
            destroy: () => root.detach(),
        };
}
