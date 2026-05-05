package src.domain.dungeoneditor.session.entity;

import java.util.List;
import java.util.Objects;

public final class DungeonEditorSession {

    private SelectedMap selectedMap = SelectedMap.none();
    private ViewMode viewMode = ViewMode.GRID;
    private Tool selectedTool = Tool.SELECT;
    private int projectionLevel;
    private OverlaySettings overlaySettings = OverlaySettings.defaults();
    private Selection selection = Selection.empty();
    private Preview preview = Preview.none();
    private String statusText = "";

    public void primeSelectedMap(long mapId) {
        if (!selectedMap.present() && mapId > 0L) {
            selectedMap = new SelectedMap(mapId);
        }
    }

    public SelectedMap selectedMap() {
        return selectedMap;
    }

    public void selectedMap(SelectedMap nextSelectedMap) {
        selectedMap = nextSelectedMap == null ? SelectedMap.none() : nextSelectedMap;
    }

    public ViewMode viewMode() {
        return viewMode;
    }

    public void viewMode(ViewMode nextViewMode) {
        viewMode = nextViewMode == null ? ViewMode.GRID : nextViewMode;
    }

    public Tool selectedTool() {
        return selectedTool;
    }

    public void selectedTool(Tool nextSelectedTool) {
        selectedTool = nextSelectedTool == null ? Tool.SELECT : nextSelectedTool;
    }

    public int projectionLevel() {
        return projectionLevel;
    }

    public void projectionLevel(int nextProjectionLevel) {
        projectionLevel = nextProjectionLevel;
    }

    public void shiftProjectionLevel(int delta) {
        projectionLevel += delta;
    }

    public OverlaySettings overlaySettings() {
        return overlaySettings;
    }

    public void overlaySettings(OverlaySettings nextOverlaySettings) {
        overlaySettings = nextOverlaySettings == null ? OverlaySettings.defaults() : nextOverlaySettings;
    }

    public Selection selection() {
        return selection;
    }

    public void selection(Selection nextSelection) {
        selection = nextSelection == null ? Selection.empty() : nextSelection;
    }

    public void clearSelection() {
        selection = Selection.empty();
    }

    public Preview preview() {
        return preview;
    }

    public void preview(Preview nextPreview) {
        preview = nextPreview == null ? Preview.none() : nextPreview;
    }

    public void clearPreview() {
        preview = Preview.none();
    }

    public String statusText() {
        return statusText;
    }

    public void statusText(String nextStatusText) {
        statusText = nextStatusText == null ? "" : nextStatusText;
    }

    public void clearTransientState(String nextStatusText) {
        preview = Preview.none();
        statusText(nextStatusText);
    }

    public record SelectedMap(long value) {
        public SelectedMap {
            value = Math.max(0L, value);
        }

        public static SelectedMap none() {
            return new SelectedMap(0L);
        }

        public boolean present() {
            return value > 0L;
        }
    }

    public enum ViewMode {
        GRID,
        GRAPH
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
    }

    public record TopologyRef(String kind, long id) {
        public TopologyRef {
            kind = kind == null || kind.isBlank() ? "EMPTY" : kind.trim();
            id = Math.max(0L, id);
        }

        public static TopologyRef empty() {
            return new TopologyRef("EMPTY", 0L);
        }

        public boolean present() {
            return id > 0L && !"EMPTY".equals(kind);
        }
    }

    public record Cell(int q, int r, int level) {
        public static Cell empty() {
            return new Cell(0, 0, 0);
        }
    }

    public record Edge(Cell from, Cell to) {
        public Edge {
            from = from == null ? Cell.empty() : from;
            to = to == null ? Cell.empty() : to;
        }
    }

