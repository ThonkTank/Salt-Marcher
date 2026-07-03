package src.features.dungeon.runtime;

import java.util.List;
import java.util.Map;

public record PointerInteractionTargets(
        double sceneX,
        double sceneY,
        boolean primaryButtonDown,
        boolean secondaryButtonDown,
        DungeonEditorRuntimePointerTarget primaryTarget,
        DungeonEditorRuntimePointerTarget boundaryPreferredTarget,
        DungeonEditorRuntimePointerTarget wallBoundaryHoverTarget
) {
    private static final double EMPTY_SEGMENT_LENGTH = 0.0;

    public PointerInteractionTargets {
        sceneX = finiteOrZero(sceneX);
        sceneY = finiteOrZero(sceneY);
        primaryTarget = primaryTarget == null ? DungeonEditorRuntimePointerTarget.empty() : primaryTarget;
        boundaryPreferredTarget = boundaryPreferredTarget == null
                ? primaryTarget
                : boundaryPreferredTarget;
        wallBoundaryHoverTarget = wallBoundaryHoverTarget == null
                ? DungeonEditorRuntimePointerTarget.empty()
                : wallBoundaryHoverTarget;
    }

    public static PointerInteractionTargets empty() {
        return new PointerInteractionTargets(
                0.0,
                0.0,
                false,
                false,
                DungeonEditorRuntimePointerTarget.empty(),
                DungeonEditorRuntimePointerTarget.empty(),
                DungeonEditorRuntimePointerTarget.empty());
    }

    public static PointerInteractionTargets fromHitTargets(
            double sceneX,
            double sceneY,
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
            List<String> hitRefs,
            Map<String, DungeonEditorPreparedFrameFacts.PreparedPointerTargetFrame> pointerTargets,
            int projectionLevel
    ) {
        List<String> safeHitRefs = hitRefs == null ? List.of() : List.copyOf(hitRefs);
        Map<String, DungeonEditorPreparedFrameFacts.PreparedPointerTargetFrame> safeTargets =
                pointerTargets == null ? Map.of() : pointerTargets;
        return new PointerInteractionTargets(
                sceneX,
                sceneY,
                primaryButtonDown,
                secondaryButtonDown,
                choosePrimary(safeHitRefs, safeTargets, sceneX, sceneY, false),
                choosePrimary(safeHitRefs, safeTargets, sceneX, sceneY, true),
                nearestWallBoundaryHoverTarget(sceneX, sceneY, projectionLevel));
    }

    public DungeonEditorRuntimePointerTarget primaryTarget(boolean boundaryPreferred) {
        return boundaryPreferred ? boundaryPreferredTarget : primaryTarget;
    }

    private static DungeonEditorRuntimePointerTarget choosePrimary(
            List<String> hitRefs,
            Map<String, DungeonEditorPreparedFrameFacts.PreparedPointerTargetFrame> pointerTargets,
            double sceneX,
            double sceneY,
            boolean preferBoundary
    ) {
        DungeonEditorRuntimePointerTarget bestTarget = DungeonEditorRuntimePointerTarget.empty();
        int bestPriority = Integer.MAX_VALUE;
        double bestBoundaryDistance = Double.POSITIVE_INFINITY;
        for (String hitRef : hitRefs) {
            DungeonEditorRuntimePointerTarget candidate =
                    DungeonEditorRuntimePointerTarget.fromPreparedFrame(pointerTargets.get(hitRef));
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

    private static int priority(DungeonEditorRuntimePointerTarget target, boolean preferBoundary) {
        DungeonEditorRuntimePointerTarget safeTarget = target == null
                ? DungeonEditorRuntimePointerTarget.empty()
                : target;
        return preferBoundary ? boundaryPreferredPriority(safeTarget) : normalPriority(safeTarget);
    }

    private static int boundaryPreferredPriority(DungeonEditorRuntimePointerTarget target) {
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

    private static int normalPriority(DungeonEditorRuntimePointerTarget target) {
        if (target.isLabelTarget()) {
            return labelPriority(target);
        }
        return switch (target.targetKind()) {
            case HANDLE -> 0;
            case MARKER -> markerPriority(target);
            case CELL -> cellPriority(target);
            case BOUNDARY -> 3;
            case GRAPH_NODE -> 7;
            default -> Integer.MAX_VALUE;
        };
    }

    private static int labelPriority(DungeonEditorRuntimePointerTarget target) {
        if (target.isClusterLabelTarget()) {
            return 1;
        }
        return target.isRoomLabelTarget() ? 2 : 6;
    }

    private static int markerPriority(DungeonEditorRuntimePointerTarget target) {
        return target.hasTransitionElement() ? -1 : 2;
    }

    private static int cellPriority(DungeonEditorRuntimePointerTarget target) {
        if (target.hasTransitionElement()) {
            return 0;
        }
        if (target.hasRoomElement()) {
            return 4;
        }
        if (target.hasFeatureMarkerElement()) {
            return 5;
        }
        return 6;
    }

    private static boolean betterCandidate(
            DungeonEditorRuntimePointerTarget candidate,
            DungeonEditorRuntimePointerTarget bestTarget,
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

    private static boolean boundaryCandidate(DungeonEditorRuntimePointerTarget target) {
        return target != null && target.isBoundaryTarget();
    }

    private static double boundaryDistance(DungeonEditorRuntimePointerTarget target, double sceneX, double sceneY) {
        if (!boundaryCandidate(target)) {
            return Double.POSITIVE_INFINITY;
        }
        DungeonEditorRuntimePointerTarget.BoundaryTarget boundary = target.boundary();
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
        if (lengthSquared <= EMPTY_SEGMENT_LENGTH) {
            return Math.hypot(x - startX, y - startY);
        }
        double t = ((x - startX) * dx + (y - startY) * dy) / lengthSquared;
        double clamped = Math.max(0.0, Math.min(1.0, t));
        return Math.hypot(x - (startX + clamped * dx), y - (startY + clamped * dy));
    }

    private static String boundaryTieBreakKey(DungeonEditorRuntimePointerTarget target) {
        if (!boundaryCandidate(target)) {
            return "";
        }
        DungeonEditorRuntimePointerTarget.BoundaryTarget boundary = target.boundary();
        return boundary.boundaryKind().legacyName()
                + ":"
                + boundary.ownerId()
                + ":"
                + boundary.topologyKind().legacyName()
                + ":"
                + boundary.topologyId()
                + ":"
                + boundary.key();
    }

    private static DungeonEditorRuntimePointerTarget nearestWallBoundaryHoverTarget(
            double sceneX,
            double sceneY,
            int projectionLevel
    ) {
        int cellQ = (int) Math.floor(sceneX);
        int cellR = (int) Math.floor(sceneY);
        double localQ = sceneX - cellQ;
        double localR = sceneY - cellR;
        double distanceWest = Math.abs(localQ);
        double distanceEast = Math.abs(1.0 - localQ);
        double distanceNorth = Math.abs(localR);
        double distanceSouth = Math.abs(1.0 - localR);
        double best = Math.min(Math.min(distanceWest, distanceEast), Math.min(distanceNorth, distanceSouth));
        if (best == distanceNorth) {
            return syntheticWallBoundaryTarget(cellQ, cellR, projectionLevel, cellQ + 1, cellR, projectionLevel);
        }
        if (best == distanceSouth) {
            return syntheticWallBoundaryTarget(cellQ, cellR + 1, projectionLevel, cellQ + 1, cellR + 1,
                    projectionLevel);
        }
        if (best == distanceWest) {
            return syntheticWallBoundaryTarget(cellQ, cellR, projectionLevel, cellQ, cellR + 1, projectionLevel);
        }
        return syntheticWallBoundaryTarget(cellQ + 1, cellR, projectionLevel, cellQ + 1, cellR + 1, projectionLevel);
    }

    private static DungeonEditorRuntimePointerTarget syntheticWallBoundaryTarget(
            double startQ,
            double startR,
            int startLevel,
            double endQ,
            double endR,
            int endLevel
    ) {
        String key = "hover-boundary:WALL:" + startQ + ":" + startR + ":" + startLevel
                + ":" + endQ + ":" + endR + ":" + endLevel;
        return DungeonEditorRuntimePointerTarget.boundary(new DungeonEditorRuntimePointerTarget.BoundaryTarget(
                DungeonEditorRuntimePointerTarget.BoundaryKind.WALL,
                key,
                0L,
                DungeonEditorRuntimePointerTarget.TopologyKind.EMPTY,
                0L,
                startQ,
                startR,
                startLevel,
                endQ,
                endR,
                endLevel));
    }

    private static double finiteOrZero(double value) {
        return Double.isFinite(value) ? value : 0.0;
    }
}
