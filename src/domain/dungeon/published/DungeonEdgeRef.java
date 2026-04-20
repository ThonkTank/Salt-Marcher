package src.domain.dungeon.published;

public record DungeonEdgeRef(
        DungeonCellRef from,
        DungeonCellRef to
) {
}
