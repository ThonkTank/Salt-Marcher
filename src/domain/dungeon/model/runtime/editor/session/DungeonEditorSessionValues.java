package src.domain.dungeon.model.runtime.editor.session;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;

public final class DungeonEditorSessionValues {

    private DungeonEditorSessionValues() {
    }

    public static final class ViewMode {
        public static final ViewMode GRID = new ViewMode("GRID");
        public static final ViewMode GRAPH = new ViewMode("GRAPH");

        private final String name;

        private ViewMode(String name) {
            this.name = name;
        }

        public static ViewMode fromName(@Nullable String name) {
            return "GRAPH".equals(name) ? GRAPH : GRID;
        }

        public static ViewMode defaultMode() {
            return GRID;
        }

        public String name() {
            return name;
        }

        public boolean isGrid() {
            return this == GRID;
        }

        @Override
        public String toString() {
            return name;
        }
    }

    public static final class Tool {
        public static final Tool SELECT = new Tool("SELECT");
        public static final Tool ROOM_PAINT = new Tool("ROOM_PAINT");
        public static final Tool ROOM_DELETE = new Tool("ROOM_DELETE");
        public static final Tool WALL_CREATE = new Tool("WALL_CREATE");
        public static final Tool WALL_DELETE = new Tool("WALL_DELETE");
        public static final Tool DOOR_CREATE = new Tool("DOOR_CREATE");
        public static final Tool DOOR_DELETE = new Tool("DOOR_DELETE");
        public static final Tool CORRIDOR_CREATE = new Tool("CORRIDOR_CREATE");
        public static final Tool CORRIDOR_DELETE = new Tool("CORRIDOR_DELETE");
        public static final Tool STAIR_CREATE = new Tool("STAIR_CREATE");
        public static final Tool STAIR_CREATE_SQUARE = new Tool("STAIR_CREATE_SQUARE");
        public static final Tool STAIR_CREATE_CIRCULAR = new Tool("STAIR_CREATE_CIRCULAR");
        public static final Tool STAIR_DELETE = new Tool("STAIR_DELETE");
        public static final Tool TRANSITION_CREATE = new Tool("TRANSITION_CREATE");
        public static final Tool TRANSITION_DELETE = new Tool("TRANSITION_DELETE");
        public static final Tool FEATURE_POI_CREATE = new Tool("FEATURE_POI_CREATE");
        public static final Tool FEATURE_OBJECT_CREATE = new Tool("FEATURE_OBJECT_CREATE");
        public static final Tool FEATURE_ENCOUNTER_CREATE = new Tool("FEATURE_ENCOUNTER_CREATE");
        public static final Tool FEATURE_DELETE = new Tool("FEATURE_DELETE");

        private static final Tool[] VALUES = {
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
                STAIR_CREATE_SQUARE,
                STAIR_CREATE_CIRCULAR,
                STAIR_DELETE,
                TRANSITION_CREATE,
                TRANSITION_DELETE,
                FEATURE_POI_CREATE,
                FEATURE_OBJECT_CREATE,
                FEATURE_ENCOUNTER_CREATE,
                FEATURE_DELETE
        };

        private final String name;

        private Tool(String name) {
            this.name = name;
        }

        public static Tool fromName(@Nullable String name) {
            String safeName = name == null ? SELECT.name : name;
            for (Tool tool : VALUES) {
                if (tool.name.equals(safeName)) {
                    return tool;
                }
            }
            return SELECT;
        }

        public static Tool defaultTool() {
            return SELECT;
        }

        public static Tool valueOf(String name) {
            for (Tool tool : VALUES) {
                if (tool.name.equals(name)) {
                    return tool;
                }
            }
            throw new IllegalArgumentException("Unknown Tool: " + name);
        }

        public String name() {
            return name;
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
                    || this == TRANSITION_DELETE
                    || this == FEATURE_DELETE;
        }

        @Override
        public String toString() {
            return name;
        }
    }

    public static final class OverlaySettings {
        private final String modeKey;
        private final int levelRange;
        private final double opacity;
        private final List<Integer> selectedLevels;

