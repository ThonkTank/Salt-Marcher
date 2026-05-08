package src.domain.dungeon.map.service;

import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonAggregate;
import src.domain.dungeon.map.entity.DungeonPrimitive;
import src.domain.dungeon.map.value.DungeonAreaFacts;
import src.domain.dungeon.map.value.DungeonBoundaryFacts;
import src.domain.dungeon.map.value.DungeonDerivedState;
import src.domain.dungeon.map.value.DungeonFeatureFacts;
import src.domain.dungeon.map.value.DungeonMapFacts;
import src.domain.dungeon.map.value.DungeonRelationGraph;
import src.domain.dungeon.map.value.SpatialTopology;
import java.util.ArrayList;
import java.util.List;

/**
 * Rebuilds read-side dungeon state from authored dungeon truth.
 */
public final class DungeonDerivedStateProjector {

    public DungeonDerivedState project(DungeonMap dungeonMap) {
        SpatialTopology topology = dungeonMap == null ? SpatialTopology.empty() : dungeonMap.topology();
        if (dungeonMap != null && !dungeonMap.rooms().rooms().isEmpty() && topology.hasAuthoredRooms()) {
            return authoredState(dungeonMap, topology);
        }
        return emptyState(topology);
    }

    private DungeonDerivedState authoredState(DungeonMap dungeonMap, SpatialTopology topology) {
        List<DungeonFeatureFacts> features = new ArrayList<>();
        List<DungeonRelationGraph.FeatureRelation> featureRelations = new ArrayList<>();
        DungeonRoomBoundaryProjection roomProjection =
                new DungeonRoomBoundaryReadProjector().project(dungeonMap, topology);
        DungeonCorridorReadProjector corridorReadProjector = new DungeonCorridorReadProjector();
        DungeonCorridorProjection corridorProjection = corridorReadProjector.project(
                dungeonMap.connections().corridors(),
                roomProjection.clustersById(),
                roomProjection.roomsById(),
                roomProjection.allRoomCells(),
                roomProjection.nextPrimitiveId(),
                roomProjection.boundaryIdsByKey());
        DungeonFeatureReadProjector.Result featureProjection = new DungeonFeatureReadProjector().project(
                dungeonMap.connections().stairs(),
                dungeonMap.connections().transitions());
        features.addAll(featureProjection.features());
        featureRelations.addAll(featureProjection.relations());

        List<DungeonAggregate> aggregates = new ArrayList<>(roomProjection.aggregates());
        aggregates.addAll(corridorProjection.aggregates());
        List<DungeonPrimitive> primitives = new ArrayList<>(roomProjection.primitives());
        primitives.addAll(corridorProjection.primitives());
        List<DungeonAreaFacts> areas = new ArrayList<>(roomProjection.areas());
        areas.addAll(corridorProjection.areas());
        List<DungeonBoundaryFacts> boundaries = new ArrayList<>(roomProjection.boundaries());
        boundaries.addAll(corridorProjection.boundaries());
        List<DungeonRelationGraph.ContainmentRelation> containment = new ArrayList<>(roomProjection.containment());
        containment.addAll(corridorProjection.containment());
        List<DungeonRelationGraph.ConnectionRelation> connections = new ArrayList<>(roomProjection.connections());
        connections.addAll(corridorProjection.connections());

        DungeonMapFacts map = new DungeonMapFacts(
                topology.topology(),
                topology.width(),
                topology.height(),
                areas,
                boundaries,
                features);
        return new DungeonDerivedState(
                map,
                aggregates,
                primitives,
                new DungeonRelationGraph(containment, connections, featureRelations),
                new DungeonTraversalLinkProjector().project(dungeonMap, map));
    }

    private DungeonDerivedState emptyState(SpatialTopology topology) {
        DungeonMapFacts map = new DungeonMapFacts(
                topology.topology(),
                topology.width(),
                topology.height(),
                List.of(),
                List.of(),
                List.of());
        return new DungeonDerivedState(
                map,
                List.of(),
                List.of(),
                new DungeonRelationGraph(List.of(), List.of()),
                List.of());
    }
}
