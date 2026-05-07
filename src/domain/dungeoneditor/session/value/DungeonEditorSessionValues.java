package src.domain.dungeoneditor.session.value;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

public final class DungeonEditorSessionValues {

    private DungeonEditorSessionValues() {
    }

    public enum ViewMode {
        GRID,
        GRAPH;

        public static ViewMode fromName(@Nullable String name) {
            return "GRAPH".equals(name) ? GRAPH : GRID;
        }
    }

    public enum Tool {
        SELECT,
        ROOM_PAINT,
        ROOM_DELETE,
        WALL_CREATE,
        WALL_DELETE,
        DOOR_CREATE,
        DOOR_DELETE,
        CORRIDOR_CREATE,
        CORRIDOR_DELETE,
        STAIR_CREATE,
        STAIR_DELETE,
        TRANSITION_CREATE,
        TRANSITION_DELETE;

        public static Tool fromName(@Nullable String name) {
            try {
                return valueOf(name == null ? SELECT.name() : name);
            } catch (IllegalArgumentException ignored) {
                return SELECT;
            }
        }

        public boolean isSelectionTool() {
            return this == SELECT;
        }

        public boolean isRoomPaintTool() {
            return this == ROOM_PAINT || this == ROOM_DELETE;
        }

        public boolean isBoundaryTool() {
            return this == WALL_CREATE
                    || this == WALL_DELETE
                    || this == DOOR_CREATE
                    || this == DOOR_DELETE;
        }

        public boolean isCorridorTool() {
            return this == CORRIDOR_CREATE || this == CORRIDOR_DELETE;
        }

        public boolean isDoorTool() {
            return this == DOOR_CREATE || this == DOOR_DELETE;
        }

        public boolean deleteMode() {
            return this == ROOM_DELETE
                    || this == WALL_DELETE
                    || this == DOOR_DELETE
                    || this == CORRIDOR_DELETE
                    || this == STAIR_DELETE
                    || this == TRANSITION_DELETE;
        }
    }

    public record OverlaySettings(
            String modeKey,
            int levelRange,
            double opacity,
            List<Integer> selectedLevels
    ) {
        public OverlaySettings {
            modeKey = modeKey == null || modeKey.isBlank() ? "OFF" : modeKey;
            levelRange = Math.max(0, levelRange);
            opacity = Math.max(0.0, Math.min(1.0, opacity));
            selectedLevels = selectedLevels == null ? List.of() : List.copyOf(selectedLevels);
        }

        public static OverlaySettings defaults() {
            return new OverlaySettings("OFF", 2, 0.35, List.of());
        }

        @Override
        public List<Integer> selectedLevels() {
            return List.copyOf(selectedLevels);
        }
    }

    public record Selection(
            DungeonEditorWorkspaceValues.TopologyElementRef topologyRef,
            long clusterId,
            boolean clusterSelection,
            DungeonEditorWorkspaceValues.HandleRef handleRef
    ) {
        public Selection {
            topologyRef = topologyRef == null ? DungeonEditorWorkspaceValues.TopologyElementRef.empty() : topologyRef;
            clusterId = Math.max(0L, clusterId);
            handleRef = handleRef == null ? emptyHandleRef() : handleRef;
        }

        public static Selection empty() {
            return new Selection(
                    DungeonEditorWorkspaceValues.TopologyElementRef.empty(),
                    0L,
                    false,
                    emptyHandleRef());
        }
    }

    public sealed interface Preview permits NoPreview,
            RoomRectanglePreview,
            ClusterBoundariesPreview,
            CorridorCreatePreview,
            CorridorDeletePreview,
            MoveHandlePreview,
            MoveBoundaryStretchPreview {

        static Preview none() {
            return NoPreview.INSTANCE;
        }

        default boolean present() {
            return this != NoPreview.INSTANCE;
        }
    }

    public enum NoPreview implements Preview {
        INSTANCE
    }

    public record RoomRectanglePreview(
            DungeonEditorWorkspaceValues.Cell start,
            DungeonEditorWorkspaceValues.Cell end,
            boolean deleteMode
    ) implements Preview {
        public RoomRectanglePreview {
            start = start == null ? DungeonEditorWorkspaceValues.Cell.empty() : start;
            end = end == null ? DungeonEditorWorkspaceValues.Cell.empty() : end;
        }
    }

    public record ClusterBoundariesPreview(
            long clusterId,
            List<DungeonEditorWorkspaceValues.Edge> edges,
            DungeonEditorWorkspaceValues.BoundaryKind boundaryKind,
            boolean deleteMode
    ) implements Preview {
        public ClusterBoundariesPreview {
            clusterId = Math.max(0L, clusterId);
            edges = edges == null ? List.of() : List.copyOf(edges);
            boundaryKind = boundaryKind == null ? DungeonEditorWorkspaceValues.BoundaryKind.WALL : boundaryKind;
        }

        @Override
        public List<DungeonEditorWorkspaceValues.Edge> edges() {
            return List.copyOf(edges);
        }
    }

    public record CorridorCreatePreview(
            DungeonEditorWorkspaceValues.CorridorEndpoint start,
            DungeonEditorWorkspaceValues.CorridorEndpoint end
    ) implements Preview {
    }

    public record CorridorDeletePreview(long corridorId) implements Preview {
        public CorridorDeletePreview {
            corridorId = Math.max(0L, corridorId);
        }
    }

    public record MoveHandlePreview(
            DungeonEditorWorkspaceValues.HandleRef handleRef,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements Preview {
        public MoveHandlePreview {
            handleRef = handleRef == null ? emptyHandleRef() : handleRef;
        }
    }

    public record MoveBoundaryStretchPreview(
            long clusterId,
            List<DungeonEditorWorkspaceValues.Edge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements Preview {
        public MoveBoundaryStretchPreview {
            clusterId = Math.max(0L, clusterId);
            sourceEdges = sourceEdges == null ? List.of() : List.copyOf(sourceEdges);
        }

        @Override
        public List<DungeonEditorWorkspaceValues.Edge> sourceEdges() {
            return List.copyOf(sourceEdges);
        }
    }

    public static DungeonEditorWorkspaceValues.@Nullable MapId primeSelectedMap(
            DungeonEditorWorkspaceValues.@Nullable MapId selectedMapId,
            long mapId
    ) {
        return selectedMapId == null && mapId > 0L ? new DungeonEditorWorkspaceValues.MapId(mapId) : selectedMapId;
    }

    public static boolean hasSelectedMap(DungeonEditorWorkspaceValues.@Nullable MapId selectedMapId) {
        return selectedMapId != null;
    }

    public static DungeonEditorWorkspaceValues.HandleRef emptyHandleRef() {
        return DungeonEditorWorkspaceValues.HandleRef.empty();
    }
}
