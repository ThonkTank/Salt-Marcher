package features.dungeon.api.editor;

/** Semantic pointer intent independent of JavaFX button events. */
public record DungeonEditorPointerGesture(
        Button button,
        boolean shiftDown,
        boolean controlDown
) {
    public DungeonEditorPointerGesture {
        button = button == null ? Button.NONE : button;
    }

    public static DungeonEditorPointerGesture none() {
        return new DungeonEditorPointerGesture(Button.NONE, false, false);
    }

    public boolean primary() {
        return button == Button.PRIMARY;
    }

    public boolean secondary() {
        return button == Button.SECONDARY;
    }

    public boolean middle() {
        return button == Button.MIDDLE;
    }

    public enum Button {
        NONE,
        PRIMARY,
        SECONDARY,
        MIDDLE
    }
}
