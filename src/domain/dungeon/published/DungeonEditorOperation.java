package src.domain.dungeon.published;

/**
 * Semantic operations accepted by the dungeon mutation pipeline.
 */
public sealed interface DungeonEditorOperation permits
        DungeonEditorOperation.MoveTopologyElement,
        DungeonEditorOperation.MoveEditorHandle,
        DungeonEditorOperation.MoveBoundaryStretch,
        DungeonEditorOperation.MoveRoomAnchor,
        DungeonEditorOperation.RoomRectangle,
        DungeonEditorOperation.EditClusterBoundaries,
        DungeonEditorOperation.CreateCorridor,
        DungeonEditorOperation.ExtendCorridor,
        DungeonEditorOperation.MergeCorridors,
        DungeonEditorOperation.DeleteCorridor,
        DungeonEditorOperation.SaveRoomNarration {

    default String operationKindName() {
        return getClass().getSimpleName();
    }

    default int deltaQ() {
        return switch (this) {
            case MoveTopologyElement move -> move.deltaQ();
            case MoveEditorHandle move -> move.deltaQ();
            case MoveBoundaryStretch move -> move.deltaQ();
            case MoveRoomAnchor move -> move.deltaQ();
            default -> 0;
        };
    }

    default int deltaR() {
        return switch (this) {
            case MoveTopologyElement move -> move.deltaR();
            case MoveEditorHandle move -> move.deltaR();
            case MoveBoundaryStretch move -> move.deltaR();
            case MoveRoomAnchor move -> move.deltaR();
            default -> 0;
        };
    }

    default int deltaLevel() {
        return switch (this) {
            case MoveTopologyElement move -> move.deltaLevel();
            case MoveEditorHandle move -> move.deltaLevel();
            case MoveBoundaryStretch move -> move.deltaLevel();
            default -> 0;
        };
    }

    default long clusterId() {
        return switch (this) {
            case MoveBoundaryStretch move -> move.clusterId();
            case EditClusterBoundaries edit -> edit.clusterId();
            default -> 0L;
        };
    }

    default long corridorId() {
        return switch (this) {
            case ExtendCorridor extend -> extend.corridorId();
            case MergeCorridors merge -> merge.corridorId();
            case DeleteCorridor delete -> delete.corridorId();
            default -> 0L;
        };
    }

    default long mergedCorridorId() {
        return this instanceof MergeCorridors merge ? merge.mergedCorridorId() : 0L;
    }

    default long roomId() {
        return this instanceof SaveRoomNarration save ? save.roomId() : 0L;
    }

    default String visualDescription() {
        return this instanceof SaveRoomNarration save ? save.visualDescription() : "";
    }

    default String rectangleActionName() {
        return this instanceof RoomRectangle rectangle ? rectangle.action().name() : "PAINT";
    }

    default String boundaryKindName() {
        return this instanceof EditClusterBoundaries edit ? edit.kind().name() : "WALL";
    }

    default boolean deleteBoundary() {
        return this instanceof EditClusterBoundaries edit && edit.deleteBoundary();
    }

    default String topologyKindName() {
        DungeonTopologyElementRef ref = switch (this) {
            case MoveTopologyElement move -> move.ref();
            default -> DungeonTopologyElementRef.empty();
        };
        return ref.kind().name();
    }

    default long topologyId() {
        return this instanceof MoveTopologyElement move ? move.ref().id() : 0L;
    }

    default String handleKindName() {
        return this instanceof MoveEditorHandle move ? move.ref().kind().name() : "";
    }

    default String handleTopologyKindName() {
        return this instanceof MoveEditorHandle move ? move.ref().topologyRef().kind().name() : "EMPTY";
    }

    default long handleTopologyId() {
        return this instanceof MoveEditorHandle move ? move.ref().topologyRef().id() : 0L;
    }

    default long handleOwnerId() {
        return this instanceof MoveEditorHandle move ? move.ref().ownerId() : 0L;
    }

    default long handleClusterId() {
        return this instanceof MoveEditorHandle move ? move.ref().clusterId() : 0L;
    }

    default long handleCorridorId() {
        return this instanceof MoveEditorHandle move ? move.ref().corridorId() : 0L;
    }

    default long handleRoomId() {
        return this instanceof MoveEditorHandle move ? move.ref().roomId() : 0L;
    }

    default int handleIndex() {
        return this instanceof MoveEditorHandle move ? move.ref().index() : 0;
    }

    default int handleCellQ() {
        return this instanceof MoveEditorHandle move ? move.ref().cell().q() : 0;
    }

    default int handleCellR() {
        return this instanceof MoveEditorHandle move ? move.ref().cell().r() : 0;
    }

    default int handleCellLevel() {
        return this instanceof MoveEditorHandle move ? move.ref().cell().level() : 0;
    }

    default String handleDirection() {
        return this instanceof MoveEditorHandle move ? move.ref().direction() : "";
    }

    default int startCellQ() {
        return this instanceof RoomRectangle rectangle ? rectangle.start().q() : 0;
    }

    default int startCellR() {
        return this instanceof RoomRectangle rectangle ? rectangle.start().r() : 0;
    }

    default int startCellLevel() {
        return this instanceof RoomRectangle rectangle ? rectangle.start().level() : 0;
    }

    default int endCellQ() {
        return this instanceof RoomRectangle rectangle ? rectangle.end().q() : 0;
    }

    default int endCellR() {
        return this instanceof RoomRectangle rectangle ? rectangle.end().r() : 0;
    }

    default int endCellLevel() {
        return this instanceof RoomRectangle rectangle ? rectangle.end().level() : 0;
    }

    default int edgeCount() {
        return switch (this) {
            case MoveBoundaryStretch move -> move.sourceEdges().size();
            case EditClusterBoundaries edit -> edit.edges().size();
            default -> 0;
        };
    }

    default int edgeFromQ(int index) {
        return edge(index).from().q();
    }

    default int edgeFromR(int index) {
        return edge(index).from().r();
    }

    default int edgeFromLevel(int index) {
        return edge(index).from().level();
    }

    default int edgeToQ(int index) {
        return edge(index).to().q();
    }

    default int edgeToR(int index) {
        return edge(index).to().r();
    }

    default int edgeToLevel(int index) {
        return edge(index).to().level();
    }

    default String endpointKindName(boolean start) {
        CorridorEndpoint endpoint = endpoint(start);
        return endpoint instanceof CorridorAnchorEndpoint ? "ANCHOR" : "DOOR";
    }

    default long endpointHostCorridorId(boolean start) {
        CorridorEndpoint endpoint = endpoint(start);
        return endpoint instanceof CorridorAnchorEndpoint anchor ? anchor.hostCorridorId() : 0L;
    }

    default long endpointRoomId(boolean start) {
        CorridorEndpoint endpoint = endpoint(start);
        return endpoint instanceof CorridorDoorEndpoint door ? door.roomId() : 0L;
    }

    default long endpointClusterId(boolean start) {
        CorridorEndpoint endpoint = endpoint(start);
        return endpoint instanceof CorridorDoorEndpoint door ? door.clusterId() : 0L;
    }

    default int endpointCellQ(boolean start) {
        return endpointCell(start).q();
    }

    default int endpointCellR(boolean start) {
        return endpointCell(start).r();
    }

    default int endpointCellLevel(boolean start) {
        return endpointCell(start).level();
    }

    default String endpointDirection(boolean start) {
        CorridorEndpoint endpoint = endpoint(start);
        return endpoint instanceof CorridorDoorEndpoint door ? door.direction() : "";
    }

    default String endpointTopologyKindName(boolean start) {
        return endpointTopologyRef(start).kind().name();
    }

    default long endpointTopologyId(boolean start) {
        return endpointTopologyRef(start).id();
    }

    default long roomEndpointRoomId() {
        return this instanceof ExtendCorridor extend ? extend.endpoint().roomId() : 0L;
    }

    default long roomEndpointClusterId() {
        return this instanceof ExtendCorridor extend ? extend.endpoint().clusterId() : 0L;
    }

    default boolean roomEndpointFixedDoor() {
        return this instanceof ExtendCorridor extend && extend.endpoint().fixedDoor();
    }

    default int roomEndpointCellQ() {
        return this instanceof ExtendCorridor extend ? extend.endpoint().roomCell().q() : 0;
    }

    default int roomEndpointCellR() {
        return this instanceof ExtendCorridor extend ? extend.endpoint().roomCell().r() : 0;
    }

    default int roomEndpointCellLevel() {
        return this instanceof ExtendCorridor extend ? extend.endpoint().roomCell().level() : 0;
    }

    default String roomEndpointDirection() {
        return this instanceof ExtendCorridor extend ? extend.endpoint().direction() : "";
    }

    default String roomEndpointTopologyKindName() {
        return this instanceof ExtendCorridor extend ? extend.endpoint().topologyRef().kind().name() : "EMPTY";
    }

    default long roomEndpointTopologyId() {
        return this instanceof ExtendCorridor extend ? extend.endpoint().topologyRef().id() : 0L;
    }

    default int exitCount() {
        return this instanceof SaveRoomNarration save ? save.exits().size() : 0;
    }

    default int exitCellQ(int index) {
        return exit(index).cell().q();
    }

    default int exitCellR(int index) {
        return exit(index).cell().r();
    }

    default int exitCellLevel(int index) {
        return exit(index).cell().level();
    }

    default String exitDirection(int index) {
        return exit(index).direction();
    }

    default String exitDescription(int index) {
        return exit(index).description();
    }

    private DungeonEdgeRef edge(int index) {
        java.util.List<DungeonEdgeRef> edges = switch (this) {
            case MoveBoundaryStretch move -> move.sourceEdges();
            case EditClusterBoundaries edit -> edit.edges();
            default -> java.util.List.of();
        };
        return index >= 0 && index < edges.size()
                ? edges.get(index)
                : new DungeonEdgeRef(new DungeonCellRef(0, 0, 0), new DungeonCellRef(0, 0, 0));
    }

    private CorridorEndpoint endpoint(boolean start) {
        if (this instanceof CreateCorridor create) {
            return start ? create.start() : create.end();
        }
        return new CorridorDoorEndpoint(0L, 0L, new DungeonCellRef(0, 0, 0), "", DungeonTopologyElementRef.empty());
    }

    private DungeonCellRef endpointCell(boolean start) {
        CorridorEndpoint endpoint = endpoint(start);
        return switch (endpoint) {
            case CorridorAnchorEndpoint anchor -> anchor.anchorCell();
            case CorridorDoorEndpoint door -> door.roomCell();
        };
    }

    private DungeonTopologyElementRef endpointTopologyRef(boolean start) {
        CorridorEndpoint endpoint = endpoint(start);
        return switch (endpoint) {
            case CorridorAnchorEndpoint anchor -> anchor.topologyRef();
            case CorridorDoorEndpoint door -> door.topologyRef();
        };
    }

    private DungeonInspectorSnapshot.RoomExitNarration exit(int index) {
        java.util.List<DungeonInspectorSnapshot.RoomExitNarration> exits =
                this instanceof SaveRoomNarration save ? save.exits() : java.util.List.of();
        return index >= 0 && index < exits.size()
                ? exits.get(index)
                : new DungeonInspectorSnapshot.RoomExitNarration("", new DungeonCellRef(0, 0, 0), "", "");
    }

    record MoveTopologyElement(
            DungeonTopologyElementRef ref,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements DungeonEditorOperation {
        public MoveTopologyElement(DungeonTopologyElementRef ref, int deltaQ, int deltaR) {
            this(ref, deltaQ, deltaR, 0);
        }
    }

    record MoveEditorHandle(
            DungeonEditorHandleRef ref,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements DungeonEditorOperation {
    }

    record MoveBoundaryStretch(
            long clusterId,
            java.util.List<DungeonEdgeRef> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements DungeonEditorOperation {
        public MoveBoundaryStretch {
            clusterId = Math.max(0L, clusterId);
            sourceEdges = sourceEdges == null ? java.util.List.of() : java.util.List.copyOf(sourceEdges);
        }
    }

    record MoveRoomAnchor(int deltaQ, int deltaR) implements DungeonEditorOperation {
    }

    record RoomRectangle(
            RectangleAction action,
            DungeonCellRef start,
            DungeonCellRef end
    ) implements DungeonEditorOperation {
        public RoomRectangle {
            action = action == null ? RectangleAction.PAINT : action;
            start = start == null ? new DungeonCellRef(0, 0, 0) : start;
            end = end == null ? start : end;
        }
    }

    enum RectangleAction {
        PAINT,
        DELETE;

        public static RectangleAction fromDeleteMode(boolean deleteMode) {
            return deleteMode ? DELETE : PAINT;
        }

        public boolean deletesRoomCells() {
            return this == DELETE;
        }
    }

    record EditClusterBoundaries(
            long clusterId,
            java.util.List<DungeonEdgeRef> edges,
            DungeonBoundaryKind kind,
            boolean deleteBoundary
    ) implements DungeonEditorOperation {
        public EditClusterBoundaries {
            clusterId = Math.max(0L, clusterId);
            edges = edges == null ? java.util.List.of() : java.util.List.copyOf(edges);
            kind = kind == null ? DungeonBoundaryKind.WALL : kind;
            }
    }

    sealed interface CorridorEndpoint permits CorridorDoorEndpoint, CorridorAnchorEndpoint {
    }

    record CorridorDoorEndpoint(
            long roomId,
            long clusterId,
            DungeonCellRef roomCell,
            String direction,
            DungeonTopologyElementRef topologyRef
    ) implements CorridorEndpoint {
        public CorridorDoorEndpoint {
            roomId = Math.max(0L, roomId);
            clusterId = Math.max(0L, clusterId);
            roomCell = roomCell == null ? new DungeonCellRef(0, 0, 0) : roomCell;
            direction = direction == null ? "" : direction.trim();
            topologyRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
        }
    }

    record CorridorAnchorEndpoint(
            long hostCorridorId,
            DungeonCellRef anchorCell,
            DungeonTopologyElementRef topologyRef
    ) implements CorridorEndpoint {
        public CorridorAnchorEndpoint {
            hostCorridorId = Math.max(0L, hostCorridorId);
            anchorCell = anchorCell == null ? new DungeonCellRef(0, 0, 0) : anchorCell;
            topologyRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
        }
    }

    record CorridorRoomEndpoint(
            long roomId,
            long clusterId,
            boolean fixedDoor,
            DungeonCellRef roomCell,
            String direction,
            DungeonTopologyElementRef topologyRef
    ) {
        public CorridorRoomEndpoint {
            roomId = Math.max(0L, roomId);
            clusterId = Math.max(0L, clusterId);
            roomCell = roomCell == null ? new DungeonCellRef(0, 0, 0) : roomCell;
            direction = direction == null ? "" : direction.trim();
            topologyRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
        }
    }

    record CreateCorridor(
            CorridorEndpoint start,
            CorridorEndpoint end
    ) implements DungeonEditorOperation {
        public CreateCorridor {
            start = start == null
                    ? new CorridorDoorEndpoint(
                    0L,
                    0L,
                    new DungeonCellRef(0, 0, 0),
                    "",
                    DungeonTopologyElementRef.empty())
                    : start;
            end = end == null
                    ? new CorridorDoorEndpoint(
                    0L,
                    0L,
                    new DungeonCellRef(0, 0, 0),
                    "",
                    DungeonTopologyElementRef.empty())
                    : end;
        }
    }

    record ExtendCorridor(
            long corridorId,
            CorridorRoomEndpoint endpoint
    ) implements DungeonEditorOperation {
        public ExtendCorridor {
            corridorId = Math.max(0L, corridorId);
            endpoint = endpoint == null
                    ? new CorridorRoomEndpoint(
                    0L,
                    0L,
                    false,
                    new DungeonCellRef(0, 0, 0),
                    "",
                    DungeonTopologyElementRef.empty())
                    : endpoint;
        }
    }

    record MergeCorridors(
            long corridorId,
            long mergedCorridorId
    ) implements DungeonEditorOperation {
        public MergeCorridors {
            corridorId = Math.max(0L, corridorId);
            mergedCorridorId = Math.max(0L, mergedCorridorId);
        }
    }

    record DeleteCorridor(long corridorId) implements DungeonEditorOperation {
        public DeleteCorridor {
            corridorId = Math.max(0L, corridorId);
        }
    }

    record SaveRoomNarration(
            long roomId,
            String visualDescription,
            java.util.List<DungeonInspectorSnapshot.RoomExitNarration> exits
    ) implements DungeonEditorOperation {
        public SaveRoomNarration {
            visualDescription = visualDescription == null ? "" : visualDescription;
            exits = exits == null ? java.util.List.of() : java.util.List.copyOf(exits);
        }
    }
}
