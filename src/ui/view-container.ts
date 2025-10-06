// src/ui/view-container.ts
// Wiederverwendbarer Container für visuelle Renderings (z. B. Karten, Vorschauen).
// Bietet optional einfache Kamera-Steuerung (MMB-Pan, Wheel-Zoom) sowie Overlay-Helfer.

export type ViewContainerCameraOptions = {
    minScale?: number;
    maxScale?: number;
    zoomSpeed?: number;
};

export type ViewContainerOptions = {
    className?: string;
    camera?: boolean | ViewContainerCameraOptions;
    initialScale?: number;
};

export type ViewContainerHandle = {
    readonly rootEl: HTMLElement;
    readonly viewportEl: HTMLElement;
    readonly stageEl: HTMLElement;
    readonly overlayEl: HTMLElement;
    setOverlay(message: string | null): void;
    clearOverlay(): void;
    resetCamera(): void;
    destroy(): void;
};

type CameraState = { x: number; y: number; scale: number };

const DEFAULT_CAMERA: Required<ViewContainerCameraOptions> = {
    minScale: 0.25,
    maxScale: 4,
    zoomSpeed: 1.1,
};

export function createViewContainer(parent: HTMLElement, options: ViewContainerOptions = {}): ViewContainerHandle {
    const root = parent.createDiv({ cls: "sm-view-container" });
    if (options.className) root.addClass(options.className);

    const viewport = root.createDiv({ cls: "sm-view-container__viewport" });
    const stage = viewport.createDiv({ cls: "sm-view-container__stage" });
    const overlay = root.createDiv({ cls: "sm-view-container__overlay" });
    overlay.toggleClass("is-visible", false);

    let overlayMessageEl: HTMLElement | null = null;
    const ensureOverlayMessage = () => {
        if (overlayMessageEl && overlayMessageEl.isConnected) return overlayMessageEl;
        overlay.empty();
        overlayMessageEl = overlay.createDiv({ cls: "sm-view-container__overlay-message" });
        return overlayMessageEl;
    };

    let cameraEnabled = options.camera !== false;
    const cameraConfig: Required<ViewContainerCameraOptions> = {
        ...DEFAULT_CAMERA,
        ...(typeof options.camera === "object" ? options.camera : {}),
    };
    let camera: CameraState = { x: 0, y: 0, scale: options.initialScale ?? 1 };

    const applyCamera = () => {
        stage.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
    };
    applyCamera();

    let panPointer: number | null = null;
    let panStartX = 0;
    let panStartY = 0;
    let panOriginX = 0;
    let panOriginY = 0;

    const handlePointerDown = (ev: PointerEvent) => {
        if (!cameraEnabled || ev.button !== 1) return;
        ev.preventDefault();
        ev.stopPropagation();
        panPointer = ev.pointerId;
        panStartX = ev.clientX;
        panStartY = ev.clientY;
        panOriginX = camera.x;
        panOriginY = camera.y;
        viewport.setPointerCapture(ev.pointerId);
        viewport.addClass("is-panning");
    };

    const handlePointerMove = (ev: PointerEvent) => {
        if (panPointer === null || ev.pointerId !== panPointer) return;
        ev.preventDefault();
        ev.stopPropagation();
        const dx = ev.clientX - panStartX;
        const dy = ev.clientY - panStartY;
        camera = { ...camera, x: panOriginX + dx, y: panOriginY + dy };
        applyCamera();
    };

    const stopPan = (ev?: PointerEvent) => {
        if (panPointer === null) return;
        if (ev && ev.pointerId !== panPointer) return;
        if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            viewport.releasePointerCapture(ev.pointerId);
        }
        panPointer = null;
        viewport.removeClass("is-panning");
    };

    const handleWheel = (ev: WheelEvent) => {
        if (!cameraEnabled) return;
        ev.preventDefault();
        ev.stopPropagation();
        const delta = ev.deltaY;
        const factor = Math.exp(-delta * 0.0015 * (cameraConfig.zoomSpeed ?? 1));
        const nextScale = Math.min(cameraConfig.maxScale, Math.max(cameraConfig.minScale, camera.scale * factor));
        if (Math.abs(nextScale - camera.scale) < 0.0001) return;
        const rect = viewport.getBoundingClientRect();
        const px = ev.clientX - rect.left;
        const py = ev.clientY - rect.top;
        const worldX = (px - camera.x) / camera.scale;
        const worldY = (py - camera.y) / camera.scale;
        camera = {
            scale: nextScale,
            x: px - worldX * nextScale,
            y: py - worldY * nextScale,
        };
        applyCamera();
    };

    if (cameraEnabled) {
        viewport.style.touchAction = "none";
        viewport.addEventListener("pointerdown", handlePointerDown);
        viewport.addEventListener("pointermove", handlePointerMove);
        viewport.addEventListener("pointerup", stopPan);
        viewport.addEventListener("pointercancel", stopPan);
        viewport.addEventListener("pointerleave", stopPan);
        viewport.addEventListener("wheel", handleWheel, { passive: false });
    }

    const setOverlay = (message: string | null) => {
        if (!message) {
            overlay.toggleClass("is-visible", false);
            overlay.empty();
            overlayMessageEl = null;
            return;
        }
        const target = ensureOverlayMessage();
        target.setText(message);
        overlay.toggleClass("is-visible", true);
    };

    return {
        rootEl: root,
        viewportEl: viewport,
        stageEl: stage,
        overlayEl: overlay,
        setOverlay,
        clearOverlay() {
            setOverlay(null);
        },
        resetCamera() {
            camera = { x: 0, y: 0, scale: options.initialScale ?? 1 };
            applyCamera();
        },
        destroy() {
            stopPan();
            if (cameraEnabled) {
                viewport.removeEventListener("pointerdown", handlePointerDown);
                viewport.removeEventListener("pointermove", handlePointerMove);
                viewport.removeEventListener("pointerup", stopPan);
                viewport.removeEventListener("pointercancel", stopPan);
                viewport.removeEventListener("pointerleave", stopPan);
                viewport.removeEventListener("wheel", handleWheel as any);
            }
            root.remove();
        },
    };
}
