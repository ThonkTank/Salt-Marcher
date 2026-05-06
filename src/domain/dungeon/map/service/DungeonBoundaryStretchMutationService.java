package src.domain.dungeon.map.service;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.value.DungeonBoundaryKey;
import src.domain.dungeon.map.value.DungeonBoundaryTouch;
import src.domain.dungeon.map.value.DungeonBoundaryStretchValueTypes.BoundaryVertex;
import src.domain.dungeon.map.value.DungeonBoundaryStretchValueTypes.StretchEdge;
import src.domain.dungeon.map.value.DungeonBoundaryStretchValueTypes.StretchMutationResult;
import src.domain.dungeon.map.value.DungeonBoundaryStretchValueTypes.StretchSelection;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundary;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonRoomTopologyClusterWork;
import src.domain.dungeon.map.value.DungeonTopologyRef;

final class DungeonBoundaryStretchMutationService {

    private static final DungeonCorridorBindingLookupService CORRIDOR_BINDING_LOOKUP_SERVICE =
            new DungeonCorridorBindingLookupService();
    private static final DungeonClusterBoundaryGeometryService GEOMETRY_SERVICE =
            new DungeonClusterBoundaryGeometryService();
    private static final DungeonBoundaryStretchBoundaryLookupService BOUNDARY_LOOKUP_SERVICE =
            new DungeonBoundaryStretchBoundaryLookupService();
    private static final DungeonBoundaryStretchConnectorService CONNECTOR_SERVICE =
            new DungeonBoundaryStretchConnectorService();

    Optional<StretchMutationResult> applyInnerStretch(
            DungeonMap dungeonMap,
            DungeonRoomTopologyClusterWork target,
            StretchSelection stretch,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaryMap
    ) {
        Set<DungeonCell> levelCells = new LinkedHashSet<>(target.cellsAt(stretch.level()));
        if (!sourceStaysInternal(stretch, levelCells)
                || CORRIDOR_BINDING_LOOKUP_SERVICE.touchesCorridorBinding(
                dungeonMap,
                target.cluster().center(),
                target.cluster().clusterId(),
                stretch.level(),
                stretch.sourceKeys())) {
            return Optional.empty();
        }
        Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries = new LinkedHashMap<>(boundaryMap);
        if (!BOUNDARY_LOOKUP_SERVICE.innerStretchCanMove(boundaries, stretch)
                || !CONNECTOR_SERVICE.applyStretchConnectors(dungeonMap, target, stretch, levelCells, boundaries, true)
                || !replaceStretchEdges(target, stretch, levelCells, boundaries)) {
            return Optional.empty();
        }
        return Optional.of(new StretchMutationResult(
                target.cellsByLevel(),
                GEOMETRY_SERVICE.boundariesByLevel(boundaries.values())));
    }

    Optional<StretchMutationResult> applyOuterStretch(
            DungeonMap dungeonMap,
            DungeonRoomTopologyClusterWork target,
            StretchSelection stretch,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaryMap
    ) {
        Map<Integer, List<DungeonCell>> nextCellsByLevel = new LinkedHashMap<>(target.cellsByLevel());
        Set<DungeonCell> currentLevelCells = new LinkedHashSet<>(target.cellsAt(stretch.level()));
        Set<DungeonCell> stripCells = stretch.stripCells();
        if (stripCells.isEmpty()) {
            return Optional.empty();
        }
        if (stretch.movesOutward()) {
            currentLevelCells.addAll(stripCells);
        } else {
            currentLevelCells.removeAll(stripCells);
        }
        if (currentLevelCells.isEmpty()) {
            return Optional.empty();
        }
        nextCellsByLevel.put(stretch.level(), DungeonRoomCellProjector.sortedCells(currentLevelCells));
        Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries = new LinkedHashMap<>(boundaryMap);
        for (BoundaryVertex vertex : stretch.vertices()) {
            if (!BOUNDARY_LOOKUP_SERVICE.hasPerpendicularBoundary(
                    boundaries,
                    stretch.sourceKeys(),
                    vertex,
                    stretch.orientation())) {
                continue;
            }
            if (!CONNECTOR_SERVICE.applyConnectorPath(
                    dungeonMap,
                    target,
                    stretch,
                    currentLevelCells,
                    boundaries,
                    vertex)) {
                return Optional.empty();
            }
        }
        return Optional.of(new StretchMutationResult(
                nextCellsByLevel,
                GEOMETRY_SERVICE.filterBoundaries(boundaries.values(), nextCellsByLevel, target.cluster().center())));
    }

    private boolean replaceStretchEdges(
            DungeonRoomTopologyClusterWork target,
            StretchSelection stretch,
            Set<DungeonCell> levelCells,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries
    ) {
        for (StretchEdge edge : stretch.edges()) {
            boundaries.remove(edge.key());
        }
        for (StretchEdge edge : stretch.edges()) {
            DungeonEdge movedEdge = stretch.orientation().move(edge.edge(), stretch.movement());
            DungeonBoundaryKey movedKey = DungeonBoundaryKey.from(movedEdge);
            if (boundaries.containsKey(movedKey)) {
                return false;
            }
            DungeonClusterBoundary moved = GEOMETRY_SERVICE.boundaryForEdge(
                    levelCells,
                    target.cluster().center(),
                    target.cluster().clusterId(),
                    movedEdge,
                    edge.kind(),
                    preserveTopologyRef(edge, target.cluster().center()).orElse(null));
            if (moved == null) {
                return false;
            }
            boundaries.put(movedKey, moved);
        }
        return true;
    }

    private boolean sourceStaysInternal(StretchSelection stretch, Set<DungeonCell> clusterCells) {
        for (StretchEdge edge : stretch.edges()) {
            DungeonBoundaryTouch movedTouch = new DungeonBoundaryTouch(
                    stretch.orientation().move(edge.edge(), stretch.movement()).touchingCells().stream()
                            .filter(clusterCells::contains)
                            .toList());
            if (!movedTouch.valid() || !movedTouch.hasTwoInsideCells()) {
                return false;
            }
        }
        return true;
    }

    private Optional<DungeonTopologyRef> preserveTopologyRef(
            StretchEdge edge,
            DungeonCell center
    ) {
        if (edge.existing() == null) {
            return Optional.empty();
        }
        return edge.existing().topologyRef().present()
                ? Optional.of(edge.existing().topologyRef())
                : Optional.of(edge.existing().resolvedTopologyRef(center));
    }
}
