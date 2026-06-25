package src.features.dungeon.runtime;

public record PointerWorkflowGesture(
        boolean primaryButtonDown,
        boolean secondaryButtonDown,
        boolean middleButtonDown,
        boolean shiftDown,
        boolean controlDown,
        boolean wallSingleClickModeSelected
) {
    public static PointerWorkflowGesture empty() {
        return new PointerWorkflowGesture(false, false, false, false, false, false);
    }
}
