package features.dungeon.api;

/**
 * Public dungeon map usage modes.
 */
public enum DungeonMapMode {
    EDITOR,
    TRAVEL;

    public static DungeonMapMode defaultMode() {
        return EDITOR;
    }
}
