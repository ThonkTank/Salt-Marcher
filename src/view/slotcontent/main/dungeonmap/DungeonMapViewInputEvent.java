package src.view.slotcontent.main.dungeonmap;

public record DungeonMapViewInputEvent(
        String interaction,
        CanvasButtons buttons,
        CanvasModifiers modifiers,
        CanvasPosition position,
        double scrollDeltaY,
        double dragDeltaX,
        double dragDeltaY
) {

    public DungeonMapViewInputEvent {
        interaction = interaction == null || interaction.isBlank() ? "MOVE" : interaction;
        buttons = buttons == null ? new CanvasButtons(false, false, false) : buttons;
        modifiers = modifiers == null ? new CanvasModifiers(false, false, false) : modifiers;
        position = position == null ? new CanvasPosition(0.0, 0.0, 0.0, 0.0) : position;
    }

    public record CanvasPosition(
            double canvasX,
            double canvasY,
            double sceneX,
            double sceneY
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
