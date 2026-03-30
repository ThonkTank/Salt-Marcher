package features.world.dungeonmap.model.structures.traversal.routing.internal;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.traversal.ResolvedTraversalDoorBinding;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

final class PlannerContext {

    private final SearchVolume searchVolume;
    private final Set<CubePoint> sourceCells;
    private final Set<CubePoint> targetCells;
    private final Map<CubePoint, Integer> sourceDirectionIndexByCell;

    PlannerContext(LocalSegmentRequest request) {
        LocalSegmentRequest resolvedRequest = request == null
                ? new LocalSegmentRequest(
                LocalSegmentRequest.FixedCellsTerminal.of(Set.of()),
                LocalSegmentRequest.FixedCellsTerminal.of(Set.of()),
                Set.of())
                : request;
        this.searchVolume = SearchVolume.enclosing(
                resolvedRequest.obstacles(),
                resolvedRequest.source().boundsPoints(),
                resolvedRequest.target().boundsPoints());
        TerminalResolution sourceResolution = resolve(
                resolvedRequest.source(),
                searchVolume);
        TerminalResolution targetResolution = resolve(
                resolvedRequest.target(),
                searchVolume);
        this.sourceCells = sourceResolution.cells();
        this.targetCells = targetResolution.cells();
        this.sourceDirectionIndexByCell = sourceResolution.directionIndices();
    }

    boolean isRoutable() {
        return !sourceCells.isEmpty() && !targetCells.isEmpty();
    }

    SearchVolume searchVolume() {
        return searchVolume;
    }

    Set<CubePoint> sourceCells() {
        return sourceCells;
    }

    Set<CubePoint> targetCells() {
        return targetCells;
    }

    int sourceDirectionIndex(CubePoint cell) {
        return cell == null ? -1 : sourceDirectionIndexByCell.getOrDefault(cell, -1);
    }

    private static TerminalResolution resolve(
            LocalSegmentRequest.LocalTerminal terminal,
            SearchVolume searchVolume
    ) {
        if (terminal instanceof LocalSegmentRequest.RoomPortalTerminal roomPortalTerminal) {
            return resolveRoomPortal(roomPortalTerminal.portal(), searchVolume);
        }
        if (terminal instanceof LocalSegmentRequest.FixedCellsTerminal fixedCellsTerminal) {
            return resolveFixedCells(fixedCellsTerminal.cells(), searchVolume);
        }
        return TerminalResolution.empty();
    }

    private static TerminalResolution resolveFixedCells(
            Set<CubePoint> cells,
            SearchVolume searchVolume
    ) {
        if (cells == null || cells.isEmpty()) {
            return TerminalResolution.empty();
        }
        LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
        for (CubePoint cell : cells) {
            if (cell != null && searchVolume.isPassable(cell)) {
                result.add(cell);
            }
        }
        return result.isEmpty()
                ? TerminalResolution.empty()
                : new TerminalResolution(Set.copyOf(result), Map.of());
    }

    private static TerminalResolution resolveRoomPortal(
            TraversalNode portal,
            SearchVolume searchVolume
    ) {
        if (portal == null || portal.kind() != TraversalNode.TraversalNodeKind.ROOM_PORTAL) {
            return TerminalResolution.empty();
        }
        LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
        LinkedHashMap<CubePoint, Integer> directionIndices = new LinkedHashMap<>();
        ResolvedTraversalDoorBinding binding = portal.fixedDoorBinding();
        if (portal.hasFixedDoorBinding() && binding != null) {
            int directionIndex = directionIndex(binding.direction());
            CubePoint boundEntry = portal.boundEntryCell();
            if (searchVolume.isPassable(boundEntry)) {
                result.add(boundEntry);
                if (directionIndex >= 0) {
                    directionIndices.putIfAbsent(boundEntry, directionIndex);
                }
            }
            return result.isEmpty()
                    ? TerminalResolution.empty()
                    : new TerminalResolution(Set.copyOf(result), Map.copyOf(directionIndices));
        }

        for (CubePoint occupiedCell : portal.occupiedCells()) {
            if (occupiedCell == null) {
                continue;
            }
            for (Point2i step : Point2i.CARDINAL_STEPS) {
                CubePoint candidate = CubePoint.at(occupiedCell.projectedCell().add(step), occupiedCell.z());
                if (portal.occupiedCells().contains(candidate) || !searchVolume.isPassable(candidate)) {
                    continue;
                }
                result.add(candidate);
                int directionIndex = directionIndex(step);
                if (directionIndex >= 0) {
                    directionIndices.putIfAbsent(candidate, directionIndex);
                }
            }
        }
        return result.isEmpty()
                ? TerminalResolution.empty()
                : new TerminalResolution(Set.copyOf(result), Map.copyOf(directionIndices));
    }

    private static int directionIndex(Point2i step) {
        CardinalDirection direction = CardinalDirection.fromDirection(step);
        if (direction == null) {
            return -1;
        }
        return switch (direction) {
            case NORTH -> 0;
            case EAST -> 1;
            case SOUTH -> 2;
            case WEST -> 3;
        };
    }

    private record TerminalResolution(
            Set<CubePoint> cells,
            Map<CubePoint, Integer> directionIndices
    ) {
        private TerminalResolution {
            cells = cells == null ? Set.of() : Set.copyOf(cells);
            directionIndices = directionIndices == null ? Map.of() : Map.copyOf(directionIndices);
        }

        private static TerminalResolution empty() {
            return new TerminalResolution(Set.of(), Map.of());
        }
    }
}
