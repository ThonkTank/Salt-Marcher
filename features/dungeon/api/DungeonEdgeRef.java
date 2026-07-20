package features.dungeon.api;

public record DungeonEdgeRef(
        DungeonCellRef from,
        DungeonCellRef to
) {
}
