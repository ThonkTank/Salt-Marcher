package src.domain.dungeon.model.map.model;

import java.util.Objects;

public final class DungeonBoundaryFacts {
    private final String kind;
    private final long id;
    private final String label;
    private final DungeonEdge edge;
    private final DungeonTopologyRef topologyRef;

    public DungeonBoundaryFacts(
            String kind,
            long id,
            String label,
            DungeonEdge edge
    ) {
        this(kind, id, label, edge, defaultTopologyRef(kind, id));
    }

    public DungeonBoundaryFacts(
            String kind,
            long id,
            String label,
            DungeonEdge edge,
            DungeonTopologyRef topologyRef
    ) {
        this.kind = kind == null || kind.isBlank() ? "boundary" : kind;
        this.id = id;
        this.label = label == null || label.isBlank() ? "Boundary" : label;
        this.edge = edge;
        this.topologyRef = topologyRef == null
                ? new DungeonTopologyRef(DungeonTopologyElementKind.fromBoundaryKind(kind), id)
                : topologyRef;
    }

    public String kind() {
        return kind;
    }

    public long id() {
        return id;
    }

    public String label() {
        return label;
    }

    public DungeonEdge edge() {
        return edge;
    }

    public DungeonTopologyRef topologyRef() {
        return topologyRef;
    }

    private static DungeonTopologyRef defaultTopologyRef(String kind, long id) {
        String safeKind = kind == null || kind.isBlank() ? "boundary" : kind;
        return new DungeonTopologyRef(DungeonTopologyElementKind.fromBoundaryKind(safeKind), id);
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof DungeonBoundaryFacts that
                && id == that.id
                && Objects.equals(kind, that.kind)
                && Objects.equals(label, that.label)
                && Objects.equals(edge, that.edge)
                && Objects.equals(topologyRef, that.topologyRef);
    }

    @Override
    public int hashCode() {
        return Objects.hash(kind, id, label, edge, topologyRef);
    }

    @Override
    public String toString() {
        return "DungeonBoundaryFacts[kind=" + kind
                + ", id=" + id
                + ", label=" + label
                + ", edge=" + edge
                + ", topologyRef=" + topologyRef
                + "]";
    }
}
