package src.view.leftbartabs.dungeoneditor;

public record DungeonEditorMainViewInputEvent(
        Source source,
        double canvasX,
        double canvasY,
        boolean primaryButtonDown,
        boolean secondaryButtonDown,
        String hitRef,
        int levelDelta
) {

    public DungeonEditorMainViewInputEvent {
        source = source == null ? Source.POINTER_MOVED : source;
        hitRef = hitRef == null ? "" : hitRef;
    }

    public enum Source {
        POINTER_PRESSED,
        POINTER_DRAGGED,
        POINTER_RELEASED,
        POINTER_MOVED,
        LEVEL_SCROLLED
    }
}
