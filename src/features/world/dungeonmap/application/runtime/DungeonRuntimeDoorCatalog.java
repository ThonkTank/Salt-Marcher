package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.application.room.DoorExitCatalog;
import features.world.dungeonmap.application.room.RoomExitCatalog;
import features.world.dungeonmap.application.room.RoomExitDescriptor;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpointType;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNetwork;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.List;
import java.util.Set;
import java.util.function.BiFunction;
import java.util.function.Function;

public final class DungeonRuntimeDoorCatalog {

    private DungeonRuntimeDoorCatalog() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonRuntimeDoorDescriptor> describe(DungeonLayout layout, Room room, DungeonHeading heading) {
        if (layout == null || room == null) {
            return List.of();
        }
        return RoomExitCatalog.describe(layout, room).stream()
                .map(exit -> toDescriptor(layout, room, exit, heading))
                .toList();
    }

    public static List<DungeonRuntimeDoorDescriptor> describe(DungeonLayout layout, Corridor corridor, DungeonHeading heading) {
        if (layout == null || corridor == null || corridor.path() == null) {
            return List.of();
        }
        return describe(
                corridor.path().floor().shape().absoluteCells(),
                layout.doorsForCorridor(corridor.corridorId()),
                heading,
                (cell, direction) -> "",
                exit -> destinationLabel(layout, layout.doorAt(exit.anchorEdge()), ConnectionEndpoint.corridor(corridor.corridorId())));
    }

    public static List<DungeonRuntimeDoorDescriptor> describe(DungeonLayout layout, CorridorNetwork network, DungeonHeading heading) {
        if (layout == null || network == null || network.floor() == null) {
            return List.of();
        }
        return describe(
                network.floor().shape().absoluteCells(),
                layout.doorsForNetwork(network.networkId()),
                heading,
                (cell, direction) -> "",
                exit -> destinationLabel(layout, layout.doorAt(exit.anchorEdge()), null));
    }

    private static List<DungeonRuntimeDoorDescriptor> describe(
            Set<Point2i> cells,
            List<Door> doors,
            DungeonHeading heading,
            BiFunction<Point2i, Point2i, String> narrationLookup,
            Function<RoomExitDescriptor, String> destinationLookup
    ) {
        return DoorExitCatalog.describe(cells, doors).stream()
                .map(exit -> DungeonRuntimeDoorDescriptor.from(
                        exit,
                        heading,
                        destinationLookup.apply(exit),
                        narrationLookup.apply(exit.roomCell(), exit.direction())))
                .toList();
    }

    private static DungeonRuntimeDoorDescriptor toDescriptor(
            DungeonLayout layout,
            Room room,
            RoomExitDescriptor exit,
            DungeonHeading heading
    ) {
        String narration = room.narration().exitDescription(exit.roomCell(), exit.direction());
        return DungeonRuntimeDoorDescriptor.from(exit, heading, destinationLabel(layout, room, exit), narration);
    }

    private static String destinationLabel(DungeonLayout layout, Room room, RoomExitDescriptor exit) {
        if (layout == null || room == null || exit == null) {
            return "";
        }
        return destinationLabel(layout, layout.doorAt(exit.anchorEdge()), ConnectionEndpoint.room(room.roomId()));
    }

    private static String destinationLabel(DungeonLayout layout, Door door, ConnectionEndpoint activeEndpoint) {
        if (layout == null || door == null) {
            return "";
        }
        ConnectionEndpoint opposite = activeEndpoint == null
                ? firstRoomEndpoint(layout, door)
                : layout.oppositeEndpoint(door, activeEndpoint);
        if (opposite == null) {
            return "";
        }
        if (opposite.type() == ConnectionEndpointType.ROOM && opposite.id() != null) {
            return DungeonRuntimeLabels.roomLabel(layout, opposite.id());
        }
        if (opposite.type() == ConnectionEndpointType.CORRIDOR && opposite.id() != null) {
            Corridor corridor = layout.findCorridor(opposite.id());
            if (corridor == null) {
                return "";
            }
            return corridor.roomIds().stream()
                    .filter(roomId -> roomId != null && (activeEndpoint == null || !roomId.equals(activeEndpoint.id())))
                    .map(roomId -> DungeonRuntimeLabels.roomLabel(layout, roomId))
                    .filter(label -> label != null && !label.isBlank())
                    .distinct()
                    .reduce((left, right) -> left + ", " + right)
                    .orElse("");
        }
        return "";
    }

    private static ConnectionEndpoint firstRoomEndpoint(DungeonLayout layout, Door door) {
        if (layout == null || door == null) {
            return null;
        }
        return layout.endpointsForDoor(door).stream()
                .filter(endpoint -> endpoint != null && endpoint.type() == ConnectionEndpointType.ROOM)
                .findFirst()
                .orElse(null);
    }
}
