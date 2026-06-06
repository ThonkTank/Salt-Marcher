package src.domain.dungeon.model.worldspace;

import src.domain.dungeon.model.core.structure.topology.SpatialTopology;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.graph.DungeonRelationGraph;
import src.domain.dungeon.model.core.graph.DungeonTraversalLinkProjection;
import src.domain.dungeon.model.core.projection.DungeonAreaFacts;
import src.domain.dungeon.model.core.projection.DungeonBoundaryFacts;
import src.domain.dungeon.model.core.projection.DungeonCorridorReadProjection;
import src.domain.dungeon.model.core.projection.DungeonCorridorProjection;
import src.domain.dungeon.model.core.projection.DungeonDerivedState;
import src.domain.dungeon.model.core.projection.DungeonFeatureFacts;
import src.domain.dungeon.model.core.projection.DungeonMapFacts;
import src.domain.dungeon.model.core.projection.DungeonRoomBoundaryProjection;
import src.domain.dungeon.model.core.projection.DungeonRoomBoundaryReadProjection;
import src.domain.dungeon.model.core.projection.DungeonState;
import src.domain.dungeon.model.core.structure.corridor.Corridor;

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

    Map<Long, List<Cell>> corridorCellsByCorridor(DungeonMap dungeonMap, List<Corridor> corridors) {
        if (dungeonMap == null) {
            return Map.of();
        }
        DungeonRoomBoundaryProjection roomProjection =
                new DungeonRoomBoundaryReadProjection().project(dungeonMap.rooms().rooms(), dungeonMap.topology());
        DungeonCorridorProjection corridorProjection = new DungeonCorridorReadProjection().project(
                corridors,
                roomProjection.clustersById(),
                roomProjection.roomsById(),
                roomProjection.allRoomCells(),
                0L,
                Map.of());
        return corridorCellsByCorridor(corridorProjection);
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
                dungeonMap.transitionCatalog().transitions());
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

    private static Map<Long, List<Cell>> corridorCellsByCorridor(DungeonCorridorProjection projection) {
        Map<Long, List<Cell>> result = new LinkedHashMap<>();
        for (DungeonAreaFacts area : projection.areas()) {
            if (area != null && area.isCorridor()) {
                result.put(area.id(), nonNullCells(area.cells()));
            }
        }
        return Map.copyOf(result);
    }

    private static List<Cell> nonNullCells(List<Cell> cells) {
        List<Cell> result = new ArrayList<>();
        for (Cell cell : cells == null ? List.<Cell>of() : cells) {
            if (cell != null) {
                result.add(cell);
            }
        }
        return List.copyOf(result);
    }
}
