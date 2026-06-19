package src.features.dungeon.runtime;

import java.util.List;

public interface DungeonEditorRuntimeOperations {
    void selectMap(long mapIdValue);

    void createMap(String mapName);

    void renameMap(long mapIdValue, String mapName);

    void deleteMap(long mapIdValue);

    void setViewMode(String viewModeKey);

    void setTool(String toolKey);

    void shiftProjectionLevel(int levelShift);

    void setOverlay(String modeKey, int levelRange, double opacity, List<Integer> selectedLevels);

    void applyPointer(
            PointerAction action,
            String toolKey,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination);

    default boolean acceptPointerSession(
            PointerAction action,
            String toolKey,
            PointerSample sample,
            int projectionLevel
    ) {
        return true;
    }

    default void clearPointerSession() {
        // Only stateful runtime roots need to clear hover/session memory.
    }

    void scrollSelection(int levelDelta);

    void moveHandle(HandleTarget handle, int q, int r);

    void saveRoomNarration(RoomNarration narration);

    void saveLabelName(String targetKind, long targetId, String name);

    void saveTransitionLink(
            long sourceTransitionId,
            long targetMapId,
            long targetTransitionId,
            boolean bidirectional);

    void saveTransitionDescription(long transitionId, String description);

    void saveStairGeometry(
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2);

    enum PointerAction {
        PRESSED,
        DRAGGED,
        RELEASED,
        MOVED
    }

    record PointerSample(
            double sceneX,
            double sceneY,
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
            PointerTarget target
    ) {
        public PointerSample {
            target = target == null ? PointerTarget.empty() : target;
        }
    }

    record PointerTarget(
            String targetKind,
            String labelKind,
            String elementKind,
            long ownerId,
            long clusterId,
            String topologyKind,
            long topologyId,
            HandleTarget handle,
            BoundaryTarget boundary
    ) {
        public PointerTarget {
            targetKind = safeText(targetKind, "EMPTY");
            labelKind = safeText(labelKind, "");
            elementKind = safeText(elementKind, "");
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyKind = safeText(topologyKind, "");
            topologyId = Math.max(0L, topologyId);
            handle = handle == null ? HandleTarget.empty() : handle;
            boundary = boundary == null ? BoundaryTarget.empty() : boundary;
        }

        public static PointerTarget empty() {
            return new PointerTarget(
                    "EMPTY",
                    "",
                    "",
                    0L,
                    0L,
                    "",
                    0L,
                    HandleTarget.empty(),
                    BoundaryTarget.empty());
        }
    }

    record HandleTarget(
            String kind,
            String topologyKind,
            long topologyId,
            long ownerId,
            long clusterId,
            long corridorId,
            long roomId,
            int orderIndex,
            int q,
            int r,
            int level,
            String direction,
            boolean sourceEdgePresent,
            int sourceStartQ,
            int sourceStartR,
            int sourceStartLevel,
            int sourceEndQ,
            int sourceEndR,
            int sourceEndLevel
    ) {
        public HandleTarget {
            kind = safeText(kind, "");
            topologyKind = safeText(topologyKind, "");
            topologyId = Math.max(0L, topologyId);
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            corridorId = Math.max(0L, corridorId);
            roomId = Math.max(0L, roomId);
            orderIndex = Math.max(0, orderIndex);
            direction = safeText(direction, "");
        }

        public static HandleTarget empty() {
            return new HandleTarget(
                    "",
                    "",
                    0L,
                    0L,
                    0L,
                    0L,
                    0L,
                    0,
                    0,
                    0,
                    0,
                    "",
                    false,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0);
        }
    }

    record BoundaryTarget(
            String kind,
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
            kind = safeText(kind, "WALL");
            key = safeText(key, "");
            ownerId = Math.max(0L, ownerId);
            topologyKind = safeText(topologyKind, "");
            topologyId = Math.max(0L, topologyId);
        }

        public static BoundaryTarget empty() {
            return new BoundaryTarget("WALL", "", 0L, "", 0L, 0.0, 0.0, 0, 0.0, 0.0, 0);
        }
    }

    record TransitionDestination(
            String destinationType,
            long targetMapId,
            long targetTileId,
            long targetTransitionId
    ) {
        public TransitionDestination {
            destinationType = safeText(destinationType, "");
            targetMapId = Math.max(0L, targetMapId);
            targetTileId = Math.max(0L, targetTileId);
            targetTransitionId = Math.max(0L, targetTransitionId);
        }

        public static TransitionDestination empty() {
            return new TransitionDestination("", 0L, 0L, 0L);
        }
    }

    record RoomNarration(
            long roomId,
            String visualDescription,
            List<ExitNarration> exits
    ) {
        public RoomNarration {
            roomId = Math.max(0L, roomId);
            visualDescription = safeText(visualDescription, "");
            exits = exits == null ? List.of() : List.copyOf(exits);
        }
    }

    record ExitNarration(
            String label,
            int q,
            int r,
            int level,
            String direction,
            String description
    ) {
        public ExitNarration {
            label = safeText(label, "");
            direction = safeText(direction, "");
            description = safeText(description, "");
        }
    }

    private static String safeText(String value, String fallback) {
        return value == null ? fallback : value.trim();
    }
}
