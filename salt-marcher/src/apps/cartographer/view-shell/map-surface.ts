// src/apps/cartographer/view-shell/map-surface.ts
// Baut die Kartenfläche inklusive Overlay-API.
import { createViewContainer, type ViewContainerHandle } from "../../../ui/view-container";

export type MapSurfaceHandle = {
    readonly containerEl: HTMLElement;
    readonly view: ViewContainerHandle;
    readonly mapHost: HTMLElement;
    setOverlay(content: string | null): void;
    clear(): void;
    destroy(): void;
};

export function createMapSurface(container: HTMLElement): MapSurfaceHandle {
    const view = createViewContainer(container, { camera: false });
    const mapHost = view.stageEl;

    return {
        containerEl: container,
        view,
        mapHost,
        setOverlay: (content) => {
            view.setOverlay(content);
        },
        clear: () => {
            mapHost.empty();
        },
        destroy: () => {
            view.destroy();
            container.empty();
        },
    };
}
