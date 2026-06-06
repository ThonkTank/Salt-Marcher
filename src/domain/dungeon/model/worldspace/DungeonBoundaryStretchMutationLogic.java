package src.domain.dungeon.model.worldspace;

import src.domain.dungeon.model.core.structure.room.DungeonClusterBoundary;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.CellOrdering;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryTouch;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.corridor.CorridorDoorBindingGeometry;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryStretchPlan.BoundaryVertex;
import src.domain.dungeon.model.worldspace.DungeonBoundaryStretchValueTypes.StretchEdge;
import src.domain.dungeon.model.worldspace.DungeonBoundaryStretchValueTypes.StretchMutationResult;
import src.domain.dungeon.model.worldspace.DungeonBoundaryStretchValueTypes.StretchSelection;

final class DungeonBoundaryStretchMutationLogic {

    private static final DungeonClusterBoundaryGeometryLogic GEOMETRY_SERVICE =
            new DungeonClusterBoundaryGeometryLogic();
    private static final DungeonBoundaryStretchBoundaryLookupLogic BOUNDARY_LOOKUP_SERVICE =
            new DungeonBoundaryStretchBoundaryLookupLogic();
    private static final DungeonBoundaryStretchConnectorLogic CONNECTOR_SERVICE =
            new DungeonBoundaryStretchConnectorLogic();

    Optional<StretchMutationResult> applyInnerStretch(
            DungeonMap dungeonMap,
            DungeonRoomTopologyClusterWork target,
            StretchSelection stretch,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaryMap
    ) {
        Set<Cell> levelCells = new LinkedHashSet<>(target.cellsAt(stretch.level()));
        if (!sourceStaysInternal(stretch, levelCells)
                || CorridorDoorBindingGeometry.touchesDoorBindingKeys(
                dungeonMap.corridors(),
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
                DungeonClusterBoundary.orderedByLevel(boundaries.values())));
    }

    Optional<StretchMutationResult> applyOuterStretch(
            DungeonMap dungeonMap,
            DungeonRoomTopologyClusterWork target,
            StretchSelection stretch,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaryMap
    ) {
        Map<Integer, List<Cell>> nextCellsByLevel = new LinkedHashMap<>(target.cellsByLevel());
        Set<Cell> currentLevelCells = new LinkedHashSet<>(target.cellsAt(stretch.level()));
        Set<Cell> stripCells = stretch.stripCells();
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
        nextCellsByLevel.put(stretch.level(), CellOrdering.sortedCells(currentLevelCells));
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
        if (!replaceStretchEdges(target, stretch, currentLevelCells, boundaries)) {
            return Optional.empty();
        }
        return Optional.of(new StretchMutationResult(
                nextCellsByLevel,
                GEOMETRY_SERVICE.filterBoundaries(boundaries.values(), nextCellsByLevel, target.cluster().center())));
    }

    private boolean replaceStretchEdges(
            DungeonRoomTopologyClusterWork target,
            StretchSelection stretch,
            Set<Cell> levelCells,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries
    ) {
        for (StretchEdge edge : stretch.edges()) {
            boundaries.remove(edge.key());
        }
        for (StretchEdge edge : stretch.edges()) {
            Edge movedEdge = stretch.orientation().move(edge.edge(), stretch.movement());
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

    private boolean sourceStaysInternal(StretchSelection stretch, Set<Cell> clusterCells) {
        for (StretchEdge edge : stretch.edges()) {
            DungeonBoundaryTouch movedTouch = new DungeonBoundaryTouch(
                    insideCells(stretch.orientation().move(edge.edge(), stretch.movement()).touchingCells(), clusterCells));
            if (!movedTouch.valid() || !movedTouch.hasTwoInsideCells()) {
                return false;
            }
        }
        return true;
    }

    private List<Cell> insideCells(List<Cell> touchingCells, Set<Cell> clusterCells) {
        List<Cell> result = new java.util.ArrayList<>();
        for (Cell cell : touchingCells == null ? List.<Cell>of() : touchingCells) {
            if (clusterCells.contains(cell)) {
                result.add(cell);
            }
        }
        return List.copyOf(result);
    }

    private Optional<DungeonTopologyRef> preserveTopologyRef(
            StretchEdge edge,
            Cell center
    ) {
        if (edge.existing() == null) {
            return Optional.empty();
        }
        return edge.existing().topologyRef().present()
                ? Optional.of(edge.existing().topologyRef())
                : Optional.of(edge.existing().resolvedTopologyRef(center));
    }
}
