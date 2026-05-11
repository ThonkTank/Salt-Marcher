package src.domain.dungeon.model.map.model;

import src.domain.dungeon.model.map.model.DungeonState;
import src.domain.dungeon.model.map.model.DungeonPrimitive;
import src.domain.dungeon.model.map.model.DungeonRoom;
import src.domain.dungeon.model.map.model.DungeonRoomCluster;
import src.domain.dungeon.model.map.model.DungeonAreaFacts;
import src.domain.dungeon.model.map.model.DungeonBoundaryFacts;
import src.domain.dungeon.model.map.model.DungeonBoundaryKey;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonRelationGraph;

import java.util.List;
import java.util.Map;

record DungeonRoomBoundaryProjection(
        List<DungeonState> aggregates,
        List<DungeonPrimitive> primitives,
        List<DungeonAreaFacts> areas,
        List<DungeonBoundaryFacts> boundaries,
        List<DungeonRelationGraph.ContainmentRelation> containment,
        List<DungeonRelationGraph.ConnectionRelation> connections,
        Map<Long, List<DungeonCell>> allRoomCells,
        Map<DungeonBoundaryKey, Long> boundaryIdsByKey,
        Map<Long, DungeonRoom> roomsById,
        Map<Long, DungeonRoomCluster> clustersById,
        long nextPrimitiveId
) {
    DungeonRoomBoundaryProjection {
        aggregates = List.copyOf(aggregates);
        primitives = List.copyOf(primitives);
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
