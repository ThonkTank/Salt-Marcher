package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.application.room.DoorExitCatalog;
import features.world.dungeonmap.application.room.RoomExitCatalog;
import features.world.dungeonmap.application.room.RoomExitDescriptor;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.connection.Connection;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpointType;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNetwork;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.function.BiFunction;
import java.util.function.Function;

public final class DungeonRuntimeDoorCatalog {

    private DungeonRuntimeDoorCatalog() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonRuntimeDoorDescriptor> describe(DungeonLayout layout, Room room, CardinalDirection heading) {
        if (layout == null || room == null) {
            return List.of();
        }
        return RoomExitCatalog.describe(layout, room).stream()
                .map(exit -> toDescriptor(layout, room, exit, heading))
                .toList();
    }

    public static List<DungeonRuntimeDoorDescriptor> describe(DungeonLayout layout, Corridor corridor, CardinalDirection heading) {
        if (layout == null || corridor == null || corridor.path() == null) {
            return List.of();
        }
        return describe(
                DungeonRuntimeCorridorGeometry.canonicalCells(layout, corridor),
                layout.connectionsForCorridor(corridor.corridorId()),
                heading,
                (cell, direction) -> "",
                exit -> doorContext(layout, layout.connectionAt(exit.anchorEdge()), ConnectionEndpoint.corridor(corridor.corridorId())));
    }

    public static List<DungeonRuntimeDoorDescriptor> describe(DungeonLayout layout, CorridorNetwork network, CardinalDirection heading) {
        if (layout == null || network == null || network.floor() == null) {
            return List.of();
        }
        Set<Connection> connections = new LinkedHashSet<>();
        for (Long corridorId : network.corridorIds()) {
            if (corridorId != null) {
                connections.addAll(layout.connectionsForCorridor(corridorId));
            }
        }
        return describe(
                network.floor().shape().absoluteCells(),
                List.copyOf(connections),
                heading,
                (cell, direction) -> "",
                exit -> {
                    Connection connection = layout.connectionAt(exit.anchorEdge());
                    return doorContext(layout, connection, activeEndpoint(network, connection));
                });
    }

    private static List<DungeonRuntimeDoorDescriptor> describe(
            Set<Point2i> cells,
            List<? extends Connection> connections,
            CardinalDirection heading,
            BiFunction<Point2i, Point2i, String> narrationLookup,
            Function<RoomExitDescriptor, DoorContext> contextLookup
    ) {
        return DoorExitCatalog.describe(cells, connections).stream()
                .map(exit -> {
                    DoorContext context = contextLookup.apply(exit);
                    return DungeonRuntimeDoorDescriptor.from(
                            exit,
                            heading,
                            context.activeEndpoint(),
                            context.destinationEndpoint(),
                            context.destinationLabel(),
                            narrationLookup.apply(exit.roomCell(), exit.direction()));
                })
                .toList();
    }

    private static DungeonRuntimeDoorDescriptor toDescriptor(
            DungeonLayout layout,
            Room room,
            RoomExitDescriptor exit,
            CardinalDirection heading
    ) {
        String narration = room.narration().exitDescription(exit.roomCell(), exit.direction());
        DoorContext context = doorContext(layout, layout.connectionAt(exit.anchorEdge()), ConnectionEndpoint.room(room.roomId()));
        return DungeonRuntimeDoorDescriptor.from(
                exit,
                heading,
                context.activeEndpoint(),
                context.destinationEndpoint(),
                context.destinationLabel(),
                narration);
    }

    private static DoorContext doorContext(DungeonLayout layout, Connection connection, ConnectionEndpoint activeEndpoint) {
        if (layout == null || connection == null) {
            return new DoorContext(activeEndpoint, null, "");
        }
        ConnectionEndpoint destination = activeEndpoint == null
                ? null
                : connection.oppositeOf(activeEndpoint);
        return new DoorContext(activeEndpoint, destination, endpointLabel(layout, destination, activeEndpoint));
    }

    private static ConnectionEndpoint activeEndpoint(CorridorNetwork network, Connection connection) {
        if (network == null || connection == null) {
            return null;
        }
        return connection.endpoints().stream()
                .filter(endpoint -> endpoint != null
                        && endpoint.type() == ConnectionEndpointType.CORRIDOR
                        && endpoint.id() != null
                        && network.containsCorridor(endpoint.id()))
                .findFirst()
                .orElse(null);
    }

    private static String endpointLabel(
            DungeonLayout layout,
            ConnectionEndpoint destination,
            ConnectionEndpoint activeEndpoint
    ) {
        if (layout == null || destination == null) {
            return "";
        }
        if (destination.type() == ConnectionEndpointType.ROOM && destination.id() != null) {
            return DungeonRuntimeLabels.roomLabel(layout, destination.id());
        }
        if (destination.type() == ConnectionEndpointType.CORRIDOR && destination.id() != null) {
            Corridor corridor = layout.findCorridor(destination.id());
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
        if (destination.type() == ConnectionEndpointType.CLUSTER && destination.id() != null) {
            return "Raumverbund " + destination.id();
        }
        if (destination.type() == ConnectionEndpointType.STAIR && destination.id() != null) {
            var stair = layout.findStair(destination.id());
            return stair == null ? "Treppe" : stair.label();
        }
        if (destination.type() == ConnectionEndpointType.TRANSITION && destination.id() != null) {
            var transition = layout.findTransition(destination.id());
            return transition == null ? "Übergang" : transition.label();
        }
        return "";
    }

    private record DoorContext(
            ConnectionEndpoint activeEndpoint,
            ConnectionEndpoint destinationEndpoint,
            String destinationLabel
    ) {
    }
}
