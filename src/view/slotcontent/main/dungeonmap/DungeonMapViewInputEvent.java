package src.view.slotcontent.main.dungeonmap;

public record DungeonMapViewInputEvent(
        CanvasInput input,
        CanvasButtons buttons,
        CanvasModifiers modifiers,
        CanvasPosition position,
        double scrollDeltaY,
        String textInput,
        int clickCount
    ) {

    public DungeonMapViewInputEvent {
        input = input == null ? new CanvasInput(false, false, true, false, false, false, false, false, false) : input;
        buttons = buttons == null ? new CanvasButtons(false, false, false) : buttons;
        modifiers = modifiers == null ? new CanvasModifiers(false, false, false) : modifiers;
        position = position == null ? new CanvasPosition(0.0, 0.0) : position;
        textInput = textInput == null ? "" : textInput;
        clickCount = Math.max(0, clickCount);
    }

    public record CanvasInput(
            boolean mousePressed,
            boolean mouseDragged,
            boolean mouseMoved,
            boolean mouseReleased,
            boolean scrolled,
            boolean escapePressed,
            boolean labelEditCommitted,
            boolean labelEditCancelled,
            boolean labelEditTextChanged
    ) {
        public CanvasInput {
            int rawEvents = 0;
            rawEvents += mousePressed ? 1 : 0;
            rawEvents += mouseDragged ? 1 : 0;
            rawEvents += mouseMoved ? 1 : 0;
            rawEvents += mouseReleased ? 1 : 0;
            rawEvents += scrolled ? 1 : 0;
            rawEvents += escapePressed ? 1 : 0;
            rawEvents += labelEditCommitted ? 1 : 0;
            rawEvents += labelEditCancelled ? 1 : 0;
            rawEvents += labelEditTextChanged ? 1 : 0;
            int exactlyOneRawInput = Boolean.TRUE.compareTo(Boolean.FALSE);
            if (rawEvents != exactlyOneRawInput) {
                throw new IllegalArgumentException("Exactly one raw canvas input must be selected.");
            }
        }
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
