package src.view.leftbartabs.dungeoneditor;

public record DungeonEditorMainViewInputEvent(
        Kind kind,
        double canvasX,
        double canvasY,
        boolean primaryButtonDown,
        boolean secondaryButtonDown,
        String hitRef,
        int levelDelta
) {

    public DungeonEditorMainViewInputEvent {
        kind = kind == null ? Kind.POINTER_MOVED : kind;
        hitRef = hitRef == null ? "" : hitRef;
    }

    static DungeonEditorMainViewInputEvent pointerPressed(
            double canvasX,
            double canvasY,
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
            String hitRef
    ) {
        return new DungeonEditorMainViewInputEvent(
                Kind.POINTER_PRESSED,
                canvasX,
                canvasY,
                primaryButtonDown,
                secondaryButtonDown,
                hitRef,
                0);
    }

    static DungeonEditorMainViewInputEvent pointerDragged(
            double canvasX,
            double canvasY,
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
            String hitRef
    ) {
        return new DungeonEditorMainViewInputEvent(
                Kind.POINTER_DRAGGED,
                canvasX,
                canvasY,
                primaryButtonDown,
                secondaryButtonDown,
                hitRef,
                0);
    }

    static DungeonEditorMainViewInputEvent pointerReleased(
            double canvasX,
            double canvasY,
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
            String hitRef
    ) {
        return new DungeonEditorMainViewInputEvent(
                Kind.POINTER_RELEASED,
                canvasX,
                canvasY,
                primaryButtonDown,
                secondaryButtonDown,
                hitRef,
                0);
    }

    static DungeonEditorMainViewInputEvent pointerMoved(
            double canvasX,
            double canvasY,
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
            String hitRef
    ) {
        return new DungeonEditorMainViewInputEvent(
                Kind.POINTER_MOVED,
                canvasX,
                canvasY,
                primaryButtonDown,
                secondaryButtonDown,
                hitRef,
                0);
    }

    static DungeonEditorMainViewInputEvent levelScrolled(int levelDelta) {
        return new DungeonEditorMainViewInputEvent(
                Kind.LEVEL_SCROLLED,
                0.0,
                0.0,
                false,
                false,
                "",
                levelDelta);
    }

    public enum Kind {
        POINTER_PRESSED,
        POINTER_DRAGGED,
        POINTER_RELEASED,
        POINTER_MOVED,
        LEVEL_SCROLLED
    }
}
