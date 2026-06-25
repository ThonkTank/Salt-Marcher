package src.features.dungeon.runtime;

import java.util.Map;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorMapHitRef;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;

final class DungeonEditorBoundaryPointerTargets {
    private DungeonEditorBoundaryPointerTargets() {
    }

    static void addTargets(
            Map<String, DungeonEditorRuntimePointerTarget> targets,
            DungeonEditorMapSnapshot map,
            DungeonEditorMapSurfaceSnapshot snapshot
    ) {
        for (DungeonEditorMapSnapshot.Boundary boundary : map.boundaries()) {
            DungeonEdgeRef edge = boundary.edge();
            if (invalidEdge(edge) || !DungeonEditorProjectionLevelInclusion.includes(snapshot, edge.from().level())) {
                continue;
            }
            String kind = boundaryKind(boundary.kind());
            DungeonEditorRuntimePointerTarget.BoundaryTarget target =
                    new DungeonEditorRuntimePointerTarget.BoundaryTarget(
                            DungeonEditorRuntimePointerTarget.BoundaryKind.fromLegacy(kind),
                            boundaryKey(kind, boundary.id(), boundary.topologyRef(), edge),
                            boundary.id(),
                            DungeonEditorRuntimePointerTarget.TopologyKind.fromLegacy(
                                    DungeonEditorMapHitRef.topologyKind(boundary.topologyRef())),
                            DungeonEditorMapHitRef.topologyId(boundary.topologyRef()),
                            edge.from().q(),
                            edge.from().r(),
                            edge.from().level(),
                            edge.to().q(),
                            edge.to().r(),
                            edge.to().level());
            targets.put(DungeonEditorMapHitRef.edge(kind, boundary.id(), boundary.topologyRef(), edge).value(),
                    DungeonEditorRuntimePointerTarget.boundary(target));
        }
    }

    private static String boundaryKey(
            String kind,
            long ownerId,
            DungeonEditorTopologyElementRef topologyRef,
            DungeonEdgeRef edge
    ) {
        return kind + ":"
                + ownerId + ":"
                + DungeonEditorMapHitRef.topologyKind(topologyRef) + ":"
                + DungeonEditorMapHitRef.topologyId(topologyRef) + ":"
                + (double) edge.from().q() + ":"
                + (double) edge.from().r() + ":"
                + edge.from().level() + ":"
                + (double) edge.to().q() + ":"
                + (double) edge.to().r() + ":"
                + edge.to().level();
    }

    private static String boundaryKind(String kind) {
        return "DOOR".equalsIgnoreCase(kind) ? "DOOR" : "WALL";
    }

    private static boolean invalidEdge(DungeonEdgeRef edge) {
        return edge == null || edge.from() == null || edge.to() == null;
    }
}
