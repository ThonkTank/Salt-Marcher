package src.domain.dungeon.published;

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
        return "";
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
            return operation == null ? "" : operation.operationKindName();
        }

        @Override
        public int deltaQ() {
            return operation == null ? 0 : operation.deltaQ();
        }

        @Override
        public int deltaR() {
            return operation == null ? 0 : operation.deltaR();
        }

        @Override
        public int deltaLevel() {
            return operation == null ? 0 : operation.deltaLevel();
        }

        @Override
        public long clusterId() {
            return operation == null ? 0L : operation.clusterId();
        }

        @Override
        public long corridorId() {
            return operation == null ? 0L : operation.corridorId();
        }

        @Override
        public long mergedCorridorId() {
            return operation == null ? 0L : operation.mergedCorridorId();
        }

        @Override
        public long roomId() {
            return operation == null ? 0L : operation.roomId();
        }

        @Override
        public String visualDescription() {
            return operation == null ? "" : operation.visualDescription();
        }

        @Override
        public String rectangleActionName() {
            return operation == null ? "PAINT" : operation.rectangleActionName();
        }

        @Override
        public String boundaryKindName() {
            return operation == null ? "WALL" : operation.boundaryKindName();
        }

        @Override
        public boolean deleteBoundary() {
            return operation != null && operation.deleteBoundary();
        }

        @Override
        public String topologyKindName() {
            return operation == null ? "EMPTY" : operation.topologyKindName();
        }

        @Override
        public long topologyId() {
            return operation == null ? 0L : operation.topologyId();
        }

        @Override
        public String handleKindName() {
            return operation == null ? "" : operation.handleKindName();
        }

        @Override
        public String handleTopologyKindName() {
            return operation == null ? "EMPTY" : operation.handleTopologyKindName();
        }

        @Override
        public long handleTopologyId() {
            return operation == null ? 0L : operation.handleTopologyId();
        }

        @Override
        public long handleOwnerId() {
            return operation == null ? 0L : operation.handleOwnerId();
        }

        @Override
        public long handleClusterId() {
            return operation == null ? 0L : operation.handleClusterId();
        }

        @Override
        public long handleCorridorId() {
            return operation == null ? 0L : operation.handleCorridorId();
        }

        @Override
        public long handleRoomId() {
            return operation == null ? 0L : operation.handleRoomId();
        }

        @Override
        public int handleIndex() {
            return operation == null ? 0 : operation.handleIndex();
        }

        @Override
        public int handleCellQ() {
            return operation == null ? 0 : operation.handleCellQ();
        }

        @Override
        public int handleCellR() {
            return operation == null ? 0 : operation.handleCellR();
        }

        @Override
        public int handleCellLevel() {
            return operation == null ? 0 : operation.handleCellLevel();
        }

        @Override
        public String handleDirection() {
            return operation == null ? "" : operation.handleDirection();
        }

        @Override
        public int startCellQ() {
            return operation == null ? 0 : operation.startCellQ();
        }

        @Override
        public int startCellR() {
            return operation == null ? 0 : operation.startCellR();
        }

        @Override
        public int startCellLevel() {
            return operation == null ? 0 : operation.startCellLevel();
        }

        @Override
        public int endCellQ() {
            return operation == null ? 0 : operation.endCellQ();
        }

        @Override
        public int endCellR() {
            return operation == null ? 0 : operation.endCellR();
        }

        @Override
        public int endCellLevel() {
            return operation == null ? 0 : operation.endCellLevel();
        }

        @Override
        public int edgeCount() {
            return operation == null ? 0 : operation.edgeCount();
        }

        @Override
        public int edgeFromQ(int index) {
            return operation == null ? 0 : operation.edgeFromQ(index);
        }

        @Override
        public int edgeFromR(int index) {
            return operation == null ? 0 : operation.edgeFromR(index);
        }

        @Override
        public int edgeFromLevel(int index) {
            return operation == null ? 0 : operation.edgeFromLevel(index);
        }

        @Override
        public int edgeToQ(int index) {
            return operation == null ? 0 : operation.edgeToQ(index);
        }

        @Override
        public int edgeToR(int index) {
            return operation == null ? 0 : operation.edgeToR(index);
        }

        @Override
        public int edgeToLevel(int index) {
            return operation == null ? 0 : operation.edgeToLevel(index);
        }

        @Override
        public String endpointKindName(boolean start) {
            return operation == null ? "DOOR" : operation.endpointKindName(start);
        }

        @Override
        public long endpointHostCorridorId(boolean start) {
            return operation == null ? 0L : operation.endpointHostCorridorId(start);
        }

        @Override
        public long endpointRoomId(boolean start) {
            return operation == null ? 0L : operation.endpointRoomId(start);
        }

        @Override
        public long endpointClusterId(boolean start) {
            return operation == null ? 0L : operation.endpointClusterId(start);
        }

        @Override
        public int endpointCellQ(boolean start) {
            return operation == null ? 0 : operation.endpointCellQ(start);
        }

        @Override
        public int endpointCellR(boolean start) {
            return operation == null ? 0 : operation.endpointCellR(start);
        }

        @Override
        public int endpointCellLevel(boolean start) {
            return operation == null ? 0 : operation.endpointCellLevel(start);
        }

        @Override
        public String endpointDirection(boolean start) {
            return operation == null ? "" : operation.endpointDirection(start);
        }

        @Override
        public String endpointTopologyKindName(boolean start) {
            return operation == null ? "EMPTY" : operation.endpointTopologyKindName(start);
        }

        @Override
        public long endpointTopologyId(boolean start) {
            return operation == null ? 0L : operation.endpointTopologyId(start);
        }

        @Override
        public long roomEndpointRoomId() {
            return operation == null ? 0L : operation.roomEndpointRoomId();
        }

        @Override
        public long roomEndpointClusterId() {
            return operation == null ? 0L : operation.roomEndpointClusterId();
        }

        @Override
        public boolean roomEndpointFixedDoor() {
            return operation != null && operation.roomEndpointFixedDoor();
        }

        @Override
        public int roomEndpointCellQ() {
            return operation == null ? 0 : operation.roomEndpointCellQ();
        }

        @Override
        public int roomEndpointCellR() {
            return operation == null ? 0 : operation.roomEndpointCellR();
        }

        @Override
        public int roomEndpointCellLevel() {
            return operation == null ? 0 : operation.roomEndpointCellLevel();
        }

        @Override
        public String roomEndpointDirection() {
            return operation == null ? "" : operation.roomEndpointDirection();
        }

        @Override
        public String roomEndpointTopologyKindName() {
            return operation == null ? "EMPTY" : operation.roomEndpointTopologyKindName();
        }

        @Override
        public long roomEndpointTopologyId() {
            return operation == null ? 0L : operation.roomEndpointTopologyId();
        }

        @Override
        public int exitCount() {
            return operation == null ? 0 : operation.exitCount();
        }

        @Override
        public int exitCellQ(int index) {
            return operation == null ? 0 : operation.exitCellQ(index);
        }

        @Override
        public int exitCellR(int index) {
            return operation == null ? 0 : operation.exitCellR(index);
        }

        @Override
        public int exitCellLevel(int index) {
            return operation == null ? 0 : operation.exitCellLevel(index);
        }

        @Override
        public String exitDirection(int index) {
            return operation == null ? "" : operation.exitDirection(index);
        }

        @Override
        public String exitDescription(int index) {
            return operation == null ? "" : operation.exitDescription(index);
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
