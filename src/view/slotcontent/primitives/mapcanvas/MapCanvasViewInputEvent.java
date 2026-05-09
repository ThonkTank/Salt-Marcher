package src.view.slotcontent.primitives.mapcanvas;

import org.jspecify.annotations.Nullable;

public record MapCanvasViewInputEvent(
        Interaction interaction,
        CanvasButtons buttons,
        CanvasModifiers modifiers,
        CanvasPosition position,
        @Nullable CanvasHit hit,
        double scrollDeltaY,
        double dragDeltaX,
        double dragDeltaY
) {

    public MapCanvasViewInputEvent {
        interaction = interaction == null ? Interaction.MOVE : interaction;
        buttons = buttons == null ? new CanvasButtons(false, false, false) : buttons;
        modifiers = modifiers == null ? new CanvasModifiers(false, false, false) : modifiers;
        position = position == null ? CanvasPosition.origin() : position;
    }

    static CanvasPrimitive defaultPrimitive(@Nullable CanvasPrimitive primitive) {
        return primitive == null ? CanvasPrimitive.EMPTY : primitive;
    }

    public record CanvasPosition(
            double canvasX,
            double canvasY,
            double sceneX,
            double sceneY
    ) {
        public static CanvasPosition origin() {
            return new CanvasPosition(0.0, 0.0, 0.0, 0.0);
        }
    }

    public record CanvasButtons(
            boolean primaryButtonDown,
            boolean middleButtonDown,
            boolean secondaryButtonDown
    ) {
    }

    public record CanvasModifiers(
            boolean controlDown,
            boolean shiftDown,
            boolean altDown
    ) {
    }

    public record CanvasHit(
            String hitRef,
            CanvasPrimitive primitive,
            @Nullable String selectionRef
    ) {

        public CanvasHit {
            hitRef = hitRef == null ? "" : hitRef;
            primitive = defaultPrimitive(primitive);
        }
    }

    public enum Interaction {
        PRESS,
        DRAG,
        RELEASE,
        MOVE,
        SCROLL;

        public boolean isDrag() {
            return this == DRAG;
        }

        public boolean isScroll() {
            return this == SCROLL;
        }
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
