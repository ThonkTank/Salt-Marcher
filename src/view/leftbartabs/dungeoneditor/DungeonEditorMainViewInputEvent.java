package src.view.leftbartabs.dungeoneditor;

public record DungeonEditorMainViewInputEvent(
        String pointerPhaseKey,
        double canvasX,
        double canvasY,
        boolean primaryButtonDown,
        boolean secondaryButtonDown,
        String hitRef,
        int levelDelta
) {

    public DungeonEditorMainViewInputEvent {
        pointerPhaseKey = pointerPhaseKey == null ? "" : pointerPhaseKey;
        hitRef = hitRef == null ? "" : hitRef;
    }
}
