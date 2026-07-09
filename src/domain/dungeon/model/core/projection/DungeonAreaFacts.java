package src.domain.dungeon.model.core.projection;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;

public final class DungeonAreaFacts {
    private final DungeonAreaType kind;
    private final long id;
    private final long clusterId;
    private final String label;
    private final List<Cell> cells;
    private final DungeonTopologyRef topologyRef;

    public DungeonAreaFacts(
            DungeonAreaType kind,
            long id,
            long clusterId,
            String label,
            List<Cell> cells,
            DungeonTopologyRef topologyRef
    ) {
        this.kind = kind == null ? DungeonAreaType.ROOM : kind;
        this.id = id;
        this.clusterId = Math.max(0L, clusterId);
        this.label = label == null || label.isBlank() ? "Area" : label;
        this.cells = cells == null ? List.of() : List.copyOf(cells);
        this.topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
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

    public List<Cell> cells() {
        return cells;
    }

    public DungeonTopologyRef topologyRef() {
        return topologyRef;
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
