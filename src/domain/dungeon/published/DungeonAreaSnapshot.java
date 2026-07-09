package src.domain.dungeon.published;

import java.util.List;

public record DungeonAreaSnapshot(
        DungeonAreaKind kind,
        long id,
        long clusterId,
        String label,
        List<DungeonCellRef> cells,
        DungeonTopologyElementRef topologyRef
) {

    public DungeonAreaSnapshot {
        kind = kind == null ? DungeonAreaKind.ROOM : kind;
        id = Math.max(1L, id);
        clusterId = Math.max(0L, clusterId);
        label = label == null || label.isBlank() ? kind.name() : label;
        cells = cells == null ? List.of() : List.copyOf(cells);
        topologyRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
    }
}