        public OverlaySettings(String modeKey, int levelRange, double opacity, List<Integer> selectedLevels) {
            this.modeKey = modeKey == null || modeKey.isBlank() ? "OFF" : modeKey;
            this.levelRange = Math.max(0, levelRange);
            this.opacity = Math.max(0.0, Math.min(1.0, opacity));
            this.selectedLevels = selectedLevels == null ? List.of() : List.copyOf(selectedLevels);
        }

        public static OverlaySettings defaults() {
            return new OverlaySettings("OFF", 2, 0.35, List.of());
        }

        public String modeKey() {
            return modeKey;
        }

        public int levelRange() {
            return levelRange;
        }

        public double opacity() {
            return opacity;
        }

        public List<Integer> selectedLevels() {
            return List.copyOf(selectedLevels);
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof OverlaySettings that)) {
                return false;
            }
            return levelRange == that.levelRange
                    && Double.compare(opacity, that.opacity) == 0
                    && Objects.equals(modeKey, that.modeKey)
                    && Objects.equals(selectedLevels, that.selectedLevels);
        }

        @Override
        public int hashCode() {
            return Objects.hash(modeKey, levelRange, opacity, selectedLevels);
        }

        @Override
        public String toString() {
            return "OverlaySettings[modeKey=%s, levelRange=%d, opacity=%s, selectedLevels=%s]"
                    .formatted(modeKey, levelRange, opacity, selectedLevels);
        }
    }

    public record Selection(
            DungeonTopologyRef topologyRef,
            long clusterId,
            boolean clusterSelection,
            DungeonEditorWorkspaceValues.HandleRef handleRef
    ) {
        public Selection {
            topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
            clusterId = Math.max(0L, clusterId);
            handleRef = handleRef == null ? emptyHandleRef() : handleRef;
        }

        public static Selection empty() {
            return new Selection(
                    DungeonTopologyRef.empty(),
                    0L,
                    false,
                    emptyHandleRef());
        }
    }

    public sealed interface Preview permits NoPreview,
            RoomRectanglePreview,
            ClusterBoundariesPreview,
            StairCreatePreview,
            CorridorCreatePreview,
            DeleteCorridorPreview,
            MoveHandlePreview,
            MoveBoundaryStretchPreview {

        static Preview none() {
            return NoPreview.INSTANCE;
        }

    }

    public static final class NoPreview implements Preview {
        private static final NoPreview INSTANCE = new NoPreview();

        private NoPreview() {
        }
    }

    public static final class RoomRectanglePreview implements Preview {
        private final DungeonEditorWorkspaceValues.Cell start;
        private final DungeonEditorWorkspaceValues.Cell end;
        private final boolean deleteMode;

        public RoomRectanglePreview(
                DungeonEditorWorkspaceValues.Cell start,
                DungeonEditorWorkspaceValues.Cell end,
                boolean deleteMode
        ) {
            this.start = start == null ? DungeonEditorWorkspaceValues.Cell.empty() : start;
            this.end = end == null ? DungeonEditorWorkspaceValues.Cell.empty() : end;
            this.deleteMode = deleteMode;
        }

        public DungeonEditorWorkspaceValues.Cell start() {
            return start;
        }

        public DungeonEditorWorkspaceValues.Cell end() {
            return end;
        }

        public boolean deleteMode() {
            return deleteMode;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof RoomRectanglePreview that)) {
                return false;
            }
            return deleteMode == that.deleteMode
                    && Objects.equals(start, that.start)
                    && Objects.equals(end, that.end);
        }

        @Override
        public int hashCode() {
            return Objects.hash(start, end, deleteMode);
        }

        @Override
        public String toString() {
            return "RoomRectanglePreview[start=%s, end=%s, deleteMode=%s]".formatted(start, end, deleteMode);
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
            boundaryKind = boundaryKind == null ? DungeonEditorWorkspaceValues.BoundaryKind.defaultKind() : boundaryKind;
        }

        @Override
        public List<DungeonEditorWorkspaceValues.Edge> edges() {
            return List.copyOf(edges);
        }
    }

    public record StairCreatePreview(
            DungeonEditorWorkspaceValues.Cell anchor,
            DungeonEditorWorkspaceValues.Cell end,
            DungeonEditorWorkspaceValues.Cell specAnchor,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2,
            boolean valid,
            String statusText
    ) implements Preview {
        public StairCreatePreview {
            anchor = anchor == null ? DungeonEditorWorkspaceValues.Cell.empty() : anchor;
            end = end == null ? anchor : end;
            specAnchor = specAnchor == null ? anchor : specAnchor;
            shapeName = shapeName == null || shapeName.isBlank() ? "STRAIGHT" : shapeName.trim();
            directionName = directionName == null || directionName.isBlank() ? "NORTH" : directionName.trim();
            dimension1 = Math.max(0, dimension1);
            dimension2 = Math.max(0, dimension2);
            statusText = statusText == null ? "" : statusText;
        }
    }

    public record CorridorCreatePreview(
            DungeonEditorWorkspaceValues.CorridorEndpoint start,
            DungeonEditorWorkspaceValues.CorridorEndpoint end
    ) implements Preview {
    }

    public static final class DeleteCorridorPreview implements Preview {
        private final long corridorId;
        private final String targetKind;
        private final long topologyRefId;
        private final long roomId;
        private final int waypointIndex;

        public DeleteCorridorPreview(long corridorId) {
            this(corridorId, "CORRIDOR", 0L, 0L, 0);
        }

        public DeleteCorridorPreview(
                long corridorId,
                String targetKind,
                long topologyRefId,
                long roomId,
                int waypointIndex
        ) {
            this.corridorId = Math.max(0L, corridorId);
            this.targetKind = targetKind == null || targetKind.isBlank() ? "CORRIDOR" : targetKind;
            this.topologyRefId = Math.max(0L, topologyRefId);
            this.roomId = Math.max(0L, roomId);
            this.waypointIndex = Math.max(0, waypointIndex);
        }

        public long corridorId() {
            return corridorId;
        }

        public String targetKind() {
            return targetKind;
        }

        public long topologyRefId() {
            return topologyRefId;
        }

        public long roomId() {
            return roomId;
        }

        public int waypointIndex() {
            return waypointIndex;
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

    public static final class MoveBoundaryStretchPreview implements Preview {
        private final long clusterId;
        private final List<DungeonEditorWorkspaceValues.Edge> sourceEdges;
        private final int deltaQ;
        private final int deltaR;
        private final int deltaLevel;

        public MoveBoundaryStretchPreview(
                long clusterId,
                List<DungeonEditorWorkspaceValues.Edge> sourceEdges,
                int deltaQ,
                int deltaR,
                int deltaLevel
        ) {
            this.clusterId = Math.max(0L, clusterId);
            this.sourceEdges = sourceEdges == null ? List.of() : List.copyOf(sourceEdges);
            this.deltaQ = deltaQ;
            this.deltaR = deltaR;
            this.deltaLevel = deltaLevel;
        }

        public long clusterId() {
            return clusterId;
        }

        public List<DungeonEditorWorkspaceValues.Edge> sourceEdges() {
            return List.copyOf(sourceEdges);
        }

        public int deltaQ() {
            return deltaQ;
        }

        public int deltaR() {
            return deltaR;
        }

        public int deltaLevel() {
            return deltaLevel;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof MoveBoundaryStretchPreview that)) {
                return false;
            }
            return clusterId == that.clusterId
                    && deltaQ == that.deltaQ
                    && deltaR == that.deltaR
                    && deltaLevel == that.deltaLevel
                    && Objects.equals(sourceEdges, that.sourceEdges);
        }

        @Override
        public int hashCode() {
            return Objects.hash(clusterId, sourceEdges, deltaQ, deltaR, deltaLevel);
        }

        @Override
        public String toString() {
            return "MoveBoundaryStretchPreview[clusterId=%d, sourceEdges=%s, deltaQ=%d, deltaR=%d, deltaLevel=%d]"
                    .formatted(clusterId, sourceEdges, deltaQ, deltaR, deltaLevel);
        }
    }

    public static boolean hasSelectedMap(DungeonEditorWorkspaceValues.@Nullable MapId selectedMapId) {
        return selectedMapId != null;
    }

    public static DungeonEditorWorkspaceValues.HandleRef emptyHandleRef() {
        return DungeonEditorWorkspaceValues.HandleRef.empty();
    }
}
