package src.domain.dungeon.model.worldspace;


import java.util.List;
import java.util.Map;

record DungeonRoomBoundaryProjection(
        List<DungeonState> aggregates,
        List<DungeonAreaFacts> areas,
        List<DungeonBoundaryFacts> boundaries,
        List<DungeonRelationGraph.ContainmentRelation> containment,
        List<DungeonRelationGraph.ConnectionRelation> connections,
        Map<Long, List<DungeonCell>> allRoomCells,
        Map<DungeonBoundaryKey, Long> boundaryIdsByKey,
        Map<Long, DungeonRoom> roomsById,
        Map<Long, DungeonRoomCluster> clustersById,
        long nextBoundaryId
) {
    DungeonRoomBoundaryProjection {
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
