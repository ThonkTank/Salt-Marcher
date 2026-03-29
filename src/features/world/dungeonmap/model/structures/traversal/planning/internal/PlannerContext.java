package features.world.dungeonmap.model.structures.traversal.planning.internal;

import features.world.dungeonmap.model.geometry.CubePoint;

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
        TraversalTerminalResolver.TerminalResolution sourceResolution = TraversalTerminalResolver.resolve(
                resolvedRequest.source(),
                searchVolume);
        TraversalTerminalResolver.TerminalResolution targetResolution = TraversalTerminalResolver.resolve(
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
}
