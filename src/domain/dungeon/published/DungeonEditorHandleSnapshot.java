package src.domain.dungeon.published;

public record DungeonEditorHandleSnapshot(
        DungeonEditorHandleRef ref,
        String label,
        DungeonCellRef cell,
        double markerQ,
        double markerR
) {
    public DungeonEditorHandleSnapshot(
            DungeonEditorHandleRef ref,
            String label,
            DungeonCellRef cell
    ) {
        this(
                ref,
                label,
                cell,
                cell == null ? Double.NaN : cell.q(),
                cell == null ? Double.NaN : cell.r());
    }

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
        markerQ = Double.isFinite(markerQ) ? markerQ : cell.q();
        markerR = Double.isFinite(markerR) ? markerR : cell.r();
    }
}
