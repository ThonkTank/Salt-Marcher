package src.view.slotcontent.main.dungeonmap;

import java.util.List;
import java.util.Map;
import src.view.slotcontent.main.dungeonmap.DungeonMapHitGeometryContentPartModel.CanvasHit;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.BoundaryTarget;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.PointerTarget;

final class DungeonMapPointerTargetContentPartModel {
    private static final String FEATURE_MARKER_ELEMENT_KIND = "FEATURE_MARKER";
    private static final String ROOM_ELEMENT_KIND = "ROOM";

    PointerTarget choosePrimary(
            List<CanvasHit> hits,
            Map<String, PointerTarget> pointerTargets,
            double sceneX,
            double sceneY,
            boolean preferBoundary
    ) {
        PointerTarget bestTarget = PointerTarget.empty();
        int bestPriority = Integer.MAX_VALUE;
        double bestBoundaryDistance = Double.POSITIVE_INFINITY;
        for (CanvasHit hit : hits) {
            PointerTarget candidate = pointerTargets.getOrDefault(hit.hitRef(), PointerTarget.empty());
            int candidatePriority = priority(candidate, preferBoundary);
            double candidateBoundaryDistance = boundaryDistance(candidate, sceneX, sceneY);
            if (betterCandidate(
                    candidate,
                    bestTarget,
                    candidatePriority,
                    bestPriority,
                    candidateBoundaryDistance,
                    bestBoundaryDistance)) {
                bestTarget = candidate;
                bestPriority = candidatePriority;
                bestBoundaryDistance = candidateBoundaryDistance;
            }
        }
        return bestTarget;
    }

    private int priority(PointerTarget target, boolean preferBoundary) {
        PointerTarget safeTarget = target == null ? PointerTarget.empty() : target;
        return preferBoundary ? boundaryPreferredPriority(safeTarget) : normalPriority(safeTarget);
    }

    private int boundaryPreferredPriority(PointerTarget target) {
        if (target.isBoundaryTarget()) {
            return 0;
        }
        if (target.isHandleTarget()) {
            return 1;
        }
        int normalPriority = normalPriority(target);
        if (normalPriority == Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        return normalPriority + 1;
    }

    private int normalPriority(PointerTarget safeTarget) {
        if (safeTarget.isLabelTarget()) {
            return labelPriority(safeTarget);
        }
        return switch (safeTarget.targetKind()) {
            case HANDLE -> 0;
            case BOUNDARY -> 3;
            case CELL -> roomCell(safeTarget) ? 4 : featureCell(safeTarget) ? 5 : 6;
            case GRAPH_NODE -> 7;
            default -> Integer.MAX_VALUE;
        };
    }

    private static boolean betterCandidate(
            PointerTarget candidate,
            PointerTarget bestTarget,
            int candidatePriority,
            int bestPriority,
            double candidateBoundaryDistance,
            double bestBoundaryDistance
    ) {
        if (candidatePriority != bestPriority) {
            return candidatePriority < bestPriority;
        }
        if (!boundaryCandidate(candidate) || !boundaryCandidate(bestTarget)) {
            return false;
        }
        int distanceComparison = Double.compare(candidateBoundaryDistance, bestBoundaryDistance);
        if (distanceComparison != 0) {
            return distanceComparison < 0;
        }
        return boundaryTieBreakKey(candidate).compareTo(boundaryTieBreakKey(bestTarget)) < 0;
    }

    private static boolean boundaryCandidate(PointerTarget target) {
        return target != null && target.isBoundaryTarget();
    }

    private static double boundaryDistance(PointerTarget target, double sceneX, double sceneY) {
        if (!boundaryCandidate(target)) {
            return Double.POSITIVE_INFINITY;
        }
        BoundaryTarget boundary = target.boundaryRef();
        return distanceToSegment(
                sceneX,
                sceneY,
                boundary.startQ(),
                boundary.startR(),
                boundary.endQ(),
                boundary.endR());
    }

    private static double distanceToSegment(
            double x,
            double y,
            double startX,
            double startY,
            double endX,
            double endY
    ) {
        double dx = endX - startX;
        double dy = endY - startY;
        double lengthSquared = dx * dx + dy * dy;
        double emptySegmentLength = 0.0;
        if (lengthSquared <= emptySegmentLength) {
            return Math.hypot(x - startX, y - startY);
        }
        double t = ((x - startX) * dx + (y - startY) * dy) / lengthSquared;
        double clamped = Math.max(0.0, Math.min(1.0, t));
        return Math.hypot(x - (startX + clamped * dx), y - (startY + clamped * dy));
    }

    private static String boundaryTieBreakKey(PointerTarget target) {
        if (!boundaryCandidate(target)) {
            return "";
        }
        BoundaryTarget boundary = target.boundaryRef();
        return boundary.boundaryKind().legacyName()
                + ":"
                + boundary.ownerId()
                + ":"
                + boundary.topologyKind()
                + ":"
                + boundary.topologyId()
                + ":"
                + boundary.key();
    }

    private boolean roomCell(PointerTarget target) {
        return ROOM_ELEMENT_KIND.equals(target.elementKind());
    }

    private boolean featureCell(PointerTarget target) {
        return FEATURE_MARKER_ELEMENT_KIND.equals(target.elementKind());
    }

    private int labelPriority(PointerTarget target) {
        if (target.isClusterLabelTarget()) {
            return 1;
        }
        return target.isRoomLabelTarget() ? 2 : 6;
    }
}
