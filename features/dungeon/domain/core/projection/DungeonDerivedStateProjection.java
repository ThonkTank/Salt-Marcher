package features.dungeon.domain.core.projection;


import java.util.ArrayList;
import java.util.List;
import features.dungeon.domain.core.graph.DungeonRelationGraph;
import features.dungeon.domain.core.graph.DungeonTraversalLinkProjection;
import features.dungeon.domain.core.structure.topology.SpatialTopology;
import features.dungeon.domain.core.structure.DungeonMap;

/**
 * Rebuilds read-side dungeon state from authored dungeon truth.
 */
public final class DungeonDerivedStateProjection {

    public DungeonDerivedState project(DungeonMap dungeonMap) {
        SpatialTopology topology = dungeonMap == null ? SpatialTopology.empty() : dungeonMap.topology();
        if (hasAuthoredContent(dungeonMap, topology)) {
            return authoredState(dungeonMap, topology);
        }
        return emptyState(topology);
    }

    private static boolean hasAuthoredContent(DungeonMap dungeonMap, SpatialTopology topology) {
        if (dungeonMap == null) {
            return false;
        }
        return !dungeonMap.rooms().rooms().isEmpty()
                || !dungeonMap.corridors().isEmpty()
                || !dungeonMap.stairs().stairs().isEmpty()
                || !dungeonMap.transitionCatalog().transitions().isEmpty()
                || !dungeonMap.featureMarkers().markers().isEmpty()
                || topology.hasAuthoredRooms();
    }

    private DungeonDerivedState authoredState(DungeonMap dungeonMap, SpatialTopology topology) {
        List<DungeonFeatureFacts> features = new ArrayList<>();
        List<DungeonRelationGraph.FeatureRelation> featureRelations = new ArrayList<>();
        DungeonRoomBoundaryProjection roomProjection =
                new DungeonRoomBoundaryReadProjection().project(dungeonMap.rooms().rooms(), topology);
        DungeonCorridorReadProjection corridorReadProjector = new DungeonCorridorReadProjection();
        DungeonCorridorProjection corridorProjection = corridorReadProjector.project(
                dungeonMap.corridors(),
                roomProjection.clustersById(),
                roomProjection.roomsById(),
                roomProjection.allRoomCells(),
                roomProjection.nextBoundaryId(),
                roomProjection.boundaryIdsByKey());
        DungeonFeatureReadProjection.Result featureProjection = new DungeonFeatureReadProjection().project(
                dungeonMap.stairs(),
                dungeonMap.transitionCatalog().transitions(),
                dungeonMap.featureMarkers().markers());
        features.addAll(featureProjection.features());
        featureRelations.addAll(featureProjection.relations());

        List<DungeonState> aggregates = new ArrayList<>(roomProjection.aggregates());
        aggregates.addAll(corridorProjection.aggregates());
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
                new DungeonRelationGraph(List.of(), List.of()),
                List.of());
    }

}
