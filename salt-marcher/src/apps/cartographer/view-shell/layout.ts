// src/apps/cartographer/view-shell/layout.ts
// Baut Grundlayout für Cartographer-Ansicht.
export type CartographerLayout = {
    readonly host: HTMLElement;
    readonly headerHost: HTMLElement;
    readonly bodyHost: HTMLElement;
    readonly mapWrapper: HTMLElement;
    readonly sidebarHost: HTMLElement;
    destroy(): void;
};

export function createCartographerLayout(host: HTMLElement): CartographerLayout {
    host.empty();
    host.addClass("sm-cartographer");

    const headerHost = host.createDiv({ cls: "sm-cartographer__header" });
    const bodyHost = host.createDiv({ cls: "sm-cartographer__body" });
    const mapWrapper = bodyHost.createDiv({ cls: "sm-cartographer__map" });
    const sidebarHost = bodyHost.createDiv({ cls: "sm-cartographer__sidebar" });

    return {
        host,
        headerHost,
        bodyHost,
        mapWrapper,
        sidebarHost,
        destroy: () => {
            host.empty();
            host.removeClass("sm-cartographer");
        },
    };
}
