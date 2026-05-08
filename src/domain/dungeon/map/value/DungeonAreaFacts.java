package src.domain.dungeon.map.value;

import java.util.List;
import java.util.Objects;

public final class DungeonAreaFacts {
    private final DungeonAreaType kind;
    private final long id;
    private final long clusterId;
    private final String label;
    private final List<DungeonCell> cells;
    private final DungeonTopologyRef topologyRef;

    public DungeonAreaFacts(
            DungeonAreaType kind,
            long id,
            String label,
            List<DungeonCell> cells
    ) {
        this(kind, id, 0L, label, cells);
    }

    public DungeonAreaFacts(
            DungeonAreaType kind,
            long id,
            long clusterId,
            String label,
            List<DungeonCell> cells
    ) {
        this(kind, id, clusterId, label, cells, defaultTopologyRef(kind, id));
    }

    public DungeonAreaFacts(
            DungeonAreaType kind,
            long id,
            long clusterId,
            String label,
            List<DungeonCell> cells,
            DungeonTopologyRef topologyRef
    ) {
        this.kind = kind == null ? DungeonAreaType.ROOM : kind;
        this.id = id;
        this.clusterId = Math.max(0L, clusterId);
        this.label = label == null || label.isBlank() ? "Area" : label;
        this.cells = cells == null ? List.of() : List.copyOf(cells);
        this.topologyRef = topologyRef == null
                ? new DungeonTopologyRef(DungeonTopologyElementKind.fromAreaType(this.kind), id)
                : topologyRef;
    }

    public DungeonAreaType kind() {
        return kind;
    }

    public long id() {
        return id;
    }

    public long clusterId() {
        return clusterId;
    }

    public String label() {
        return label;
    }

    public List<DungeonCell> cells() {
        return cells;
    }

    public DungeonTopologyRef topologyRef() {
        return topologyRef;
    }

    private static DungeonTopologyRef defaultTopologyRef(DungeonAreaType kind, long id) {
        DungeonAreaType safeKind = kind == null ? DungeonAreaType.ROOM : kind;
        return new DungeonTopologyRef(DungeonTopologyElementKind.fromAreaType(safeKind), id);
    }

    public boolean isCorridor() {
        return kind == DungeonAreaType.CORRIDOR;
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof DungeonAreaFacts that
                && id == that.id
                && clusterId == that.clusterId
                && Objects.equals(kind, that.kind)
                && Objects.equals(label, that.label)
                && Objects.equals(cells, that.cells)
                && Objects.equals(topologyRef, that.topologyRef);
    }

    @Override
    public int hashCode() {
        return Objects.hash(kind, id, clusterId, label, cells, topologyRef);
    }

    @Override
    public String toString() {
        return "DungeonAreaFacts[kind=" + kind
                + ", id=" + id
                + ", clusterId=" + clusterId
                + ", label=" + label
                + ", cells=" + cells
                + ", topologyRef=" + topologyRef
                + "]";
    }
}
