package src.domain.dungeon.published;

public record DungeonEditorBoundaryTargetRef(
        DungeonBoundaryKind kind,
        String key,
        long ownerId,
        DungeonTopologyElementRef topologyRef,
        DungeonCellRef start,
        DungeonCellRef end
) {
    public DungeonEditorBoundaryTargetRef {
        kind = kind == null ? DungeonBoundaryKind.WALL : kind;
        key = key == null ? "" : key.strip();
        ownerId = Math.max(0L, ownerId);
        topologyRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
        start = start == null ? zeroCell() : start;
        end = end == null ? zeroCell() : end;
    }

    public static DungeonEditorBoundaryTargetRef empty() {
        return new DungeonEditorBoundaryTargetRef(
                DungeonBoundaryKind.WALL,
                "",
                0L,
                DungeonTopologyElementRef.empty(),
                zeroCell(),
                zeroCell());
    }

    private static DungeonCellRef zeroCell() {
        return new DungeonCellRef(0, 0, 0);
    }
}
