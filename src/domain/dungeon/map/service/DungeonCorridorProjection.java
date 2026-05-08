package src.domain.dungeon.map.service;

import src.domain.dungeon.map.entity.DungeonAggregate;
import src.domain.dungeon.map.entity.DungeonPrimitive;
import src.domain.dungeon.map.value.DungeonAreaFacts;
import src.domain.dungeon.map.value.DungeonBoundaryFacts;
import src.domain.dungeon.map.value.DungeonRelationGraph;

import java.util.List;

record DungeonCorridorProjection(
        long nextPrimitiveId,
        List<DungeonAggregate> aggregates,
        List<DungeonPrimitive> primitives,
        List<DungeonAreaFacts> areas,
        List<DungeonBoundaryFacts> boundaries,
        List<DungeonRelationGraph.ContainmentRelation> containment,
        List<DungeonRelationGraph.ConnectionRelation> connections
) {
    DungeonCorridorProjection {
        aggregates = aggregates == null ? List.of() : List.copyOf(aggregates);
        primitives = primitives == null ? List.of() : List.copyOf(primitives);
        areas = areas == null ? List.of() : List.copyOf(areas);
        boundaries = boundaries == null ? List.of() : List.copyOf(boundaries);
        containment = containment == null ? List.of() : List.copyOf(containment);
        connections = connections == null ? List.of() : List.copyOf(connections);
    }
}
