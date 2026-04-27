package src.domain.dungeon.published;

public enum DungeonSurfaceKind {
    EDITOR,
    PREVIEW,
    TRAVEL;

    public static DungeonSurfaceKind defaultKind() {
        return EDITOR;
    }
}
