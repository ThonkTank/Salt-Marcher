package src.domain.dungeon.map.service;

import src.domain.dungeon.map.entity.DungeonAggregate;
import src.domain.dungeon.map.entity.DungeonPrimitive;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.value.DungeonAreaFacts;
import src.domain.dungeon.map.value.DungeonBoundaryFacts;
import src.domain.dungeon.map.value.DungeonBoundaryKey;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonRelationGraph;

import java.util.List;
import java.util.Map;

record DungeonRoomBoundaryProjection(
        List<DungeonAggregate> aggregates,
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
