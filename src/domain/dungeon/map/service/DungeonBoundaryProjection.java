package src.domain.dungeon.map.service;

import src.domain.dungeon.map.entity.DungeonPrimitive;
import src.domain.dungeon.map.value.DungeonBoundaryFacts;
import src.domain.dungeon.map.value.DungeonBoundaryKey;
import src.domain.dungeon.map.value.DungeonRelationGraph;

import java.util.List;
import java.util.Map;

record DungeonBoundaryProjection(
        List<DungeonPrimitive> primitives,
        List<DungeonBoundaryFacts> boundaries,
        List<DungeonRelationGraph.ContainmentRelation> containment,
        List<DungeonRelationGraph.ConnectionRelation> connections,
        Map<DungeonBoundaryKey, Long> boundaryIdsByKey,
        long nextPrimitiveId
) {
    DungeonBoundaryProjection {
        primitives = List.copyOf(primitives);
        boundaries = List.copyOf(boundaries);
        containment = List.copyOf(containment);
        connections = List.copyOf(connections);
        boundaryIdsByKey = Map.copyOf(boundaryIdsByKey);
    }
}
