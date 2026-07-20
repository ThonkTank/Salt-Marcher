package features.dungeon.domain.core.projection;

import java.util.List;
import java.util.Map;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.graph.DungeonRelationGraph;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.RoomCluster;

public record DungeonRoomBoundaryProjection(
        List<DungeonState> aggregates,
        List<DungeonAreaFacts> areas,
        List<DungeonBoundaryFacts> boundaries,
        List<DungeonRelationGraph.ContainmentRelation> containment,
        List<DungeonRelationGraph.ConnectionRelation> connections,
        Map<Long, List<Cell>> allRoomCells,
        Map<DungeonBoundaryKey, Long> boundaryIdsByKey,
        Map<Long, RoomRegion> roomsById,
        Map<Long, RoomCluster> clustersById,
        long nextBoundaryId
) {
    public DungeonRoomBoundaryProjection {
        aggregates = List.copyOf(aggregates);
        areas = List.copyOf(areas);
        boundaries = List.copyOf(boundaries);
        containment = List.copyOf(containment);
        connections = List.copyOf(connections);
        allRoomCells = Map.copyOf(allRoomCells);
        boundaryIdsByKey = Map.copyOf(boundaryIdsByKey);
        roomsById = Map.copyOf(roomsById);
        clustersById = Map.copyOf(clustersById);
    }
}
