package src.domain.dungeon.model.core.projection;

import java.util.Objects;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.worldspace.DungeonEdge;

public final class DungeonBoundaryFacts {
    private static final String DOOR_KIND = "door";
    private static final String OPEN_KIND = "open";

    private final String kind;
    private final long id;
    private final String label;
    private final DungeonEdge edge;
    private final DungeonTopologyRef topologyRef;

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
                ? new DungeonTopologyRef(topologyKind(kind), id)
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

    private static DungeonTopologyElementKind topologyKind(String kind) {
        if (kind == null || kind.isBlank()) {
            return DungeonTopologyElementKind.WALL;
        }
        String normalized = kind.trim();
        if (DOOR_KIND.equalsIgnoreCase(normalized)) {
            return DungeonTopologyElementKind.DOOR;
        }
        if (OPEN_KIND.equalsIgnoreCase(normalized)) {
            return DungeonTopologyElementKind.EMPTY;
        }
        return DungeonTopologyElementKind.WALL;
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
