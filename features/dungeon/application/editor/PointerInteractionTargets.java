package features.dungeon.application.editor;

import java.util.List;

public record PointerInteractionTargets(
        double sceneX,
        double sceneY,
        boolean primaryButtonDown,
        boolean secondaryButtonDown,
        features.dungeon.api.editor.DungeonEditorPointerInput.Target primaryTarget,
        features.dungeon.api.editor.DungeonEditorPointerInput.Target boundaryPreferredTarget,
        features.dungeon.api.editor.DungeonEditorPointerInput.Target wallBoundaryHoverTarget
) {
    private static final double EMPTY_SEGMENT_LENGTH = 0.0;

    public PointerInteractionTargets {
        sceneX = finiteOrZero(sceneX);
        sceneY = finiteOrZero(sceneY);
        primaryTarget = primaryTarget == null ? features.dungeon.api.editor.DungeonEditorPointerInput.Target.empty() : primaryTarget;
        boundaryPreferredTarget = boundaryPreferredTarget == null
                ? primaryTarget
                : boundaryPreferredTarget;
        wallBoundaryHoverTarget = wallBoundaryHoverTarget == null
                ? features.dungeon.api.editor.DungeonEditorPointerInput.Target.empty()
                : wallBoundaryHoverTarget;
    }

    public static PointerInteractionTargets empty() {
        return new PointerInteractionTargets(
                0.0,
                0.0,
                false,
                false,
                features.dungeon.api.editor.DungeonEditorPointerInput.Target.empty(),
                features.dungeon.api.editor.DungeonEditorPointerInput.Target.empty(),
                features.dungeon.api.editor.DungeonEditorPointerInput.Target.empty());
    }

    public static PointerInteractionTargets fromTargets(
            double sceneX,
            double sceneY,
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
            List<features.dungeon.api.editor.DungeonEditorPointerInput.Target> pointerTargets,
            int projectionLevel
    ) {
        List<features.dungeon.api.editor.DungeonEditorPointerInput.Target> safeTargets =
                pointerTargets == null ? List.of() : List.copyOf(pointerTargets);
        return new PointerInteractionTargets(
                sceneX,
                sceneY,
                primaryButtonDown,
                secondaryButtonDown,
                choosePrimary(safeTargets, sceneX, sceneY, false),
                choosePrimary(safeTargets, sceneX, sceneY, true),
                nearestWallBoundaryHoverTarget(sceneX, sceneY, projectionLevel));
    }

    public features.dungeon.api.editor.DungeonEditorPointerInput.Target primaryTarget(boolean boundaryPreferred) {
        return boundaryPreferred ? boundaryPreferredTarget : primaryTarget;
    }

    private static features.dungeon.api.editor.DungeonEditorPointerInput.Target choosePrimary(
            List<features.dungeon.api.editor.DungeonEditorPointerInput.Target> pointerTargets,
            double sceneX,
            double sceneY,
            boolean preferBoundary
    ) {
        features.dungeon.api.editor.DungeonEditorPointerInput.Target bestTarget = features.dungeon.api.editor.DungeonEditorPointerInput.Target.empty();
        int bestPriority = Integer.MAX_VALUE;
        double bestBoundaryDistance = Double.POSITIVE_INFINITY;
        for (features.dungeon.api.editor.DungeonEditorPointerInput.Target candidate : pointerTargets) {
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

    private static int priority(features.dungeon.api.editor.DungeonEditorPointerInput.Target target, boolean preferBoundary) {
        features.dungeon.api.editor.DungeonEditorPointerInput.Target safeTarget = target == null
                ? features.dungeon.api.editor.DungeonEditorPointerInput.Target.empty()
                : target;
        return preferBoundary ? boundaryPreferredPriority(safeTarget) : normalPriority(safeTarget);
    }

    private static int boundaryPreferredPriority(features.dungeon.api.editor.DungeonEditorPointerInput.Target target) {
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

    private static int normalPriority(features.dungeon.api.editor.DungeonEditorPointerInput.Target target) {
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

    private static int labelPriority(features.dungeon.api.editor.DungeonEditorPointerInput.Target target) {
        if (target.isClusterLabelTarget()) {
            return 1;
        }
        return target.isRoomLabelTarget() ? 2 : 6;
    }

    private static int markerPriority(features.dungeon.api.editor.DungeonEditorPointerInput.Target target) {
        return target.hasTransitionElement() ? -1 : 2;
    }

    private static int cellPriority(features.dungeon.api.editor.DungeonEditorPointerInput.Target target) {
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
            features.dungeon.api.editor.DungeonEditorPointerInput.Target candidate,
            features.dungeon.api.editor.DungeonEditorPointerInput.Target bestTarget,
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

    private static boolean boundaryCandidate(features.dungeon.api.editor.DungeonEditorPointerInput.Target target) {
        return target != null && target.isBoundaryTarget();
    }

    private static double boundaryDistance(features.dungeon.api.editor.DungeonEditorPointerInput.Target target, double sceneX, double sceneY) {
        if (!boundaryCandidate(target)) {
            return Double.POSITIVE_INFINITY;
        }
        features.dungeon.api.editor.DungeonEditorPointerInput.BoundaryTarget boundary = target.boundary();
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

    private static String boundaryTieBreakKey(features.dungeon.api.editor.DungeonEditorPointerInput.Target target) {
        if (!boundaryCandidate(target)) {
            return "";
        }
        features.dungeon.api.editor.DungeonEditorPointerInput.BoundaryTarget boundary = target.boundary();
        return boundary.boundaryKind().name()
                + ":"
                + boundary.ownerId()
                + ":"
                + boundary.topologyKind().stableName()
                + ":"
                + boundary.topologyId()
                + ":"
                + boundary.key();
    }

    private static features.dungeon.api.editor.DungeonEditorPointerInput.Target nearestWallBoundaryHoverTarget(
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

    private static features.dungeon.api.editor.DungeonEditorPointerInput.Target syntheticWallBoundaryTarget(
            double startQ,
            double startR,
            int startLevel,
            double endQ,
            double endR,
            int endLevel
    ) {
        String key = "hover-boundary:WALL:" + startQ + ":" + startR + ":" + startLevel
                + ":" + endQ + ":" + endR + ":" + endLevel;
        return features.dungeon.api.editor.DungeonEditorPointerInput.Target.boundary(new features.dungeon.api.editor.DungeonEditorPointerInput.BoundaryTarget(
                features.dungeon.api.editor.DungeonEditorPointerInput.BoundaryKind.WALL,
                key,
                0L,
                features.dungeon.api.editor.DungeonEditorPointerInput.TopologyKind.EMPTY,
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
