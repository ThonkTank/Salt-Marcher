package src.domain.dungeon.published;

public record DungeonEditorEdge(
        DungeonEditorCell from,
        DungeonEditorCell to
) {

    public DungeonEditorEdge {
        from = from == null ? new DungeonEditorCell(0, 0, 0) : from;
        to = to == null ? from : to;
    }
}
