package features.world.dungeonmap.application.runtime.description;

import features.world.dungeonmap.application.runtime.DungeonRuntimeLocation;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.structures.connection.Connection;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpointType;
import features.world.dungeonmap.model.structures.connection.RoomExitDescriptor;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;

import java.util.Objects;

final class DungeonRuntimeExitFactory {

    private DungeonRuntimeExitFactory() {
        throw new AssertionError("No instances");
    }

    static DungeonRuntimeExit roomExit(
            DungeonRuntimeLocation location,
            RoomExitDescriptor exit
    ) {
        Room room = location == null ? null : location.room();
        String narration = room == null || room.roomId() == null || exit == null
                ? ""
                : room.narration().exitDescription(exit.levelZ(), exit.roomCell(), exit.direction());
        return create(
                location,
                exit,
                room == null || room.roomId() == null ? null : ConnectionEndpoint.room(room.roomId()),
                narration);
    }

    static DungeonRuntimeExit corridorExit(
            DungeonRuntimeLocation location,
            RoomExitDescriptor exit
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
            RoomExitDescriptor exit,
            ConnectionEndpoint activeEndpoint,
            String narration
    ) {
        if (exit == null) {
            return null;
        }
        DungeonLayout layout = location == null ? null : location.layout();
        Connection connection = layout == null ? null : layout.connectionAt(exit.levelZ(), exit.anchorSegment2x());
        ConnectionEndpoint destinationEndpoint = oppositeEndpoint(connection, activeEndpoint);
        String destinationLabel = doorDestinationLabel(layout, destinationEndpoint, activeEndpoint);
        return new DungeonRuntimeExit(
                exit.label(),
                exit.number(),
                exit.anchorSegment2x(),
                destinationLabel,
                doorDescription(location == null ? null : location.heading(), exit.direction(), narration),
                exit.outsideCell(),
                exit.levelZ(),
                exit.direction(),
                destinationEndpoint != null && destinationEndpoint.type() == ConnectionEndpointType.TRANSITION
                        ? destinationEndpoint.id()
                        : null);
    }

    private static String doorDescription(
            CardinalDirection heading,
            CardinalDirection doorDirection,
            String narration
    ) {
        CardinalDirection resolvedHeading = heading == null ? CardinalDirection.defaultDirection() : heading;
        String relativeLabel = resolvedHeading.relativeLabel(doorDirection.delta());
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
        if (destination.type() == ConnectionEndpointType.CLUSTER && destination.id() != null) {
            return "Raumverbund " + destination.id();
        }
        if (destination.type() == ConnectionEndpointType.STAIR && destination.id() != null) {
            DungeonStair stair = layout.findStair(destination.id());
            return stair == null ? "Treppe" : stair.label();
        }
        if (destination.type() == ConnectionEndpointType.TRANSITION && destination.id() != null) {
            DungeonTransition transition = layout.findTransition(destination.id());
            return transition == null ? "Übergang" : transition.label();
        }
        return "";
    }

    private static ConnectionEndpoint oppositeEndpoint(Connection connection, ConnectionEndpoint activeEndpoint) {
        if (connection == null) {
            return null;
        }
        if (activeEndpoint != null) {
            ConnectionEndpoint opposite = connection.oppositeOf(activeEndpoint);
            if (opposite != null) {
                return opposite;
            }
        }
        return connection.endpoints().stream()
                .filter(endpoint -> endpoint != null && endpoint.type() == ConnectionEndpointType.TRANSITION)
                .findFirst()
                .orElseGet(() -> connection.endpoints().stream()
                        .filter(Objects::nonNull)
                        .findFirst()
                        .orElse(null));
    }

    private static String roomLabel(DungeonLayout layout, Long roomId) {
        if (roomId == null) {
            return "Raum";
        }
        Room room = layout == null ? null : layout.findRoom(roomId);
        return room == null || room.name() == null || room.name().isBlank() ? "Raum " + roomId : room.name();
    }
}
