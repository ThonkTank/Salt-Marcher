package src.domain.dungeon.model.core.projection;

import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.graph.DungeonRelationGraph;
import src.domain.dungeon.model.worldspace.DungeonRoom;
import src.domain.dungeon.model.worldspace.DungeonRoomCluster;

public record DungeonRoomBoundaryProjection(
        List<DungeonState> aggregates,
        List<DungeonAreaFacts> areas,
        List<DungeonBoundaryFacts> boundaries,
        List<DungeonRelationGraph.ContainmentRelation> containment,
        List<DungeonRelationGraph.ConnectionRelation> connections,
        Map<Long, List<Cell>> allRoomCells,
        Map<DungeonBoundaryKey, Long> boundaryIdsByKey,
        Map<Long, DungeonRoom> roomsById,
        Map<Long, DungeonRoomCluster> clustersById,
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