    public record HandleRef(
            String kind,
            TopologyRef topologyRef,
            long ownerId,
            long clusterId,
            long corridorId,
            long roomId,
            int orderIndex,
            Cell anchor,
            String direction
    ) {
        public HandleRef {
            kind = kind == null || kind.isBlank() ? "CLUSTER_LABEL" : kind.trim();
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            corridorId = Math.max(0L, corridorId);
            roomId = Math.max(0L, roomId);
            orderIndex = Math.max(0, orderIndex);
            anchor = anchor == null ? Cell.empty() : anchor;
            direction = direction == null ? "" : direction;
        }

        public static HandleRef empty() {
            return new HandleRef("CLUSTER_LABEL", TopologyRef.empty(), 0L, 0L, 0L, 0L, 0, Cell.empty(), "");
        }

        public static HandleRef clusterLabel(TopologyRef topologyRef, long ownerId, long clusterId) {
            return new HandleRef("CLUSTER_LABEL", topologyRef, ownerId, clusterId, 0L, 0L, 0, Cell.empty(), "");
        }

        public boolean present() {
            return topologyRef.present() || ownerId > 0L || clusterId > 0L;
        }
    }

    public record Selection(
            TopologyRef topologyRef,
            long clusterId,
            boolean clusterSelection,
            HandleRef handleRef
    ) {
        public Selection {
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
            clusterId = Math.max(0L, clusterId);
            handleRef = handleRef == null ? HandleRef.empty() : handleRef;
        }

        public static Selection empty() {
            return new Selection(TopologyRef.empty(), 0L, false, HandleRef.empty());
        }
    }

    public sealed interface Preview permits NonePreview,
            RoomRectanglePreview,
            ClusterBoundariesPreview,
            CorridorCreatePreview,
            CorridorDeletePreview,
            MoveHandlePreview,
            MoveBoundaryStretchPreview {
        static Preview none() {
            return NonePreview.INSTANCE;
        }

        default boolean present() {
            return this != NonePreview.INSTANCE;
        }
    }

    public enum NonePreview implements Preview {
        INSTANCE
    }

    public record RoomRectanglePreview(
            Cell start,
            Cell end,
            boolean deleteMode
    ) implements Preview {
        public RoomRectanglePreview {
            start = start == null ? Cell.empty() : start;
            end = end == null ? Cell.empty() : end;
        }
    }

    public record ClusterBoundariesPreview(
            long clusterId,
            List<Edge> edges,
            String boundaryKind,
            boolean deleteMode
    ) implements Preview {
        public ClusterBoundariesPreview {
            clusterId = Math.max(0L, clusterId);
            edges = edges == null ? List.of() : List.copyOf(edges);
            boundaryKind = boundaryKind == null || boundaryKind.isBlank() ? "WALL" : boundaryKind.trim();
        }
    }

    public sealed interface CorridorEndpoint permits CorridorDoorEndpoint, CorridorAnchorEndpoint {
        TopologyRef topologyRef();
    }

    public record CorridorDoorEndpoint(
            long roomId,
            long clusterId,
            Cell anchor,
            String direction,
            TopologyRef topologyRef
    ) implements CorridorEndpoint {
        public CorridorDoorEndpoint {
            roomId = Math.max(0L, roomId);
            clusterId = Math.max(0L, clusterId);
            anchor = anchor == null ? Cell.empty() : anchor;
            direction = direction == null ? "" : direction;
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
        }
    }

    public record CorridorAnchorEndpoint(
            long corridorId,
            Cell anchor,
            TopologyRef topologyRef
    ) implements CorridorEndpoint {
        public CorridorAnchorEndpoint {
            corridorId = Math.max(0L, corridorId);
            anchor = anchor == null ? Cell.empty() : anchor;
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
        }
    }

    public record CorridorCreatePreview(
            CorridorEndpoint start,
            CorridorEndpoint end
    ) implements Preview {
        public CorridorCreatePreview {
            start = Objects.requireNonNull(start, "start");
            end = Objects.requireNonNull(end, "end");
        }
    }

    public record CorridorDeletePreview(long corridorId) implements Preview {
        public CorridorDeletePreview {
            corridorId = Math.max(0L, corridorId);
        }
    }

    public record MoveHandlePreview(
            HandleRef handleRef,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements Preview {
        public MoveHandlePreview {
            handleRef = handleRef == null ? HandleRef.empty() : handleRef;
        }
    }

    public record MoveBoundaryStretchPreview(
            long clusterId,
            List<Edge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements Preview {
        public MoveBoundaryStretchPreview {
            clusterId = Math.max(0L, clusterId);
            sourceEdges = sourceEdges == null ? List.of() : List.copyOf(sourceEdges);
        }
    }
}
