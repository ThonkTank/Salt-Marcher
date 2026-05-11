package src.domain.dungeon.model.map.model;

import src.domain.dungeon.model.map.model.DungeonMap;
import src.domain.dungeon.model.map.model.DungeonState;
import src.domain.dungeon.model.map.model.DungeonPrimitive;
import src.domain.dungeon.model.map.model.DungeonAreaFacts;
import src.domain.dungeon.model.map.model.DungeonBoundaryFacts;
import src.domain.dungeon.model.map.model.DungeonDerivedState;
import src.domain.dungeon.model.map.model.DungeonFeatureFacts;
import src.domain.dungeon.model.map.model.DungeonMapFacts;
import src.domain.dungeon.model.map.model.DungeonRelationGraph;
import src.domain.dungeon.model.map.model.SpatialTopology;
import java.util.ArrayList;
import java.util.List;

/**
 * Rebuilds read-side dungeon state from authored dungeon truth.
 */
public final class DungeonDerivedStateProjection {

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
                new DungeonRoomBoundaryReadProjection().project(dungeonMap, topology);
        DungeonCorridorReadProjection corridorReadProjector = new DungeonCorridorReadProjection();
        DungeonCorridorProjection corridorProjection = corridorReadProjector.project(
                dungeonMap.connections().corridors(),
                roomProjection.clustersById(),
                roomProjection.roomsById(),
                roomProjection.allRoomCells(),
                roomProjection.nextPrimitiveId(),
                roomProjection.boundaryIdsByKey());
        DungeonFeatureReadProjection.Result featureProjection = new DungeonFeatureReadProjection().project(
                dungeonMap.connections().stairs(),
                dungeonMap.connections().transitions());
        features.addAll(featureProjection.features());
        featureRelations.addAll(featureProjection.relations());

        List<DungeonState> aggregates = new ArrayList<>(roomProjection.aggregates());
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
                new DungeonTraversalLinkProjection().project(dungeonMap, map));
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
