package features.world.dungeonmap.service.runtime;

import features.world.dungeonmap.model.projection.DungeonMapState;
import features.world.dungeonmap.model.projection.DungeonMapConnectionPath;
import features.world.dungeonmap.model.domain.DungeonSquare;

final class DungeonRuntimeTraversalService {

    boolean sameRoom(DungeonSquare currentSquare, DungeonSquare targetSquare) {
        return currentSquare != null
                && targetSquare != null
                && currentSquare.roomId() != null
                && currentSquare.roomId().equals(targetSquare.roomId());
    }

    boolean canMoveBetweenRooms(DungeonMapState state, DungeonSquare currentSquare, DungeonSquare targetSquare) {
        if (state == null || currentSquare == null || targetSquare == null) {
            return false;
        }
        if (sameRoom(currentSquare, targetSquare)) {
            return true;
        }
        if (currentSquare.roomId() == null || targetSquare.roomId() == null) {
            return false;
        }
        for (DungeonMapConnectionPath connectionPath : state.roomConnections()) {
            if (connectsRooms(connectionPath, currentSquare.roomId(), targetSquare.roomId())) {
                return true;
            }
        }
        return false;
    }

    private boolean connectsRooms(DungeonMapConnectionPath connectionPath, Long currentRoomId, Long targetRoomId) {
        if (connectionPath == null || currentRoomId == null || targetRoomId == null) {
            return false;
        }
        return currentRoomId.equals(connectionPath.fromRoomId()) && targetRoomId.equals(connectionPath.toRoomId())
                || currentRoomId.equals(connectionPath.toRoomId()) && targetRoomId.equals(connectionPath.fromRoomId());
    }
}
