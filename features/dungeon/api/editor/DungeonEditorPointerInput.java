package features.dungeon.api.editor;

import features.dungeon.api.DungeonEditorHandleRef;
import java.util.List;

/** Semantic canvas input derived from one consumed Editor state revision. */
public record DungeonEditorPointerInput(
        long sourceRevision,
        Action action,
        String selectedToolKey,
        Gesture gesture,
        double sceneX,
        double sceneY,
        boolean primaryButtonDown,
        boolean secondaryButtonDown,
        List<Target> targets,
        int projectionLevel,
        DungeonEditorIntent.TransitionDestinationInput transitionDestination
) {
    public DungeonEditorPointerInput {
        sourceRevision = Math.max(0L, sourceRevision);
        action = action == null ? Action.MOVED : action;
        selectedToolKey = selectedToolKey == null ? "" : selectedToolKey;
        gesture = gesture == null ? Gesture.empty() : gesture;
        sceneX = Double.isFinite(sceneX) ? sceneX : 0.0;
        sceneY = Double.isFinite(sceneY) ? sceneY : 0.0;
        targets = targets == null ? List.of() : List.copyOf(targets);
        transitionDestination = transitionDestination == null
                ? DungeonEditorIntent.TransitionDestinationInput.empty()
                : transitionDestination;
    }

    public enum Action {
        PRESSED,
        DRAGGED,
        RELEASED,
        MOVED
    }

    public record Gesture(
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
            boolean middleButtonDown,
            boolean shiftDown,
            boolean controlDown,
            boolean wallSingleClickModeSelected
    ) {
        public static Gesture empty() {
            return new Gesture(false, false, false, false, false, false);
        }
    }

    public record Target(
            String targetKind,
            String labelKind,
            String elementKind,
            long ownerId,
            long clusterId,
            String topologyKind,
            long topologyId,
            DungeonEditorHandleRef handleRef,
            BoundaryTarget boundary,
            String syntheticHoverKind,
            CellTarget cell,
            VertexTarget vertex
    ) {
        public Target {
            targetKind = safeText(targetKind);
            labelKind = safeText(labelKind);
            elementKind = safeText(elementKind);
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyKind = safeText(topologyKind);
            topologyId = Math.max(0L, topologyId);
            handleRef = handleRef == null ? DungeonEditorHandleRef.empty() : handleRef;
            boundary = boundary == null ? BoundaryTarget.empty() : boundary;
            syntheticHoverKind = safeText(syntheticHoverKind);
            cell = cell == null ? CellTarget.empty() : cell;
            vertex = vertex == null ? VertexTarget.empty() : vertex;
        }

        public static Target empty() {
            return new Target("EMPTY", "EMPTY", "EMPTY", 0L, 0L, "EMPTY", 0L,
                    DungeonEditorHandleRef.empty(), BoundaryTarget.empty(), "NONE",
                    CellTarget.empty(), VertexTarget.empty());
        }
    }

    public record BoundaryTarget(
            String boundaryKind,
            String key,
            long ownerId,
            String topologyKind,
            long topologyId,
            double startQ,
            double startR,
            int startLevel,
            double endQ,
            double endR,
            int endLevel
    ) {
        public BoundaryTarget {
            boundaryKind = safeText(boundaryKind);
            key = safeText(key);
            ownerId = Math.max(0L, ownerId);
            topologyKind = safeText(topologyKind);
            topologyId = Math.max(0L, topologyId);
            startQ = Double.isFinite(startQ) ? startQ : 0.0;
            startR = Double.isFinite(startR) ? startR : 0.0;
            endQ = Double.isFinite(endQ) ? endQ : 0.0;
            endR = Double.isFinite(endR) ? endR : 0.0;
        }

        public static BoundaryTarget empty() {
            return new BoundaryTarget("WALL", "", 0L, "EMPTY", 0L,
                    0.0, 0.0, 0, 0.0, 0.0, 0);
        }
    }

    public record CellTarget(boolean exact, int q, int r, int level) {
        public static CellTarget empty() {
            return new CellTarget(false, 0, 0, 0);
        }
    }

    public record VertexTarget(boolean exact, int q, int r, int level) {
        public static VertexTarget empty() {
            return new VertexTarget(false, 0, 0, 0);
        }
    }

    private static String safeText(String value) {
        return value == null ? "" : value;
    }
}
