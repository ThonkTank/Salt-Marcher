package features.world.dungeon.dungeonmap.api;

import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.model.interaction.DungeonSelectionRef;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.Door;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.DoorRef;
import features.world.dungeon.model.structures.connection.ConnectionEndpoint;
import features.world.dungeon.model.structures.room.Room;

import java.util.List;
import java.util.Objects;

public record DoorDescription(
        DoorRef ref,
        Door door,
        int levelZ,
        DoorRole role,
        Long clusterId,
        Long corridorId,
        List<Room> touchingRooms
) {
    public DoorDescription {
        ref = Objects.requireNonNull(ref, "ref");
        door = Objects.requireNonNull(door, "door");
        role = Objects.requireNonNull(role, "role");
        touchingRooms = touchingRooms == null ? List.of() : List.copyOf(touchingRooms);
    }

    public GridSegment anchorSegment() {
        return door.anchorSegment();
    }

    public Long roomId() {
        if (role != DoorRole.ROOM_EXTERIOR || touchingRooms.isEmpty()) {
            return null;
        }
        Room room = touchingRooms.getFirst();
        return room == null ? null : room.roomId();
    }

    public boolean isRoomLocal() {
        return role == DoorRole.ROOM_LOCAL;
    }

    public boolean isRoomExterior() {
        return role == DoorRole.ROOM_EXTERIOR;
    }

    public boolean isCorridorBoundary() {
        return role == DoorRole.CORRIDOR_BOUNDARY;
    }

    public boolean supportsTransitionPlacement() {
        return connectionEndpoint() != null;
    }

    public ConnectionEndpoint connectionEndpoint() {
        if (isRoomExterior()) {
            Long roomId = roomId();
            return roomId == null ? null : ConnectionEndpoint.room(roomId);
        }
        if (isCorridorBoundary()) {
            return corridorId == null ? null : ConnectionEndpoint.corridor(corridorId);
        }
        return null;
    }

    public DungeonSelectionRef ownerRef() {
        return switch (role) {
            case ROOM_LOCAL -> clusterId == null ? null : new DungeonSelectionRef.ClusterRef(clusterId);
            case ROOM_EXTERIOR -> {
                Long roomId = roomId();
                if (roomId != null) {
                    yield new DungeonSelectionRef.RoomRef(roomId);
                }
                yield clusterId == null ? null : new DungeonSelectionRef.ClusterRef(clusterId);
            }
            case CORRIDOR_BOUNDARY -> corridorId == null ? null : new DungeonSelectionRef.CorridorRef(corridorId);
        };
    }
}
