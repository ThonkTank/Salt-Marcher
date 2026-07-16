package features.dungeon.adapter.javafx.map;

import features.dungeon.api.DungeonEdgeRef;
import features.dungeon.api.DungeonEditorMapSnapshot;
import features.dungeon.adapter.javafx.map.DungeonMapRenderState.EdgeKind;

final class DungeonMapRenderEdges {

    private DungeonMapRenderEdges() {
    }

    static DungeonMapRenderState.Edge edge(
            DungeonEditorMapSnapshot.Boundary boundary,
            int deltaQ,
            int deltaR,
            int deltaLevel,
            boolean preview,
            boolean selected
    ) {
        DungeonEdgeRef edge = boundary.edge();
        return new DungeonMapRenderState.Edge(
                edge.from().q() + deltaQ,
                edge.from().r() + deltaR,
                edge.to().q() + deltaQ,
                edge.to().r() + deltaR,
                edge.from().level() + deltaLevel,
                boundaryKind(boundary.kind()),
                boundary.label(),
                boundary.id(),
                DungeonMapRenderElementFactory.topologyRef(boundary.topologyRef()),
                selected,
                preview);
    }

    static DungeonMapRenderState.EdgeKind boundaryKind(String kind) {
        return "DOOR".equalsIgnoreCase(kind)
                ? EdgeKind.DOOR
                : EdgeKind.WALL;
    }
}
