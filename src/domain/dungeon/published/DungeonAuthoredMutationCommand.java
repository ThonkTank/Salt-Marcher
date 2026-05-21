package src.domain.dungeon.published;

import java.util.List;
import org.jspecify.annotations.Nullable;

public sealed interface DungeonAuthoredMutationCommand permits
        DungeonAuthoredMutationCommand.Operation {

    default String actionName() {
        return Action.APPLY.name();
    }

    default long mapIdValue() {
        return 1L;
    }

    default String operationKindName() {
        return "NOOP";
    }

    default int deltaQ() {
        return 0;
    }

    default int deltaR() {
        return 0;
    }

    default int deltaLevel() {
        return 0;
    }

    default long clusterId() {
        return 0L;
    }

    default long corridorId() {
        return 0L;
    }

    default long mergedCorridorId() {
        return 0L;
    }

    default long roomId() {
        return 0L;
    }

    default String visualDescription() {
        return "";
    }

    default String rectangleActionName() {
        return "PAINT";
    }

    default String boundaryKindName() {
        return "WALL";
    }

    default boolean deleteBoundary() {
        return false;
    }

    default String topologyKindName() {
        return "EMPTY";
    }

    default long topologyId() {
        return 0L;
    }

    default String handleKindName() {
        return "";
    }

    default String handleTopologyKindName() {
        return "EMPTY";
    }

    default long handleTopologyId() {
        return 0L;
    }

    default long handleOwnerId() {
        return 0L;
    }

    default long handleClusterId() {
        return 0L;
    }

    default long handleCorridorId() {
        return 0L;
    }

    default long handleRoomId() {
        return 0L;
    }

    default int handleIndex() {
        return 0;
    }

    default int handleCellQ() {
        return 0;
    }

    default int handleCellR() {
        return 0;
    }

    default int handleCellLevel() {
        return 0;
    }

    default String handleDirection() {
        return "";
    }

    default int startCellQ() {
        return 0;
    }

    default int startCellR() {
        return 0;
    }

    default int startCellLevel() {
        return 0;
    }

    default int endCellQ() {
        return 0;
    }

    default int endCellR() {
        return 0;
    }

    default int endCellLevel() {
        return 0;
    }

    default int edgeCount() {
        return 0;
    }

    default int edgeFromQ(int index) {
        return 0;
    }

    default int edgeFromR(int index) {
        return 0;
    }

    default int edgeFromLevel(int index) {
        return 0;
    }

    default int edgeToQ(int index) {
        return 0;
    }

    default int edgeToR(int index) {
        return 0;
    }

    default int edgeToLevel(int index) {
        return 0;
    }

    default String endpointKindName(boolean start) {
        return "DOOR";
    }

    default long endpointHostCorridorId(boolean start) {
        return 0L;
    }

    default long endpointRoomId(boolean start) {
        return 0L;
    }

    default long endpointClusterId(boolean start) {
        return 0L;
    }

    default int endpointCellQ(boolean start) {
        return 0;
    }

    default int endpointCellR(boolean start) {
        return 0;
    }

    default int endpointCellLevel(boolean start) {
        return 0;
    }

    default String endpointDirection(boolean start) {
        return "";
    }

    default String endpointTopologyKindName(boolean start) {
        return "EMPTY";
    }

    default long endpointTopologyId(boolean start) {
        return 0L;
    }

    default long roomEndpointRoomId() {
        return 0L;
    }

    default long roomEndpointClusterId() {
        return 0L;
    }

    default boolean roomEndpointFixedDoor() {
        return false;
    }

    default int roomEndpointCellQ() {
        return 0;
    }

    default int roomEndpointCellR() {
        return 0;
    }

    default int roomEndpointCellLevel() {
        return 0;
    }

    default String roomEndpointDirection() {
        return "";
    }

    default String roomEndpointTopologyKindName() {
        return "EMPTY";
    }

    default long roomEndpointTopologyId() {
        return 0L;
    }

    default int exitCount() {
        return 0;
    }

    default int exitCellQ(int index) {
        return 0;
    }

    default int exitCellR(int index) {
        return 0;
    }

    default int exitCellLevel(int index) {
        return 0;
    }

    default String exitDirection(int index) {
        return "";
    }

    default String exitDescription(int index) {
        return "";
    }

    record Operation(
            Action action,
            DungeonMapId mapId,
            @Nullable DungeonEditorOperation operation
    ) implements DungeonAuthoredMutationCommand {

        public Operation {
            action = action == null ? Action.APPLY : action;
            mapId = mapId == null ? new DungeonMapId(1L) : mapId;
        }

        @Override
        public String actionName() {
            return action.name();
        }

        @Override
        public long mapIdValue() {
            return mapId.value();
        }

        @Override
        public String operationKindName() {
            return switch (operation) {
                case null -> "NOOP";
                case DungeonEditorOperation.MoveTopologyElement ignored -> "MOVE_TOPOLOGY_ELEMENT";
                case DungeonEditorOperation.MoveEditorHandle ignored -> "MOVE_EDITOR_HANDLE";
                case DungeonEditorOperation.MoveBoundaryStretch ignored -> "MOVE_BOUNDARY_STRETCH";
                case DungeonEditorOperation.MoveRoomAnchor ignored -> "MOVE_ROOM_ANCHOR";
                case DungeonEditorOperation.RoomRectangle ignored -> "ROOM_RECTANGLE";
                case DungeonEditorOperation.EditClusterBoundaries ignored -> "EDIT_CLUSTER_BOUNDARIES";
                case DungeonEditorOperation.CreateCorridor ignored -> "CREATE_CORRIDOR";
                case DungeonEditorOperation.ExtendCorridor ignored -> "EXTEND_CORRIDOR";
                case DungeonEditorOperation.MergeCorridors ignored -> "MERGE_CORRIDORS";
                case DungeonEditorOperation.DeleteCorridor ignored -> "DELETE_CORRIDOR";
                case DungeonEditorOperation.SaveRoomNarration ignored -> "SAVE_ROOM_NARRATION";
            };
        }

        @Override
        public int deltaQ() {
            return switch (operation) {
                case DungeonEditorOperation.MoveTopologyElement move -> move.deltaQ();
                case DungeonEditorOperation.MoveEditorHandle move -> move.deltaQ();
                case DungeonEditorOperation.MoveBoundaryStretch move -> move.deltaQ();
                case DungeonEditorOperation.MoveRoomAnchor move -> move.deltaQ();
                case null, default -> 0;
            };
        }

        @Override
        public int deltaR() {
            return switch (operation) {
                case DungeonEditorOperation.MoveTopologyElement move -> move.deltaR();
                case DungeonEditorOperation.MoveEditorHandle move -> move.deltaR();
                case DungeonEditorOperation.MoveBoundaryStretch move -> move.deltaR();
                case DungeonEditorOperation.MoveRoomAnchor move -> move.deltaR();
                case null, default -> 0;
            };
        }

        @Override
        public int deltaLevel() {
            return switch (operation) {
                case DungeonEditorOperation.MoveTopologyElement move -> move.deltaLevel();
                case DungeonEditorOperation.MoveEditorHandle move -> move.deltaLevel();
                case DungeonEditorOperation.MoveBoundaryStretch move -> move.deltaLevel();
                case null, default -> 0;
            };
        }

        @Override
        public long clusterId() {
            return switch (operation) {
                case DungeonEditorOperation.MoveBoundaryStretch move -> move.clusterId();
                case DungeonEditorOperation.EditClusterBoundaries edit -> edit.clusterId();
                case null, default -> 0L;
            };
        }

        @Override
        public long corridorId() {
            return switch (operation) {
                case DungeonEditorOperation.ExtendCorridor extend -> extend.corridorId();
                case DungeonEditorOperation.MergeCorridors merge -> merge.corridorId();
                case DungeonEditorOperation.DeleteCorridor delete -> delete.corridorId();
                case null, default -> 0L;
            };
        }

        @Override
        public long mergedCorridorId() {
            return operation instanceof DungeonEditorOperation.MergeCorridors merge ? merge.mergedCorridorId() : 0L;
        }

        @Override
        public long roomId() {
            return operation instanceof DungeonEditorOperation.SaveRoomNarration save ? save.roomId() : 0L;
        }

        @Override
        public String visualDescription() {
            return operation instanceof DungeonEditorOperation.SaveRoomNarration save ? save.visualDescription() : "";
        }

        @Override
        public String rectangleActionName() {
            return operation instanceof DungeonEditorOperation.RoomRectangle rectangle
                    ? rectangle.action().name()
                    : "PAINT";
        }

        @Override
        public String boundaryKindName() {
            return operation instanceof DungeonEditorOperation.EditClusterBoundaries edit
                    ? edit.kind().name()
                    : "WALL";
        }

        @Override
        public boolean deleteBoundary() {
            return operation instanceof DungeonEditorOperation.EditClusterBoundaries edit && edit.deleteBoundary();
        }

        @Override
        public String topologyKindName() {
            return operation instanceof DungeonEditorOperation.MoveTopologyElement move
                    ? move.ref().kind().name()
                    : "EMPTY";
        }

        @Override
        public long topologyId() {
            return operation instanceof DungeonEditorOperation.MoveTopologyElement move ? move.ref().id() : 0L;
        }

        @Override
        public String handleKindName() {
            return operation instanceof DungeonEditorOperation.MoveEditorHandle move ? move.ref().kind().name() : "";
        }

        @Override
        public String handleTopologyKindName() {
            return operation instanceof DungeonEditorOperation.MoveEditorHandle move
                    ? move.ref().topologyRef().kind().name()
                    : "EMPTY";
        }

        @Override
        public long handleTopologyId() {
            return operation instanceof DungeonEditorOperation.MoveEditorHandle move
                    ? move.ref().topologyRef().id()
                    : 0L;
        }

        @Override
        public long handleOwnerId() {
            return operation instanceof DungeonEditorOperation.MoveEditorHandle move ? move.ref().ownerId() : 0L;
        }

        @Override
        public long handleClusterId() {
            return operation instanceof DungeonEditorOperation.MoveEditorHandle move ? move.ref().clusterId() : 0L;
        }

        @Override
        public long handleCorridorId() {
            return operation instanceof DungeonEditorOperation.MoveEditorHandle move ? move.ref().corridorId() : 0L;
        }

        @Override
        public long handleRoomId() {
            return operation instanceof DungeonEditorOperation.MoveEditorHandle move ? move.ref().roomId() : 0L;
        }

        @Override
        public int handleIndex() {
            return operation instanceof DungeonEditorOperation.MoveEditorHandle move ? move.ref().index() : 0;
        }

        @Override
        public int handleCellQ() {
            return operation instanceof DungeonEditorOperation.MoveEditorHandle move ? move.ref().cell().q() : 0;
        }

        @Override
        public int handleCellR() {
            return operation instanceof DungeonEditorOperation.MoveEditorHandle move ? move.ref().cell().r() : 0;
        }

        @Override
        public int handleCellLevel() {
            return operation instanceof DungeonEditorOperation.MoveEditorHandle move ? move.ref().cell().level() : 0;
        }

        @Override
        public String handleDirection() {
            return operation instanceof DungeonEditorOperation.MoveEditorHandle move ? move.ref().direction() : "";
        }

        @Override
        public int startCellQ() {
            return operation instanceof DungeonEditorOperation.RoomRectangle rectangle ? rectangle.start().q() : 0;
        }

        @Override
        public int startCellR() {
            return operation instanceof DungeonEditorOperation.RoomRectangle rectangle ? rectangle.start().r() : 0;
        }

        @Override
        public int startCellLevel() {
            return operation instanceof DungeonEditorOperation.RoomRectangle rectangle ? rectangle.start().level() : 0;
        }

        @Override
        public int endCellQ() {
            return operation instanceof DungeonEditorOperation.RoomRectangle rectangle ? rectangle.end().q() : 0;
        }

        @Override
        public int endCellR() {
            return operation instanceof DungeonEditorOperation.RoomRectangle rectangle ? rectangle.end().r() : 0;
        }

        @Override
        public int endCellLevel() {
            return operation instanceof DungeonEditorOperation.RoomRectangle rectangle ? rectangle.end().level() : 0;
        }

        @Override
        public int edgeCount() {
            return edges().size();
        }

        @Override
        public int edgeFromQ(int index) {
            return edge(index).from().q();
        }

        @Override
        public int edgeFromR(int index) {
            return edge(index).from().r();
        }

        @Override
        public int edgeFromLevel(int index) {
            return edge(index).from().level();
        }

        @Override
        public int edgeToQ(int index) {
            return edge(index).to().q();
        }

        @Override
        public int edgeToR(int index) {
            return edge(index).to().r();
        }

        @Override
        public int edgeToLevel(int index) {
            return edge(index).to().level();
        }

        @Override
        public String endpointKindName(boolean start) {
            return endpoint(start) instanceof DungeonEditorOperation.CorridorAnchorEndpoint ? "ANCHOR" : "DOOR";
        }

        @Override
        public long endpointHostCorridorId(boolean start) {
            return endpoint(start) instanceof DungeonEditorOperation.CorridorAnchorEndpoint anchor
                    ? anchor.hostCorridorId()
                    : 0L;
        }

        @Override
        public long endpointRoomId(boolean start) {
            return endpoint(start) instanceof DungeonEditorOperation.CorridorDoorEndpoint door ? door.roomId() : 0L;
        }

        @Override
        public long endpointClusterId(boolean start) {
            return endpoint(start) instanceof DungeonEditorOperation.CorridorDoorEndpoint door ? door.clusterId() : 0L;
        }

        @Override
        public int endpointCellQ(boolean start) {
            return endpointCell(start).q();
        }

        @Override
        public int endpointCellR(boolean start) {
            return endpointCell(start).r();
        }

        @Override
        public int endpointCellLevel(boolean start) {
            return endpointCell(start).level();
        }

        @Override
        public String endpointDirection(boolean start) {
            return endpoint(start) instanceof DungeonEditorOperation.CorridorDoorEndpoint door ? door.direction() : "";
        }

        @Override
        public String endpointTopologyKindName(boolean start) {
            return endpointTopologyRef(start).kind().name();
        }

        @Override
        public long endpointTopologyId(boolean start) {
            return endpointTopologyRef(start).id();
        }

        @Override
        public long roomEndpointRoomId() {
            return operation instanceof DungeonEditorOperation.ExtendCorridor extend
                    ? extend.endpoint().roomId()
                    : 0L;
        }

        @Override
        public long roomEndpointClusterId() {
            return operation instanceof DungeonEditorOperation.ExtendCorridor extend
                    ? extend.endpoint().clusterId()
                    : 0L;
        }

        @Override
        public boolean roomEndpointFixedDoor() {
            return operation instanceof DungeonEditorOperation.ExtendCorridor extend && extend.endpoint().fixedDoor();
        }

        @Override
        public int roomEndpointCellQ() {
            return operation instanceof DungeonEditorOperation.ExtendCorridor extend
                    ? extend.endpoint().roomCell().q()
                    : 0;
        }

        @Override
        public int roomEndpointCellR() {
            return operation instanceof DungeonEditorOperation.ExtendCorridor extend
                    ? extend.endpoint().roomCell().r()
                    : 0;
        }

        @Override
        public int roomEndpointCellLevel() {
            return operation instanceof DungeonEditorOperation.ExtendCorridor extend
                    ? extend.endpoint().roomCell().level()
                    : 0;
        }

        @Override
        public String roomEndpointDirection() {
            return operation instanceof DungeonEditorOperation.ExtendCorridor extend
                    ? extend.endpoint().direction()
                    : "";
        }

        @Override
        public String roomEndpointTopologyKindName() {
            return operation instanceof DungeonEditorOperation.ExtendCorridor extend
                    ? extend.endpoint().topologyRef().kind().name()
                    : "EMPTY";
        }

        @Override
        public long roomEndpointTopologyId() {
            return operation instanceof DungeonEditorOperation.ExtendCorridor extend
                    ? extend.endpoint().topologyRef().id()
                    : 0L;
        }

        @Override
        public int exitCount() {
            return exits().size();
        }

        @Override
        public int exitCellQ(int index) {
            return exit(index).cell().q();
        }

        @Override
        public int exitCellR(int index) {
            return exit(index).cell().r();
        }

        @Override
        public int exitCellLevel(int index) {
            return exit(index).cell().level();
        }

        @Override
        public String exitDirection(int index) {
            return exit(index).direction();
        }

        @Override
        public String exitDescription(int index) {
            return exit(index).description();
        }

        private List<DungeonEdgeRef> edges() {
            return switch (operation) {
                case DungeonEditorOperation.MoveBoundaryStretch move -> move.sourceEdges();
                case DungeonEditorOperation.EditClusterBoundaries edit -> edit.edges();
                case null, default -> List.of();
            };
        }

        private DungeonEdgeRef edge(int index) {
            List<DungeonEdgeRef> edges = edges();
            return index >= 0 && index < edges.size()
                    ? edges.get(index)
                    : new DungeonEdgeRef(emptyCell(), emptyCell());
        }

        private DungeonEditorOperation.CorridorEndpoint endpoint(boolean start) {
            if (operation instanceof DungeonEditorOperation.CreateCorridor create) {
                return start ? create.start() : create.end();
            }
            return new DungeonEditorOperation.CorridorDoorEndpoint(
                    0L,
                    0L,
                    emptyCell(),
                    "",
                    DungeonTopologyElementRef.empty());
        }

        private DungeonCellRef endpointCell(boolean start) {
            return switch (endpoint(start)) {
                case DungeonEditorOperation.CorridorAnchorEndpoint anchor -> anchor.anchorCell();
                case DungeonEditorOperation.CorridorDoorEndpoint door -> door.roomCell();
            };
        }

        private DungeonTopologyElementRef endpointTopologyRef(boolean start) {
            return switch (endpoint(start)) {
                case DungeonEditorOperation.CorridorAnchorEndpoint anchor -> anchor.topologyRef();
                case DungeonEditorOperation.CorridorDoorEndpoint door -> door.topologyRef();
            };
        }

        private List<DungeonInspectorSnapshot.RoomExitNarration> exits() {
            return operation instanceof DungeonEditorOperation.SaveRoomNarration save ? save.exits() : List.of();
        }

        private DungeonInspectorSnapshot.RoomExitNarration exit(int index) {
            List<DungeonInspectorSnapshot.RoomExitNarration> exits = exits();
            return index >= 0 && index < exits.size()
                    ? exits.get(index)
                    : new DungeonInspectorSnapshot.RoomExitNarration("", emptyCell(), "", "");
        }

        private static DungeonCellRef emptyCell() {
            return new DungeonCellRef(0, 0, 0);
        }
    }

    enum Action {
        PREVIEW,
        APPLY;

        public boolean isPreview() {
            return this == PREVIEW;
        }
    }
}
