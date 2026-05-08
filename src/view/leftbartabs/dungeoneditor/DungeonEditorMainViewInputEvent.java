package src.view.leftbartabs.dungeoneditor;

public record DungeonEditorMainViewInputEvent(
        PointerPhase pointerPhase,
        double canvasX,
        double canvasY,
        boolean primaryButtonDown,
        boolean secondaryButtonDown,
        String hitRef,
        int levelDelta
) {

    public DungeonEditorMainViewInputEvent {
        pointerPhase = pointerPhase == null ? PointerPhase.MOVE : pointerPhase;
        hitRef = hitRef == null ? "" : hitRef;
    }

    public enum PointerPhase {
        PRESS,
        DRAG,
        RELEASE,
        MOVE,
        LEVEL_SCROLLED
    }
}
