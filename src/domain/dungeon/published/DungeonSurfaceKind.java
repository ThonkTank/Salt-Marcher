package src.domain.dungeon.published;

public enum DungeonSurfaceKind {
    EDITOR,
    PREVIEW;

    public static DungeonSurfaceKind defaultKind() {
        return EDITOR;
    }
}
