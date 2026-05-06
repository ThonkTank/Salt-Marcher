package src.domain.dungeoneditor.session.value;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonBoundaryKind;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonTopologyElementRef;

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

        public String name() {
            return name;
        }

        public static ViewMode fromName(@Nullable String name) {
            return "GRAPH".equals(name) ? GRAPH : GRID;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof ViewMode that)) {
                return false;
            }
            return name.equals(that.name);
        }

        @Override
        public int hashCode() {
            return name.hashCode();
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
        public static final Tool STAIR_DELETE = new Tool("STAIR_DELETE");
        public static final Tool TRANSITION_CREATE = new Tool("TRANSITION_CREATE");
        public static final Tool TRANSITION_DELETE = new Tool("TRANSITION_DELETE");

        private final String name;

        private Tool(String name) {
            this.name = name;
        }

        public String name() {
            return name;
        }

        public static Tool fromName(@Nullable String name) {
            return switch (name == null ? "" : name) {
                case "ROOM_PAINT" -> ROOM_PAINT;
                case "ROOM_DELETE" -> ROOM_DELETE;
                case "WALL_CREATE" -> WALL_CREATE;
                case "WALL_DELETE" -> WALL_DELETE;
                case "DOOR_CREATE" -> DOOR_CREATE;
                case "DOOR_DELETE" -> DOOR_DELETE;
                case "CORRIDOR_CREATE" -> CORRIDOR_CREATE;
                case "CORRIDOR_DELETE" -> CORRIDOR_DELETE;
                case "STAIR_CREATE" -> STAIR_CREATE;
                case "STAIR_DELETE" -> STAIR_DELETE;
                case "TRANSITION_CREATE" -> TRANSITION_CREATE;
                case "TRANSITION_DELETE" -> TRANSITION_DELETE;
                default -> SELECT;
            };
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

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof Tool that)) {
                return false;
            }
            return name.equals(that.name);
        }

        @Override
        public int hashCode() {
            return name.hashCode();
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

        public OverlaySettings(
                @Nullable String modeKey,
                int levelRange,
                double opacity,
                @Nullable List<Integer> selectedLevels
        ) {
            this.modeKey = modeKey == null || modeKey.isBlank() ? "OFF" : modeKey;
            this.levelRange = Math.max(0, levelRange);
            this.opacity = Math.max(0.0, Math.min(1.0, opacity));
            this.selectedLevels = selectedLevels == null ? List.of() : List.copyOf(selectedLevels);
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

        public static OverlaySettings defaults() {
            return new OverlaySettings("OFF", 2, 0.35, List.of());
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
                    && Double.compare(that.opacity, opacity) == 0
                    && modeKey.equals(that.modeKey)
                    && selectedLevels.equals(that.selectedLevels);
        }

        @Override
        public int hashCode() {
            return Objects.hash(modeKey, levelRange, opacity, selectedLevels);
        }

        @Override
        public String toString() {
            return "OverlaySettings{modeKey='%s', levelRange=%d, opacity=%s, selectedLevels=%s}"
                    .formatted(modeKey, levelRange, opacity, selectedLevels);
        }
    }

    public record Selection(
            DungeonTopologyElementRef topologyRef,
            long clusterId,
            boolean clusterSelection,
            @Nullable DungeonEditorHandleRef handleRef
    ) {
        public Selection {
            topologyRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
            clusterId = Math.max(0L, clusterId);
        }

        public static Selection empty() {
            return new Selection(DungeonTopologyElementRef.empty(), 0L, false, null);
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

    public static final class NoPreview implements Preview {
        private static final NoPreview INSTANCE = new NoPreview();

        private NoPreview() {
        }

        @Override
        public String toString() {
            return "NoPreview";
        }
    }

    public static final class RoomRectanglePreview implements Preview {
        private final DungeonCellRef start;
        private final DungeonCellRef end;
        private final boolean deleteMode;

        public RoomRectanglePreview(@Nullable DungeonCellRef start, @Nullable DungeonCellRef end, boolean deleteMode) {
            this.start = start == null ? new DungeonCellRef(0, 0, 0) : start;
            this.end = end == null ? new DungeonCellRef(0, 0, 0) : end;
            this.deleteMode = deleteMode;
        }

        public DungeonCellRef start() {
            return start;
        }

        public DungeonCellRef end() {
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
            return deleteMode == that.deleteMode && start.equals(that.start) && end.equals(that.end);
        }

        @Override
        public int hashCode() {
            return Objects.hash(start, end, deleteMode);
        }
    }

    public static final class ClusterBoundariesPreview implements Preview {
        private final long clusterId;
        private final List<DungeonEdgeRef> edges;
        private final DungeonBoundaryKind boundaryKind;
        private final boolean deleteMode;

        public ClusterBoundariesPreview(
                long clusterId,
                @Nullable List<DungeonEdgeRef> edges,
                @Nullable DungeonBoundaryKind boundaryKind,
                boolean deleteMode
        ) {
            this.clusterId = Math.max(0L, clusterId);
            this.edges = edges == null ? List.of() : List.copyOf(edges);
            this.boundaryKind = boundaryKind == null ? DungeonBoundaryKind.WALL : boundaryKind;
            this.deleteMode = deleteMode;
        }

        public long clusterId() {
            return clusterId;
        }

        public List<DungeonEdgeRef> edges() {
            return List.copyOf(edges);
        }

        public DungeonBoundaryKind boundaryKind() {
            return boundaryKind;
        }

        public boolean deleteMode() {
            return deleteMode;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof ClusterBoundariesPreview that)) {
                return false;
            }
            return clusterId == that.clusterId
                    && deleteMode == that.deleteMode
                    && edges.equals(that.edges)
                    && boundaryKind == that.boundaryKind;
        }

        @Override
        public int hashCode() {
            return Objects.hash(clusterId, edges, boundaryKind, deleteMode);
        }
    }

    public static final class CorridorCreatePreview implements Preview {
        private final DungeonEditorOperation.CorridorEndpoint start;
        private final DungeonEditorOperation.CorridorEndpoint end;

        public CorridorCreatePreview(
                DungeonEditorOperation.@Nullable CorridorEndpoint start,
                DungeonEditorOperation.@Nullable CorridorEndpoint end
        ) {
            this.start = Objects.requireNonNull(start, "start");
            this.end = Objects.requireNonNull(end, "end");
        }

        public DungeonEditorOperation.CorridorEndpoint start() {
            return start;
        }

        public DungeonEditorOperation.CorridorEndpoint end() {
            return end;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof CorridorCreatePreview that)) {
                return false;
            }
            return start.equals(that.start) && end.equals(that.end);
        }

        @Override
        public int hashCode() {
            return Objects.hash(start, end);
        }
    }

    public static final class CorridorDeletePreview implements Preview {
        private final long corridorId;

        public CorridorDeletePreview(long corridorId) {
            this.corridorId = Math.max(0L, corridorId);
        }

        public long corridorId() {
            return corridorId;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof CorridorDeletePreview that)) {
                return false;
            }
            return corridorId == that.corridorId;
        }

        @Override
        public int hashCode() {
            return Long.hashCode(corridorId);
        }
    }

    public static final class MoveHandlePreview implements Preview {
        private final DungeonEditorHandleRef handleRef;
        private final int deltaQ;
        private final int deltaR;
        private final int deltaLevel;

        public MoveHandlePreview(
                src.domain.dungeon.published.@Nullable DungeonEditorHandleRef handleRef,
                int deltaQ,
                int deltaR,
                int deltaLevel
        ) {
            this.handleRef = handleRef == null
                    ? emptyHandleRef()
                    : handleRef;
            this.deltaQ = deltaQ;
            this.deltaR = deltaR;
            this.deltaLevel = deltaLevel;
        }

        public DungeonEditorHandleRef handleRef() {
            return handleRef;
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
            if (!(other instanceof MoveHandlePreview that)) {
                return false;
            }
            return deltaQ == that.deltaQ
                    && deltaR == that.deltaR
                    && deltaLevel == that.deltaLevel
                    && handleRef.equals(that.handleRef);
        }

        @Override
        public int hashCode() {
            return Objects.hash(handleRef, deltaQ, deltaR, deltaLevel);
        }
    }

    public static final class MoveBoundaryStretchPreview implements Preview {
        private final long clusterId;
        private final List<DungeonEdgeRef> sourceEdges;
        private final int deltaQ;
        private final int deltaR;
        private final int deltaLevel;

        public MoveBoundaryStretchPreview(
                long clusterId,
                @Nullable List<DungeonEdgeRef> sourceEdges,
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

        public List<DungeonEdgeRef> sourceEdges() {
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
                    && sourceEdges.equals(that.sourceEdges);
        }

        @Override
        public int hashCode() {
            return Objects.hash(clusterId, sourceEdges, deltaQ, deltaR, deltaLevel);
        }
    }

    public static @Nullable DungeonMapId primeSelectedMap(@Nullable DungeonMapId selectedMapId, long mapId) {
        return selectedMapId == null && mapId > 0L ? new DungeonMapId(mapId) : selectedMapId;
    }

    public static boolean hasSelectedMap(@Nullable DungeonMapId selectedMapId) {
        return selectedMapId != null;
    }

    public static DungeonEditorHandleRef emptyHandleRef() {
        return new DungeonEditorHandleRef(
                DungeonEditorHandleKind.CLUSTER_LABEL,
                DungeonTopologyElementRef.empty(),
                0L,
                0L,
                0L,
                0L,
                0,
                new DungeonCellRef(0, 0, 0),
                "");
    }
}
