package features.world.dungeon.transition.state;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;

/**
 * Passive transition-owned rebound persistence state. This successor slice carries only the final local connection and
 * preserved stair placement rows needed to persist rebound fallout without exposing JDBC scope.
 */
@SuppressWarnings("unused")
public record PersistReboundConnectionsState(
        List<TransitionState> transitions
) {

    public PersistReboundConnectionsState {
        transitions = normalizedTransitions(transitions);
    }

    public static PersistReboundConnectionsState persistReboundConnections(PersistReboundConnectionsState state) {
        if (state == null) {
            throw new IllegalArgumentException("state");
        }
        return new PersistReboundConnectionsState(state.transitions());
    }

    public record TransitionState(
            long transitionId,
            LocalConnectionState localConnection,
            StairPlacementState stairPlacement
    ) {

        public TransitionState {
            if (transitionId <= 0) {
                throw new IllegalArgumentException("transitionId");
            }
            localConnection = localConnection == null ? LocalConnectionState.none() : localConnection;
        }
    }

    public record LocalConnectionState(
            LocalConnectionKind kind,
            Long doorId,
            StairCarrierState stairCarrier
    ) {

        public LocalConnectionState {
            kind = kind == null ? LocalConnectionKind.NONE : kind;
            if (kind == LocalConnectionKind.DOOR && (doorId == null || doorId <= 0)) {
                throw new IllegalArgumentException("doorId");
            }
            if (kind == LocalConnectionKind.STAIR && stairCarrier == null) {
                throw new IllegalArgumentException("stairCarrier");
            }
            if (kind != LocalConnectionKind.DOOR) {
                doorId = null;
            }
            if (kind != LocalConnectionKind.STAIR) {
                stairCarrier = null;
            }
        }

        public static LocalConnectionState none() {
            return new LocalConnectionState(LocalConnectionKind.NONE, null, null);
        }
    }

    public enum LocalConnectionKind {
        NONE,
        DOOR,
        STAIR
    }

    public record StairCarrierState(
            int anchorX,
            int anchorY,
            int anchorLevelZ,
            List<PathNodeState> pathNodes,
            List<Integer> stopLevels
    ) {

        public StairCarrierState {
            pathNodes = normalizedPathNodes(pathNodes);
            stopLevels = normalizedStopLevels(stopLevels);
            if (pathNodes.isEmpty()) {
                throw new IllegalArgumentException("pathNodes");
            }
        }
    }

    public record PathNodeState(
            int x,
            int y,
            int levelZ
    ) {
    }

    public record StairPlacementState(
            int anchorX,
            int anchorY,
            int anchorLevelZ,
            String shapeKind,
            int shapeDirectionCode,
            int shapeParameter1,
            int shapeParameter2,
            int minLevelZ,
            int maxLevelZ
    ) {

        public StairPlacementState {
            shapeKind = normalizedShapeKind(shapeKind);
        }
    }

    private static List<TransitionState> normalizedTransitions(List<TransitionState> transitions) {
        if (transitions == null || transitions.isEmpty()) {
            return List.of();
        }
        ArrayList<TransitionState> normalizedTransitions = new ArrayList<>();
        for (TransitionState transition : transitions) {
            if (transition != null) {
                normalizedTransitions.add(transition);
            }
        }
        return normalizedTransitions.isEmpty() ? List.of() : List.copyOf(normalizedTransitions);
    }

    private static List<PathNodeState> normalizedPathNodes(List<PathNodeState> pathNodes) {
        if (pathNodes == null || pathNodes.isEmpty()) {
            return List.of();
        }
        ArrayList<PathNodeState> normalizedPathNodes = new ArrayList<>();
        for (PathNodeState pathNode : pathNodes) {
            if (pathNode != null) {
                normalizedPathNodes.add(pathNode);
            }
        }
        return normalizedPathNodes.isEmpty() ? List.of() : List.copyOf(normalizedPathNodes);
    }

    private static List<Integer> normalizedStopLevels(List<Integer> stopLevels) {
        if (stopLevels == null || stopLevels.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<Integer> normalizedStopLevels = new LinkedHashSet<>();
        for (Integer stopLevel : stopLevels) {
            if (stopLevel != null) {
                normalizedStopLevels.add(stopLevel);
            }
        }
        return normalizedStopLevels.isEmpty() ? List.of() : List.copyOf(normalizedStopLevels);
    }

    private static String normalizedShapeKind(String shapeKind) {
        String normalizedShapeKind = shapeKind == null ? "" : shapeKind.trim().toUpperCase(Locale.ROOT);
        return normalizedShapeKind.isEmpty() ? "STACK" : normalizedShapeKind;
    }
}
