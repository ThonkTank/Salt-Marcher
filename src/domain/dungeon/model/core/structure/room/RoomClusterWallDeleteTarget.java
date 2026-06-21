package src.domain.dungeon.model.core.structure.room;

import java.util.List;
import src.domain.dungeon.model.core.geometry.Edge;

public record RoomClusterWallDeleteTarget(List<Edge> edges, TargetKind kind) {
    public RoomClusterWallDeleteTarget {
        edges = edges == null ? List.of() : List.copyOf(edges);
        kind = kind == null ? TargetKind.NONE : kind;
    }

    static RoomClusterWallDeleteTarget interior(List<Edge> edges) {
        return new RoomClusterWallDeleteTarget(edges, TargetKind.INTERIOR_RUN);
    }

    static RoomClusterWallDeleteTarget protectedExteriorTarget() {
        return new RoomClusterWallDeleteTarget(List.of(), TargetKind.PROTECTED_EXTERIOR);
    }

    static RoomClusterWallDeleteTarget none() {
        return new RoomClusterWallDeleteTarget(List.of(), TargetKind.NONE);
    }

    public boolean isProtectedExterior() {
        return kind == TargetKind.PROTECTED_EXTERIOR;
    }

    public boolean interiorRun() {
        return kind == TargetKind.INTERIOR_RUN && !edges.isEmpty();
    }

    public enum TargetKind {
        INTERIOR_RUN,
        PROTECTED_EXTERIOR,
        NONE
    }
}
