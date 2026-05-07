package src.view.slotcontent.primitives.mapcanvas;

import org.jspecify.annotations.Nullable;

public record CanvasPointerEvent(
        PointerPhase phase,
        CanvasButtons buttons,
        CanvasModifiers modifiers,
        MapCanvasPoint canvasPoint,
        @Nullable CanvasHit hit
) {

    public CanvasPointerEvent {
        phase = phase == null ? PointerPhase.MOVE : phase;
        buttons = buttons == null ? new CanvasButtons(false, false) : buttons;
        modifiers = modifiers == null ? new CanvasModifiers(false, false, false) : modifiers;
        canvasPoint = canvasPoint == null ? new MapCanvasPoint(0.0, 0.0) : canvasPoint;
    }

    public record CanvasButtons(boolean primaryButtonDown, boolean secondaryButtonDown) {
    }

    public record CanvasModifiers(boolean controlDown, boolean shiftDown, boolean altDown) {
    }

    public record CanvasHit(String hitRef, CanvasPrimitive primitive, @Nullable String selectionRef) {

        public CanvasHit {
            hitRef = hitRef == null ? "" : hitRef;
            primitive = primitive == null ? CanvasPrimitive.EMPTY : primitive;
        }
    }

    public enum PointerPhase {
        PRESS,
        DRAG,
        RELEASE,
        MOVE
    }

    public enum CanvasPrimitive {
        EMPTY,
        SURFACE,
        BOUNDARY,
        GLYPH,
        TEXT,
        RELATION,
        ACTOR,
        OVERLAY
    }
}
