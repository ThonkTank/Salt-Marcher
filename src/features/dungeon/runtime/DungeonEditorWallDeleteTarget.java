package src.features.dungeon.runtime;

import java.util.LinkedHashSet;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.room.RoomClusterWallDeleteTarget;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.EdgeKey;

record DungeonEditorWallDeleteTarget(long clusterId, Set<EdgeKey> edges, TargetKind kind) {
    DungeonEditorWallDeleteTarget {
        edges = edges == null ? Set.of() : Set.copyOf(edges);
        kind = kind == null ? TargetKind.NONE : kind;
        clusterId = kind == TargetKind.NONE ? 0L : clusterId;
    }

    static DungeonEditorWallDeleteTarget fromCore(
            long clusterId,
            RoomClusterWallDeleteTarget target
    ) {
        if (target == null) {
            return none(clusterId);
        }
        if (target.isProtectedExterior()) {
            return protectedExterior(clusterId);
        }
        if (target.interiorRun()) {
            Set<EdgeKey> edges = new LinkedHashSet<>();
            for (Edge edge : target.edges()) {
                edges.add(DungeonEditorCoreWallGeometry.runtimeEdge(edge));
            }
            return new DungeonEditorWallDeleteTarget(clusterId, edges, TargetKind.INTERIOR_RUN);
        }
        return none(clusterId);
    }

    static DungeonEditorWallDeleteTarget protectedExterior(long clusterId) {
        return new DungeonEditorWallDeleteTarget(clusterId, Set.of(), TargetKind.PROTECTED_EXTERIOR);
    }

    static DungeonEditorWallDeleteTarget none(long clusterId) {
        return new DungeonEditorWallDeleteTarget(clusterId, Set.of(), TargetKind.NONE);
    }

    boolean protectedExterior() {
        return kind == TargetKind.PROTECTED_EXTERIOR;
    }

    boolean active() {
        return kind != TargetKind.NONE;
    }

    enum TargetKind {
        INTERIOR_RUN,
        PROTECTED_EXTERIOR,
        NONE
    }
}
