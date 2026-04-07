package features.world.dungeonmap.application.runtime.description;

import features.world.dungeonmap.application.runtime.DungeonRuntimeLocation;
import features.world.dungeonmap.map.model.DungeonLayout;
import features.world.dungeonmap.geometry.CardinalDirection;
import features.world.dungeonmap.structure.model.Structure;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpointType;
import features.world.dungeonmap.model.structures.connection.DoorExitDescriptor;
import features.world.dungeonmap.cluster.model.RoomCluster;
import features.world.dungeonmap.corridor.model.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;

final class DungeonRuntimeExitFactory {

    private DungeonRuntimeExitFactory() {
        throw new AssertionError("No instances");
    }

    static DungeonRuntimeExit roomExit(
            DungeonRuntimeLocation location,
            DoorExitDescriptor exit
    ) {
        Room room = location == null ? null : location.room();
        String narration = room == null || room.roomId() == null || exit == null
                ? ""
                : room.narration().exitDescription(exit.levelZ(), exit.localCell(), exit.direction());
        return create(
                location,
                exit,
                room == null || room.roomId() == null ? null : ConnectionEndpoint.room(room.roomId()),
                narration);
    }

    static DungeonRuntimeExit corridorExit(
            DungeonRuntimeLocation location,
            DoorExitDescriptor exit
    ) {
        Corridor corridor = location == null ? null : location.corridor();
        return create(
                location,
                exit,
                corridor == null || corridor.corridorId() == null ? null : ConnectionEndpoint.corridor(corridor.corridorId()),
                "");
    }

    private static DungeonRuntimeExit create(
            DungeonRuntimeLocation location,
            DoorExitDescriptor exit,
            ConnectionEndpoint activeEndpoint,
            String narration
    ) {
        if (exit == null) {
            return null;
        }
        DungeonLayout layout = location == null ? null : location.layout();
        var connection = layout == null ? null : layout.connectionForDoor(exit.doorRef());
        ConnectionEndpoint destinationEndpoint = connection == null ? null : connection.oppositeOf(activeEndpoint);
        String destinationLabel = doorDestinationLabel(layout, destinationEndpoint, activeEndpoint);
        return new DungeonRuntimeExit(
                exit.label(),
                exit.number(),
                exit.doorRef(),
                destinationLabel,
                doorDescription(location == null ? null : location.heading(), exit.direction(), narration));
    }

    private static String doorDescription(
            CardinalDirection heading,
            CardinalDirection doorDirection,
            String narration
    ) {
        CardinalDirection resolvedHeading = heading == null ? CardinalDirection.defaultDirection() : heading;
        String relativeLabel = resolvedHeading.relativeLabel(doorDirection);
        String resolvedNarration = narration == null || narration.isBlank() ? "eine Tür" : narration.trim();
        return relativeLabel + " ist " + resolvedNarration;
    }

    private static String doorDestinationLabel(
            DungeonLayout layout,
            ConnectionEndpoint destination,
            ConnectionEndpoint activeEndpoint
    ) {
        if (layout == null || destination == null) {
            return "";
        }
        if (destination.type() == ConnectionEndpointType.ROOM && destination.id() != null) {
            return roomLabel(layout, destination.id());
        }
        if (destination.type() == ConnectionEndpointType.CORRIDOR && destination.id() != null) {
            Corridor corridor = layout.findCorridor(destination.id());
            if (corridor == null) {
                return "";
            }
            return corridor.connectedRoomIds().stream()
                    .filter(roomId -> roomId != null && (activeEndpoint == null || !roomId.equals(activeEndpoint.id())))
                    .map(roomId -> roomLabel(layout, roomId))
                    .filter(label -> label != null && !label.isBlank())
                    .distinct()
                    .reduce((left, right) -> left + ", " + right)
                    .orElse("");
        }
        if (destination.type() == ConnectionEndpointType.TRANSITION && destination.id() != null) {
            DungeonTransition transition = layout.findTransition(destination.id());
            return transition == null ? "Übergang" : transition.label();
        }
        return "";
    }

    private static String roomLabel(DungeonLayout layout, Long roomId) {
        if (roomId == null) {
            return "Raum";
        }
        Room room = layout == null ? null : layout.clusters().stream()
                .map(RoomCluster::structure)
                .map(Structure::roomTopology)
                .map(topology -> topology.findRoom(roomId))
                .filter(java.util.Objects::nonNull)
                .findFirst()
                .orElse(null);
        return room == null || room.name() == null || room.name().isBlank() ? "Raum " + roomId : room.name();
    }
}
