package features.dungeon.domain.core.structure.room;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.CellOrdering;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.DungeonBoundaryTouch;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.corridor.CorridorDoorBindingGeometry;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryStretchPlan.BoundaryVertex;
import features.dungeon.domain.core.structure.room.RoomBoundaryStretchValues.StretchEdge;
import features.dungeon.domain.core.structure.room.RoomBoundaryStretchValues.StretchMutationResult;
import features.dungeon.domain.core.structure.room.RoomBoundaryStretchValues.StretchSelection;

final class RoomBoundaryStretchMutationStep {

    private static final RoomClusterBoundaryGeometry GEOMETRY =
            new RoomClusterBoundaryGeometry();
    private static final RoomBoundaryStretchBoundaryLookup BOUNDARY_LOOKUP =
            new RoomBoundaryStretchBoundaryLookup();
    private static final RoomBoundaryStretchConnectors CONNECTORS =
            new RoomBoundaryStretchConnectors();

    Optional<StretchMutationResult> applyInnerStretch(
            List<Corridor> corridors,
            DungeonRoomTopologyClusterWork target,
            StretchSelection stretch,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaryMap
    ) {
        Set<Cell> levelCells = new LinkedHashSet<>(target.cellsAt(stretch.level()));
        if (!sourceStaysInternal(stretch, levelCells)
                || CorridorDoorBindingGeometry.touchesDoorBindingKeys(
                corridors,
                target.cluster().center(),
                target.cluster().clusterId(),
                stretch.level(),
                stretch.sourceKeys())) {
            return Optional.empty();
        }
        Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries = new LinkedHashMap<>(boundaryMap);
        if (!CONNECTORS.applyStretchConnectors(corridors, target, stretch, levelCells, boundaries)
                || !replaceStretchEdges(target, stretch, levelCells, boundaries)) {
            return Optional.empty();
        }
        return Optional.of(new StretchMutationResult(
                target.cellsByLevel(),
                DungeonClusterBoundary.orderedByLevel(boundaries.values())));
    }

    Optional<StretchMutationResult> applyOuterStretch(
            List<Corridor> corridors,
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
            if (!BOUNDARY_LOOKUP.hasPerpendicularBoundary(
                    boundaries,
                    stretch.sourceKeys(),
                    vertex,
                    stretch.orientation())) {
                continue;
            }
            if (!CONNECTORS.applyConnectorPath(
                    corridors,
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
                GEOMETRY.filterBoundaries(boundaries.values(), nextCellsByLevel, target.cluster().center())));
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
            DungeonClusterBoundary moved = GEOMETRY.boundaryForEdge(
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
