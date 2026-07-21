package features.dungeon.domain.core.structure.room;

import features.dungeon.domain.core.component.boundary.BoundarySegment;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.graph.DungeonTopologyRef;

public record RoomClusterDoorBoundaryMove(
        BoundarySegment oldDoorBoundary,
        Edge nextEdge,
        DungeonTopologyRef topologyRef
) {
}
