package src.domain.dungeon.model.map.model;

import src.domain.dungeon.model.map.model.DungeonState;
import src.domain.dungeon.model.map.model.DungeonPrimitive;
import src.domain.dungeon.model.map.model.DungeonAreaFacts;
import src.domain.dungeon.model.map.model.DungeonBoundaryFacts;
import src.domain.dungeon.model.map.model.DungeonRelationGraph;

import java.util.List;

record DungeonCorridorProjection(
        long nextPrimitiveId,
        List<DungeonState> aggregates,
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
