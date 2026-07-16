package features.dungeon.api;

public record DungeonEditorTopologyElementRef(
        String kind,
        long id
) {

    public DungeonEditorTopologyElementRef {
        kind = kind == null || kind.isBlank() ? "EMPTY" : kind.trim();
        id = Math.max(0L, id);
    }

    public static DungeonEditorTopologyElementRef empty() {
        return new DungeonEditorTopologyElementRef("EMPTY", 0L);
    }
}
