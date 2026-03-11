package features.world.dungeonmap.model;

public record DungeonSelection(
        SelectionType type,
        Long id,
        DungeonSquare square,
        DungeonRoom room,
        DungeonArea area,
        DungeonEndpoint endpoint,
        DungeonLink link
) {
    public enum SelectionType {
        NONE,
        SQUARE,
        ROOM,
        AREA,
        ENDPOINT,
        LINK
    }

    public static DungeonSelection none() {
        return new DungeonSelection(SelectionType.NONE, null, null, null, null, null, null);
    }
}
