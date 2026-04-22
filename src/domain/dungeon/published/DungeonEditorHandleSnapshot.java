package src.domain.dungeon.published;

public record DungeonEditorHandleSnapshot(
        DungeonEditorHandleRef ref,
        String label,
        DungeonCellRef cell
) {

    public DungeonEditorHandleSnapshot {
        ref = ref == null
                ? new DungeonEditorHandleRef(
                        DungeonEditorHandleKind.CLUSTER_LABEL,
                        DungeonTopologyElementRef.empty(),
                        0L,
                        0L,
                        0L,
                        0L,
                        0,
                        new DungeonCellRef(0, 0, 0),
                        "")
                : ref;
        label = label == null || label.isBlank() ? ref.kind().name() : label.trim();
        cell = cell == null ? ref.cell() : cell;
    }
}
