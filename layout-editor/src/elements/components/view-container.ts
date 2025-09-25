import type { ElementInspectorContext, ElementPreviewContext } from "../base";
import { ElementComponentBase } from "../shared/component-bases";
import {
    createElementsField,
    createElementsMeta,
    createElementsSelect,
    ensureFieldLabelFor,
} from "../ui";
import { getViewBinding, getViewBindings } from "../../view-registry";

type CameraState = {
    x: number;
    y: number;
    scale: number;
};

const MIN_SCALE = 0.25;
const MAX_SCALE = 3;
const SURFACE_WIDTH = 960;
const SURFACE_HEIGHT = 640;

class ViewContainerComponent extends ElementComponentBase {
    constructor() {
        super({
            type: "view-container",
            buttonLabel: "View Container",
            defaultLabel: "",
            category: "element",
            paletteGroup: "container",
            width: 520,
            height: 340,
            defaultDescription: "Platzhalter für externe Visualisierungen (z. B. Karten)",
        });
    }

    renderPreview(context: ElementPreviewContext): void {
        const { preview, element, registerPreviewCleanup } = context;
        preview.addClass("sm-le-preview--view-container");

        const wrapper = preview.createDiv({ cls: "sm-view-container sm-view-container--design" });
        const viewport = wrapper.createDiv({ cls: "sm-view-container__viewport" });
        const stage = viewport.createDiv({ cls: "sm-view-container__content" });
        const overlay = wrapper.createDiv({ cls: "sm-view-container__overlay" });

        const binding = element.viewBindingId ? getViewBinding(element.viewBindingId) : null;
        const heading = overlay.createDiv({ cls: "sm-view-container__overlay-title" });
        heading.setText(binding ? binding.label : "Kein Feature verbunden");
        const subtitle = overlay.createDiv({ cls: "sm-view-container__overlay-subtitle" });
        subtitle.setText(binding ? binding.id : "Wähle im Inspector ein Feature aus.");
        overlay.toggleClass("is-visible", !binding);

        const surface = stage.createDiv({ cls: "sm-view-container__surface" });
        surface.createDiv({ cls: "sm-view-container__surface-grid" });
        const info = surface.createDiv({ cls: "sm-view-container__surface-info" });
        info.createSpan({ cls: "sm-view-container__surface-label", text: binding?.label ?? "View Container" });
        info.createDiv({ cls: "sm-view-container__surface-id", text: binding?.id ?? "Feature auswählen…" });

        viewport.style.touchAction = "none";
        let camera: CameraState = { x: 0, y: 0, scale: 1 };

        const applyCamera = () => {
            surface.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
        };
        applyCamera();

        const supportsResizeObserver = typeof window.ResizeObserver !== "undefined";
        let resizeObserver: ResizeObserver | null = null;
        let fallbackLoopId: number | null = null;
        let pendingFitId: number | null = null;

        const scheduleFit = () => {
            if (pendingFitId !== null) return;
            pendingFitId = window.requestAnimationFrame(() => {
                pendingFitId = null;
                fitCameraToViewport();
            });
        };

        const fitCameraToViewport = () => {
            if (!viewport.isConnected) {
                return;
            }
            const rect = viewport.getBoundingClientRect();
            if (!rect.width || !rect.height) {
                if (supportsResizeObserver) {
                    scheduleFit();
                }
                return;
            }
            const baseScale = Math.min(rect.width / SURFACE_WIDTH, rect.height / SURFACE_HEIGHT);
            if (!isFinite(baseScale) || baseScale <= 0) return;
            const nextScale = Math.min(MAX_SCALE, baseScale);
            const contentWidth = SURFACE_WIDTH * nextScale;
            const contentHeight = SURFACE_HEIGHT * nextScale;
            camera = {
                scale: nextScale,
                x: Math.round((rect.width - contentWidth) / 2),
                y: Math.round((rect.height - contentHeight) / 2),
            };
            applyCamera();
        };

        const disposeCameraSync = () => {
            if (resizeObserver) {
                resizeObserver.disconnect();
                resizeObserver = null;
            }
            if (fallbackLoopId !== null) {
                window.cancelAnimationFrame(fallbackLoopId);
                fallbackLoopId = null;
            }
            if (pendingFitId !== null) {
                window.cancelAnimationFrame(pendingFitId);
                pendingFitId = null;
            }
        };

        if (supportsResizeObserver) {
            resizeObserver = new ResizeObserver(() => {
                scheduleFit();
            });
            resizeObserver.observe(viewport);
            scheduleFit();
        } else {
            const runFallbackLoop = () => {
                if (!viewport.isConnected) {
                    disposeCameraSync();
                    return;
                }
                fitCameraToViewport();
                fallbackLoopId = window.requestAnimationFrame(runFallbackLoop);
            };
            fallbackLoopId = window.requestAnimationFrame(runFallbackLoop);
        }

        registerPreviewCleanup(disposeCameraSync);

        let panPointer: number | null = null;
        let startX = 0;
        let startY = 0;
        let originX = 0;
        let originY = 0;

        const endPan = () => {
            if (panPointer === null) return;
            panPointer = null;
            viewport.style.cursor = "";
        };

        viewport.addEventListener("pointerdown", ev => {
            if (ev.button !== 1) return;
            ev.preventDefault();
            ev.stopPropagation();
            panPointer = ev.pointerId;
            startX = ev.clientX;
            startY = ev.clientY;
            originX = camera.x;
            originY = camera.y;
            viewport.setPointerCapture(ev.pointerId);
            viewport.style.cursor = "grabbing";
        });

        viewport.addEventListener("pointermove", ev => {
            if (panPointer === null || ev.pointerId !== panPointer) return;
            ev.preventDefault();
            ev.stopPropagation();
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            camera = { ...camera, x: originX + dx, y: originY + dy };
            applyCamera();
        });

        const releasePointer = (ev: PointerEvent) => {
            if (panPointer === null || ev.pointerId !== panPointer) return;
            ev.preventDefault();
            ev.stopPropagation();
            viewport.releasePointerCapture(ev.pointerId);
            endPan();
        };

        viewport.addEventListener("pointerup", releasePointer);
        viewport.addEventListener("pointercancel", releasePointer);
        viewport.addEventListener("pointerleave", ev => {
            if (panPointer === null || ev.pointerId !== panPointer) return;
            endPan();
        });

        viewport.addEventListener(
            "wheel",
            ev => {
                ev.preventDefault();
                ev.stopPropagation();
                const delta = ev.deltaY;
                const factor = Math.exp(-delta * 0.0015);
                const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, camera.scale * factor));
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
            },
            { passive: false },
        );

        viewport.addEventListener("contextmenu", ev => {
            ev.preventDefault();
            ev.stopPropagation();
        });
    }

    renderInspector(context: ElementInspectorContext): void {
        const { element, callbacks, sections } = context;
        context.renderLabelField({ label: "Bezeichnung" });

        const bindings = getViewBindings();
        const field = createElementsField(sections.body, { label: "Feature" });
        field.fieldEl.addClass("sm-le-field");

        if (!bindings.length) {
            const notice = field.controlEl.createDiv({ cls: "sm-le-empty", text: "Kein kompatibles Feature registriert." });
            notice.addClass("sm-le-view-binding-empty");
            return;
        }

        const options = [
            { value: "", label: "Feature auswählen…" },
            ...bindings.map(binding => ({ value: binding.id, label: binding.label })),
        ];
        const select = createElementsSelect(field.controlEl, { options, value: element.viewBindingId ?? "" });
        ensureFieldLabelFor(field, select);
        select.onchange = () => {
            const next = select.value || undefined;
            if (next === element.viewBindingId) return;
            element.viewBindingId = next;
            callbacks.syncElementElement(element);
            callbacks.refreshExport();
            callbacks.updateStatus();
            callbacks.pushHistory();
            callbacks.renderInspector();
        };

        const metaHost = field.controlEl.createDiv({ cls: "sm-le-view-binding-meta" });
        if (element.viewBindingId) {
            const binding = getViewBinding(element.viewBindingId);
            if (binding?.description) {
                createElementsMeta(metaHost, binding.description);
            } else {
                createElementsMeta(metaHost, `ID: ${element.viewBindingId}`);
            }
        } else {
            createElementsMeta(metaHost, "Wähle ein Feature, um den Container zu verbinden.");
        }
    }
}

const viewContainerComponent = new ViewContainerComponent();

export default viewContainerComponent;
