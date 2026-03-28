package features.world.dungeonmap.model.structures.traversal.planning.internal;

import features.world.dungeonmap.model.geometry.CubePoint;

import java.util.ArrayList;
import java.util.List;

final class LocalTraversalRoutePlanner {

    private LocalTraversalRoutePlanner() {
        throw new AssertionError("No instances");
    }

    static LocalSegmentResult route(LocalSegmentRequest request) {
        if (request == null) {
            return LocalSegmentResult.unroutable();
        }
        if (!request.stairCandidates().isEmpty()) {
            return routeWithExplicitStairs(request);
        }
        return routeHorizontally(request);
    }

    private static LocalSegmentResult routeHorizontally(LocalSegmentRequest request) {
        PlannerContext context = new PlannerContext(request);
        if (!context.isRoutable()) {
            return LocalSegmentResult.unroutable();
        }
        CostField.ExtractedPath extractedPath = CostField.route(context);
        if (extractedPath.isEmpty()) {
            return LocalSegmentResult.unroutable();
        }
        return new LocalSegmentResult(
                extractedPath.cells(),
                extractedPath.cells().getFirst(),
                extractedPath.cells().getLast(),
                List.of());
    }

    private static LocalSegmentResult routeWithExplicitStairs(LocalSegmentRequest request) {
        LocalSegmentResult bestResult = null;
        long bestScore = Long.MAX_VALUE;
        for (StairCandidate stairCandidate : request.stairCandidates()) {
            if (stairCandidate == null) {
                continue;
            }
            LocalSegmentResult prefix = routeHorizontally(new LocalSegmentRequest(
                    request.source(),
                    LocalSegmentRequest.FixedCellsTerminal.of(List.of(stairCandidate.startCell())),
                    request.obstacles(),
                    List.of()));
            if (!prefix.routable()) {
                continue;
            }
            LocalSegmentResult suffix = routeHorizontally(new LocalSegmentRequest(
                    LocalSegmentRequest.FixedCellsTerminal.of(List.of(stairCandidate.endCell())),
                    request.target(),
                    request.obstacles(),
                    List.of()));
            if (!suffix.routable()) {
                continue;
            }
            LocalSegmentResult combined = combine(prefix, suffix, stairCandidate);
            long score = combined.pathCells().size() + stairCandidate.costHint();
            if (score < bestScore) {
                bestScore = score;
                bestResult = combined;
            }
        }
        return bestResult == null ? LocalSegmentResult.unroutable() : bestResult;
    }

    private static LocalSegmentResult combine(
            LocalSegmentResult prefix,
            LocalSegmentResult suffix,
            StairCandidate stairCandidate
    ) {
        ArrayList<CubePoint> pathCells = new ArrayList<>();
        pathCells.addAll(prefix.pathCells());
        pathCells.addAll(suffix.pathCells());
        return new LocalSegmentResult(
                List.copyOf(pathCells),
                prefix.sourceCell(),
                suffix.targetCell(),
                List.of(stairCandidate.toPlacement()));
    }
}
