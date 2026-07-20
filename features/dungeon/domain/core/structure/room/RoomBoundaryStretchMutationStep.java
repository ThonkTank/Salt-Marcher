package features.dungeon.domain.core.structure.room;

import features.dungeon.domain.core.component.boundary.BoundarySegment;

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
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryStretchPlan.StretchEdge;
import features.dungeon.domain.core.structure.room.RoomBoundaryStretchValues.StretchMutationResult;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryStretchPlan.Selection;

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
            Selection stretch,
            Map<DungeonBoundaryKey, BoundarySegment> boundaryMap
    ) {
        Set<Cell> levelCells = new LinkedHashSet<>(target.cellsAt(stretch.level()));
        if (!sourceStaysInternal(stretch, levelCells)
                || CorridorDoorBindingGeometry.touchesDoorBindingKeys(
                corridors,
                target.cluster().clusterId(),
                stretch.level(),
                stretch.boundaryKeys())) {
            return Optional.empty();
        }
        Map<DungeonBoundaryKey, BoundarySegment> boundaries = new LinkedHashMap<>(boundaryMap);
        if (!CONNECTORS.applyStretchConnectors(corridors, target, stretch, levelCells, boundaries)
                || !replaceStretchEdges(target, stretch, levelCells, boundaries)) {
            return Optional.empty();
        }
        return Optional.of(new StretchMutationResult(
                target.cellsByLevel(),
                BoundarySegment.orderedByLevel(boundaries.values())));
    }

    Optional<StretchMutationResult> applyOuterStretch(
            List<Corridor> corridors,
            DungeonRoomTopologyClusterWork target,
            Selection stretch,
            Map<DungeonBoundaryKey, BoundarySegment> boundaryMap
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
        Map<DungeonBoundaryKey, BoundarySegment> boundaries = new LinkedHashMap<>(boundaryMap);
        for (BoundaryVertex vertex : stretch.vertices()) {
            if (!BOUNDARY_LOOKUP.hasPerpendicularBoundary(
                    boundaries,
                    stretch.boundaryKeys(),
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
                GEOMETRY.filterBoundaries(boundaries.values(), nextCellsByLevel)));
    }

    private boolean replaceStretchEdges(
            DungeonRoomTopologyClusterWork target,
            Selection stretch,
            Set<Cell> levelCells,
            Map<DungeonBoundaryKey, BoundarySegment> boundaries
    ) {
        Map<DungeonBoundaryKey, BoundarySegment> originals = new LinkedHashMap<>();
        for (StretchEdge edge : stretch.edges()) {
            DungeonBoundaryKey sourceKey = boundaryKey(edge);
            originals.put(sourceKey, boundaries.remove(sourceKey));
        }
        for (StretchEdge edge : stretch.edges()) {
            Edge movedEdge = stretch.orientation().move(edge.edge(), stretch.movement());
            DungeonBoundaryKey movedKey = DungeonBoundaryKey.from(movedEdge);
            if (boundaries.containsKey(movedKey)) {
                return false;
            }
            BoundarySegment moved = GEOMETRY.boundaryForEdge(
                    levelCells,
                    movedEdge,
                    edge.existing() == null
                            ? features.dungeon.domain.core.component.boundary.BoundaryKind.WALL
                            : edge.existing().kind(),
                    preserveTopologyRef(originals.get(boundaryKey(edge))).orElse(null));
            if (moved == null) {
                return false;
            }
            boundaries.put(movedKey, moved);
        }
        return true;
    }

    private boolean sourceStaysInternal(Selection stretch, Set<Cell> clusterCells) {
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

    private Optional<DungeonTopologyRef> preserveTopologyRef(BoundarySegment existing) {
        if (existing == null) {
            return Optional.empty();
        }
        return existing.topologyRef().present()
                ? Optional.of(existing.topologyRef())
                : Optional.of(existing.resolvedTopologyRef());
    }

    private static DungeonBoundaryKey boundaryKey(StretchEdge edge) {
        return new DungeonBoundaryKey(edge.key().lower(), edge.key().upper());
    }
}
