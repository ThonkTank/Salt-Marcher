package src.domain.dungeon.application;

import src.domain.dungeon.model.map.model.DungeonCorridorEndpoint;
import src.domain.dungeon.model.map.model.DungeonCorridorRoomEndpoint;
import src.domain.dungeon.model.map.model.DungeonEdgeDirection;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;
import src.domain.dungeon.published.DungeonEditorOperation;

final class DungeonEditorOperationCorridorEndpointUseCase {

    private DungeonEditorOperationCorridorEndpointUseCase() {
    }

    static DungeonCorridorEndpoint endpoint(DungeonEditorOperation.CorridorEndpoint endpoint) {
        return switch (endpoint) {
            case DungeonEditorOperation.CorridorDoorEndpoint door -> DungeonCorridorEndpoint.door(
                    door.roomId(),
                    door.clusterId(),
                    DungeonEditorOperationRefsUseCase.cell(door.roomCell()),
                    DungeonEditorOperationDirectionUseCase.direction(door.direction()),
                    DungeonEditorOperationRefsUseCase.topologyRef(door.topologyRef()));
            case DungeonEditorOperation.CorridorAnchorEndpoint anchor -> DungeonCorridorEndpoint.anchor(
                    anchor.hostCorridorId(),
                    DungeonEditorOperationRefsUseCase.cell(anchor.anchorCell()),
                    DungeonEditorOperationRefsUseCase.topologyRef(anchor.topologyRef()));
            case null -> DungeonCorridorEndpoint.door(
                    0L,
                    0L,
                    DungeonEditorOperationRefsUseCase.originCell(),
                    DungeonEdgeDirection.NORTH,
                    DungeonTopologyRef.empty());
        };
    }

    static DungeonCorridorRoomEndpoint roomEndpoint(DungeonEditorOperation.CorridorRoomEndpoint endpoint) {
        if (endpoint == null) {
            return new DungeonCorridorRoomEndpoint(
                    0L,
                    0L,
                    false,
                    DungeonEditorOperationRefsUseCase.originCell(),
                    DungeonEdgeDirection.NORTH,
                    DungeonTopologyRef.empty());
        }
        return new DungeonCorridorRoomEndpoint(
                endpoint.roomId(),
                endpoint.clusterId(),
                endpoint.fixedDoor(),
                DungeonEditorOperationRefsUseCase.cell(endpoint.roomCell()),
                DungeonEditorOperationDirectionUseCase.direction(endpoint.direction()),
                DungeonEditorOperationRefsUseCase.topologyRef(endpoint.topologyRef()));
    }
}
