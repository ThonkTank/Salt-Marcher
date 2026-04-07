package features.world.dungeon.dungoenmap.corridor.model;

import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.dungoenmap.structure.model.boundary.door.DoorRef;

/**
 * Canonical public corridor mutation vocabulary.
 */
public sealed interface CorridorMutation permits
        CorridorMutation.NodeMove,
        CorridorMutation.TileNodePromotionAndMove,
        CorridorMutation.AttachRoomDoorAtBoundary,
        CorridorMutation.DoorMove,
        CorridorMutation.DeleteDoor,
        CorridorMutation.DeleteSegment,
        CorridorMutation.DeleteNode {

    record NodeMove(Long nodeId, GridPoint point) implements CorridorMutation {
    }

    record TileNodePromotionAndMove(GridPoint tileCell, GridPoint targetPoint) implements CorridorMutation {
    }

    record AttachRoomDoorAtBoundary(DoorRef doorRef, GridSegment boundarySegment) implements CorridorMutation {
    }

    record DoorMove(GridSegment sourceBoundarySegment, DoorRef targetDoorRef) implements CorridorMutation {
    }

    record DeleteDoor(GridSegment boundarySegment) implements CorridorMutation {
    }

    record DeleteSegment(Long segmentId) implements CorridorMutation {
    }

    record DeleteNode(Long nodeId) implements CorridorMutation {
    }
}
