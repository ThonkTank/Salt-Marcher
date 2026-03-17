package features.world.dungeonmap.domain.model;

import java.util.ArrayList;
import java.util.List;

public final class DungeonCorridorDoorReassignment {

    private DungeonCorridorDoorReassignment() {
        throw new AssertionError("No instances");
    }

    public static DoorMoveUpdate reassignDoor(
            DungeonCorridor corridor,
            long sourceRoomId,
            DungeonRoom targetRoom,
            DungeonRoomCluster targetCluster,
            Point2i targetCell,
            DungeonRoomCluster.EdgeDirection direction
    ) {
        if (corridor == null || targetRoom == null || targetCluster == null || targetCell == null || direction == null) {
            throw new IllegalArgumentException("Tür-Reassign braucht Korridor, Zielraum, Zielcluster, Zielzelle und Richtung");
        }
        long targetRoomId = targetRoom.roomId();
        if (sourceRoomId != targetRoomId && corridor.roomIds().contains(targetRoomId)) {
            // A corridor keeps one door binding per room. Reassigning onto an already bound room would
            // collapse the room list and silently drop the old endpoint instead of moving the door.
            throw new IllegalArgumentException("Zielraum ist bereits mit diesem Korridor verbunden");
        }
        CorridorDoorOverride override = new CorridorDoorOverride(
                targetRoomId,
                targetCluster.clusterId(),
                targetCell.subtract(targetCluster.center()),
                direction);
        List<Long> roomIds = corridor.roomIds().stream()
                .map(existingRoomId -> existingRoomId == sourceRoomId ? targetRoomId : existingRoomId)
                .distinct()
                .toList();
        List<CorridorDoorOverride> overrides = new ArrayList<>(corridor.doorOverrides().stream()
                .filter(existing -> existing.roomId() != sourceRoomId && existing.roomId() != targetRoomId)
                .toList());
        overrides.add(override);
        return new DoorMoveUpdate(roomIds, List.copyOf(overrides));
    }

    public record DoorMoveUpdate(
            List<Long> roomIds,
            List<CorridorDoorOverride> doorOverrides
    ) {
    }
}
