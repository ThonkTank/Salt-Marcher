package features.dungeon.application.editor;

import java.util.Map;
import features.dungeon.api.DungeonEdgeRef;
import features.dungeon.api.DungeonEditorMapSnapshot;
import features.dungeon.api.DungeonTopologyElementRef;

final class DungeonEditorBoundaryPointerTargets {
    private DungeonEditorBoundaryPointerTargets() {
    }

    static void addTargets(
            Map<String, features.dungeon.api.editor.DungeonEditorPointerInput.Target> targets,
            DungeonEditorMapSnapshot map,
            DungeonEditorSurfaceProjection snapshot
    ) {
        for (DungeonEditorMapSnapshot.Boundary boundary : map.boundaries()) {
            DungeonEdgeRef edge = boundary.edge();
            if (invalidEdge(edge) || !DungeonEditorProjectionLevelInclusion.includes(snapshot, edge.from().level())) {
                continue;
            }
            String kind = boundaryKind(boundary.kind());
            features.dungeon.api.editor.DungeonEditorPointerInput.BoundaryTarget target =
                    new features.dungeon.api.editor.DungeonEditorPointerInput.BoundaryTarget(
                            "DOOR".equals(kind)
                                    ? features.dungeon.api.editor.DungeonEditorPointerInput.BoundaryKind.DOOR
                                    : features.dungeon.api.editor.DungeonEditorPointerInput.BoundaryKind.WALL,
                            boundaryKey(kind, boundary.id(), boundary.topologyRef(), edge),
                            boundary.id(),
                            features.dungeon.api.editor.DungeonEditorPointerInput.TopologyKind.fromPublished(
                                    boundary.topologyRef().kind()),
                            DungeonEditorTopologyHitRefs.topologyId(boundary.topologyRef()),
                            edge.from().q(),
                            edge.from().r(),
                            edge.from().level(),
                            edge.to().q(),
                            edge.to().r(),
                            edge.to().level());
            targets.put(DungeonEditorEdgeHitRefs.edge(kind, boundary.id(), boundary.topologyRef(), edge).value(),
                    features.dungeon.api.editor.DungeonEditorPointerInput.Target.boundary(target));
        }
    }

    private static String boundaryKey(
            String kind,
            long ownerId,
            DungeonTopologyElementRef topologyRef,
            DungeonEdgeRef edge
    ) {
        return kind + ":"
                + ownerId + ":"
                + DungeonEditorTopologyHitRefs.topologyKind(topologyRef) + ":"
                + DungeonEditorTopologyHitRefs.topologyId(topologyRef) + ":"
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
