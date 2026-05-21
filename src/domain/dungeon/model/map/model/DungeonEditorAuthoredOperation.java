package src.domain.dungeon.model.map.model;

import java.util.List;

public final class DungeonEditorAuthoredOperation {

    public enum Kind {
        PAINT_ROOM_RECTANGLE,
        DELETE_ROOM_RECTANGLE,
        EDIT_CLUSTER_BOUNDARIES,
        CREATE_CORRIDOR,
        DELETE_CORRIDOR,
        MOVE_EDITOR_HANDLE,
        MOVE_BOUNDARY_STRETCH,
        SAVE_ROOM_NARRATION
    }

    private final Kind kind;
    private final DungeonCell start;
    private final DungeonCell end;
    private final long clusterId;
    private final List<DungeonEdge> edges;
    private final DungeonClusterBoundaryKind boundaryKind;
    private final boolean deleteMode;
    private final DungeonCorridorEndpoint corridorStart;
    private final DungeonCorridorEndpoint corridorEnd;
    private final long corridorId;
    private final DungeonEditorHandle handle;
    private final int deltaQ;
    private final int deltaR;
    private final int deltaLevel;
    private final long roomId;
    private final DungeonRoomNarration narration;

    private DungeonEditorAuthoredOperation(
            Kind kind,
            DungeonCell start,
            DungeonCell end,
            long clusterId,
            List<DungeonEdge> edges,
            DungeonClusterBoundaryKind boundaryKind,
            boolean deleteMode,
            DungeonCorridorEndpoint corridorStart,
            DungeonCorridorEndpoint corridorEnd,
            long corridorId,
            DungeonEditorHandle handle,
            int deltaQ,
            int deltaR,
            int deltaLevel,
            long roomId,
            DungeonRoomNarration narration
    ) {
        this.kind = kind;
        this.start = start == null ? emptyCell() : start;
        this.end = end == null ? emptyCell() : end;
        this.clusterId = Math.max(0L, clusterId);
        this.edges = edges == null ? List.of() : List.copyOf(edges);
        this.boundaryKind = boundaryKind == null ? DungeonClusterBoundaryKind.WALL : boundaryKind;
        this.deleteMode = deleteMode;
        this.corridorStart = corridorStart;
        this.corridorEnd = corridorEnd;
        this.corridorId = Math.max(0L, corridorId);
        this.handle = handle;
        this.deltaQ = deltaQ;
        this.deltaR = deltaR;
        this.deltaLevel = deltaLevel;
        this.roomId = Math.max(0L, roomId);
        this.narration = narration;
    }

    public static DungeonEditorAuthoredOperation paintRoomRectangle(DungeonCell start, DungeonCell end) {
        return new DungeonEditorAuthoredOperation(
                Kind.PAINT_ROOM_RECTANGLE,
                start,
                end,
                0L,
                List.of(),
                DungeonClusterBoundaryKind.WALL,
                false,
                null,
                null,
                0L,
                null,
                0,
                0,
                0,
                0L,
                null);
    }

    public static DungeonEditorAuthoredOperation deleteRoomRectangle(DungeonCell start, DungeonCell end) {
        return new DungeonEditorAuthoredOperation(
                Kind.DELETE_ROOM_RECTANGLE,
                start,
                end,
                0L,
                List.of(),
                DungeonClusterBoundaryKind.WALL,
                false,
                null,
                null,
                0L,
                null,
                0,
                0,
                0,
                0L,
                null);
    }

    public static DungeonEditorAuthoredOperation editClusterBoundaries(
            long clusterId,
            List<DungeonEdge> edges,
            DungeonClusterBoundaryKind boundaryKind,
            boolean deleteMode
    ) {
        return new DungeonEditorAuthoredOperation(
                Kind.EDIT_CLUSTER_BOUNDARIES,
                null,
                null,
                clusterId,
                edges,
                boundaryKind,
                deleteMode,
                null,
                null,
                0L,
                null,
                0,
                0,
                0,
                0L,
                null);
    }

    public static DungeonEditorAuthoredOperation createCorridor(
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end
    ) {
        return new DungeonEditorAuthoredOperation(
                Kind.CREATE_CORRIDOR,
                null,
                null,
                0L,
                List.of(),
                DungeonClusterBoundaryKind.WALL,
                false,
                start,
                end,
                0L,
                null,
                0,
                0,
                0,
                0L,
                null);
    }

    public static DungeonEditorAuthoredOperation deleteCorridor(long corridorId) {
        return new DungeonEditorAuthoredOperation(
                Kind.DELETE_CORRIDOR,
                null,
                null,
                0L,
                List.of(),
                DungeonClusterBoundaryKind.WALL,
                false,
                null,
                null,
                corridorId,
                null,
                0,
                0,
                0,
                0L,
                null);
    }

    public static DungeonEditorAuthoredOperation moveEditorHandle(
            DungeonEditorHandle handle,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return new DungeonEditorAuthoredOperation(
                Kind.MOVE_EDITOR_HANDLE,
                null,
                null,
                0L,
                List.of(),
                DungeonClusterBoundaryKind.WALL,
                false,
                null,
                null,
                0L,
                handle,
                deltaQ,
                deltaR,
                deltaLevel,
                0L,
                null);
    }

    public static DungeonEditorAuthoredOperation moveBoundaryStretch(
            long clusterId,
            List<DungeonEdge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return new DungeonEditorAuthoredOperation(
                Kind.MOVE_BOUNDARY_STRETCH,
                null,
                null,
                clusterId,
                sourceEdges,
                DungeonClusterBoundaryKind.WALL,
                false,
                null,
                null,
                0L,
                null,
                deltaQ,
                deltaR,
                deltaLevel,
                0L,
                null);
    }

    public static DungeonEditorAuthoredOperation saveRoomNarration(
            long roomId,
            DungeonRoomNarration narration
    ) {
        return new DungeonEditorAuthoredOperation(
                Kind.SAVE_ROOM_NARRATION,
                null,
                null,
                0L,
                List.of(),
                DungeonClusterBoundaryKind.WALL,
                false,
                null,
                null,
                0L,
                null,
                0,
                0,
                0,
                roomId,
                narration);
    }

    public Kind kind() {
        return kind;
    }

    public DungeonCell start() {
        return start;
    }

    public DungeonCell end() {
        return end;
    }

    public long clusterId() {
        return clusterId;
    }

    public List<DungeonEdge> edges() {
        return List.copyOf(edges);
    }

    public List<DungeonEdge> sourceEdges() {
        return List.copyOf(edges);
    }

    public DungeonClusterBoundaryKind boundaryKind() {
        return boundaryKind;
    }

    public boolean deleteMode() {
        return deleteMode;
    }

    public DungeonCorridorEndpoint corridorStart() {
        return corridorStart;
    }

    public DungeonCorridorEndpoint corridorEnd() {
        return corridorEnd;
    }

    public long corridorId() {
        return corridorId;
    }

    public DungeonEditorHandle handle() {
        return handle;
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

    public long roomId() {
        return roomId;
    }

    public DungeonRoomNarration narration() {
        return narration;
    }

    private static DungeonCell emptyCell() {
        return new DungeonCell(0, 0, 0);
    }
}
