package src.view.slotcontent.main.dungeonmap;

public record DungeonMapViewInputEvent(
        boolean press,
        boolean drag,
        boolean move,
        boolean release,
        boolean scroll,
        CanvasButtons buttons,
        CanvasModifiers modifiers,
        CanvasPosition position,
        double scrollDeltaY
) {

    public DungeonMapViewInputEvent {
        buttons = buttons == null ? new CanvasButtons(false, false, false) : buttons;
        modifiers = modifiers == null ? new CanvasModifiers(false, false, false) : modifiers;
        position = position == null ? new CanvasPosition(0.0, 0.0) : position;
    }

    public record CanvasPosition(
            double canvasX,
            double canvasY
    ) {
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
}
