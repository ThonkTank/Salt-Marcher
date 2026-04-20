package src.domain.dungeon.published;

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
