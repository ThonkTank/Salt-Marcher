package src.view.leftbartabs.dungeoneditor;

import java.util.List;

public record DungeonEditorPublishedEvent(
        Kind kind,
        long mapId,
        String mapName,
        int projectionLevel,
        String viewModeKey,
        Mutation mutation,
        InspectorSelection inspectorSelection
) {

    public DungeonEditorPublishedEvent {
        kind = kind == null ? Kind.LOAD_EDITOR : kind;
        mapId = Math.max(0L, mapId);
        mapName = mapName == null ? "" : mapName;
        viewModeKey = viewModeKey == null ? "GRID" : viewModeKey;
        mutation = mutation == null ? Mutation.none() : mutation;
        inspectorSelection = inspectorSelection == null ? InspectorSelection.empty() : inspectorSelection;
    }

    static DungeonEditorPublishedEvent loadEditor(long mapId, int projectionLevel, String viewModeKey) {
        return new DungeonEditorPublishedEvent(
                Kind.LOAD_EDITOR,
                mapId,
                "",
                projectionLevel,
                viewModeKey,
                Mutation.none(),
                InspectorSelection.empty());
    }

    static DungeonEditorPublishedEvent createMap(String mapName) {
        return new DungeonEditorPublishedEvent(
                Kind.CREATE_MAP,
                0L,
                mapName,
                0,
                "GRID",
                Mutation.none(),
                InspectorSelection.empty());
    }

    static DungeonEditorPublishedEvent renameMap(long mapId, String mapName) {
        return new DungeonEditorPublishedEvent(
                Kind.RENAME_MAP,
                mapId,
                mapName,
                0,
                "GRID",
                Mutation.none(),
                InspectorSelection.empty());
    }

    static DungeonEditorPublishedEvent deleteMap(long mapId) {
        return new DungeonEditorPublishedEvent(
                Kind.DELETE_MAP,
                mapId,
                "",
                0,
                "GRID",
                Mutation.none(),
                InspectorSelection.empty());
    }

    static DungeonEditorPublishedEvent previewSurfaceEdit(long mapId, Mutation mutation) {
        return new DungeonEditorPublishedEvent(
                Kind.PREVIEW_SURFACE_EDIT,
                mapId,
                "",
                0,
                "GRID",
                mutation,
                InspectorSelection.empty());
    }

    static DungeonEditorPublishedEvent applySurfaceEdit(long mapId, Mutation mutation) {
        return new DungeonEditorPublishedEvent(
                Kind.APPLY_SURFACE_EDIT,
                mapId,
                "",
                0,
                "GRID",
                mutation,
                InspectorSelection.empty());
    }

    static DungeonEditorPublishedEvent loadSurface(long mapId, InspectorSelection inspectorSelection) {
        return new DungeonEditorPublishedEvent(
                Kind.LOAD_SURFACE,
                mapId,
                "",
                0,
                "GRID",
                Mutation.none(),
                inspectorSelection);
    }

    enum Kind {
        LOAD_EDITOR,
        CREATE_MAP,
        RENAME_MAP,
        DELETE_MAP,
        PREVIEW_SURFACE_EDIT,
        APPLY_SURFACE_EDIT,
        LOAD_SURFACE
    }

    public sealed interface Mutation permits NoneMutation,
            RoomRectangleMutation,
            ClusterBoundariesMutation,
            SaveRoomNarrationMutation,
            MoveHandleMutation,
            MoveBoundaryStretchMutation {

        static Mutation none() {
            return NoneMutation.INSTANCE;
        }
    }

    enum NoneMutation implements Mutation {
        INSTANCE
    }

    public record RoomRectangleMutation(CellRef start, CellRef end, boolean deleteMode) implements Mutation {
        public RoomRectangleMutation {
            start = start == null ? CellRef.empty() : start;
            end = end == null ? CellRef.empty() : end;
        }
    }

    public record ClusterBoundariesMutation(
            long clusterId,
            List<EdgeRef> edges,
            String boundaryKind,
            boolean deleteMode
    ) implements Mutation {
        public ClusterBoundariesMutation {
            clusterId = Math.max(0L, clusterId);
            edges = edges == null ? List.of() : List.copyOf(edges);
            boundaryKind = boundaryKind == null ? "WALL" : boundaryKind;
        }
    }

    public record SaveRoomNarrationMutation(
            long roomId,
            String visualDescription,
            List<RoomExitNarration> exits
    ) implements Mutation {
        public SaveRoomNarrationMutation {
            roomId = Math.max(0L, roomId);
            visualDescription = visualDescription == null ? "" : visualDescription;
            exits = exits == null ? List.of() : List.copyOf(exits);
        }
    }

    public record MoveHandleMutation(
            HandleRef handleRef,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements Mutation {
        public MoveHandleMutation {
            handleRef = handleRef == null ? HandleRef.empty() : handleRef;
        }
    }

    public record MoveBoundaryStretchMutation(
            long clusterId,
            List<EdgeRef> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements Mutation {
        public MoveBoundaryStretchMutation {
            clusterId = Math.max(0L, clusterId);
            sourceEdges = sourceEdges == null ? List.of() : List.copyOf(sourceEdges);
        }
    }

    public record InspectorSelection(
            String topologyRefKind,
            long topologyRefId,
            long clusterId,
            boolean clusterSelection,
            String surfaceKind
    ) {
        public InspectorSelection {
            topologyRefKind = topologyRefKind == null ? "EMPTY" : topologyRefKind;
            topologyRefId = Math.max(0L, topologyRefId);
            clusterId = Math.max(0L, clusterId);
            surfaceKind = surfaceKind == null ? "EDITOR" : surfaceKind;
        }

        static InspectorSelection empty() {
            return new InspectorSelection("EMPTY", 0L, 0L, false, "EDITOR");
        }
    }

    public record CellRef(int q, int r, int level) {
        static CellRef empty() {
            return new CellRef(0, 0, 0);
        }
    }

    public record EdgeRef(CellRef from, CellRef to) {
        public EdgeRef {
            from = from == null ? CellRef.empty() : from;
            to = to == null ? CellRef.empty() : to;
        }
    }

    public record HandleRef(
            String kind,
            String topologyRefKind,
            long topologyRefId,
            long ownerId,
            long clusterId,
            long corridorId,
            long roomId,
            int index,
            CellRef cell,
            String direction
    ) {
        public HandleRef {
            kind = kind == null ? "CLUSTER_LABEL" : kind;
            topologyRefKind = topologyRefKind == null ? "EMPTY" : topologyRefKind;
            topologyRefId = Math.max(0L, topologyRefId);
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            corridorId = Math.max(0L, corridorId);
            roomId = Math.max(0L, roomId);
            index = Math.max(0, index);
            cell = cell == null ? CellRef.empty() : cell;
            direction = direction == null ? "" : direction;
        }

        static HandleRef empty() {
            return new HandleRef("CLUSTER_LABEL", "EMPTY", 0L, 0L, 0L, 0L, 0L, 0, CellRef.empty(), "");
        }
    }

    public record RoomExitNarration(
            String label,
            CellRef cell,
            String direction,
            String description
    ) {
        public RoomExitNarration {
            label = label == null ? "" : label;
            cell = cell == null ? CellRef.empty() : cell;
            direction = direction == null ? "" : direction;
            description = description == null ? "" : description;
        }
    }
}
