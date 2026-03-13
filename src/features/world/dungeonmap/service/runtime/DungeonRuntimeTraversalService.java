package features.world.dungeonmap.service.runtime;

import features.world.dungeonmap.model.projection.edge.DungeonEdgeSummary;
import features.world.dungeonmap.model.projection.DungeonMapState;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.model.domain.PassageDirection;

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

        for (DungeonSquare roomSquare : state.index().squaresForRoom(currentSquare.roomId())) {
            if (touchesRoomThroughPassableEdge(state, roomSquare, targetSquare.roomId())) {
                return true;
            }
        }
        return false;
    }

    private boolean touchesRoomThroughPassableEdge(DungeonMapState state, DungeonSquare sourceSquare, Long targetRoomId) {
        return isPassableToRoom(state, sourceSquare, sourceSquare.x() + 1, sourceSquare.y(), PassageDirection.EAST, targetRoomId)
                || isPassableToRoom(state, sourceSquare, sourceSquare.x() - 1, sourceSquare.y(), PassageDirection.EAST, targetRoomId)
                || isPassableToRoom(state, sourceSquare, sourceSquare.x(), sourceSquare.y() + 1, PassageDirection.SOUTH, targetRoomId)
                || isPassableToRoom(state, sourceSquare, sourceSquare.x(), sourceSquare.y() - 1, PassageDirection.SOUTH, targetRoomId);
    }

    private boolean isPassableToRoom(
            DungeonMapState state,
            DungeonSquare sourceSquare,
            int neighborX,
            int neighborY,
            PassageDirection direction,
            Long targetRoomId
    ) {
        DungeonSquare neighbor = state.index().squareAt(neighborX, neighborY);
        if (neighbor == null || targetRoomId == null || !targetRoomId.equals(neighbor.roomId())) {
            return false;
        }
        DungeonEdgeSummary edge = direction == PassageDirection.EAST
                ? state.edgeAt(direction.edgeKey(Math.min(sourceSquare.x(), neighborX), sourceSquare.y()))
                : state.edgeAt(direction.edgeKey(sourceSquare.x(), Math.min(sourceSquare.y(), neighborY)));
        if (edge == null || edge.sideASquare() == null || edge.sideBSquare() == null) {
            return false;
        }
        return edge.passage() != null || !edge.wallPresent();
    }
}
