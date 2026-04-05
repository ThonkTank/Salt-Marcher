package features.world.dungeonmap.application.runtime.description;

import features.world.dungeonmap.application.runtime.DungeonRuntimeAction;
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

final class DungeonRuntimeExitFactory {

    private DungeonRuntimeExitFactory() {
        throw new AssertionError("No instances");
    }

    static DungeonRuntimeExit roomExit(
            DungeonLayout layout,
            Room room,
            CardinalDirection heading,
            RoomExitDescriptor exit
    ) {
        String narration = room == null || room.roomId() == null || exit == null
                ? ""
                : room.narration().exitDescription(exit.levelZ(), exit.roomCell(), exit.direction());
        return create(
                layout,
                heading,
                exit,
                room == null || room.roomId() == null ? null : ConnectionEndpoint.room(room.roomId()),
                narration);
    }

    static DungeonRuntimeExit corridorExit(
            DungeonLayout layout,
            Corridor corridor,
            CardinalDirection heading,
            RoomExitDescriptor exit
    ) {
        return create(
                layout,
                heading,
                exit,
                corridor == null || corridor.corridorId() == null ? null : ConnectionEndpoint.corridor(corridor.corridorId()),
                "");
    }

    private static DungeonRuntimeExit create(
            DungeonLayout layout,
            CardinalDirection heading,
            RoomExitDescriptor exit,
            ConnectionEndpoint activeEndpoint,
            String narration
    ) {
        if (exit == null) {
            return null;
        }
        String destinationLabel = doorDestinationLabel(
                layout,
                layout == null ? null : layout.connectionAt(exit.levelZ(), exit.anchorSegment2x()),
                activeEndpoint);
        DungeonRuntimeAction action = new DungeonRuntimeAction(
                doorActionLabel(exit.label(), destinationLabel),
                "",
                "Verbindung konnte nicht benutzt werden",
                new DungeonRuntimeAction.DoorTarget(
                        exit.anchorSegment2x(),
                        new DungeonRuntimeAction.CellTarget(
                                exit.outsideCell(),
                                exit.levelZ(),
                                exit.direction())));
        return new DungeonRuntimeExit(
                exit.number(),
                exit.anchorSegment2x(),
                destinationLabel,
                doorDescription(heading, exit.direction(), narration),
                action);
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
            Connection connection,
            ConnectionEndpoint activeEndpoint
    ) {
        if (layout == null || connection == null) {
            return "";
        }
        ConnectionEndpoint destination = connection.oppositeOf(activeEndpoint);
        if (destination == null) {
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

    private static String doorActionLabel(String label, String destinationLabel) {
        String resolvedLabel = label == null || label.isBlank() ? "Tür" : label.trim();
        return destinationLabel == null || destinationLabel.isBlank()
                ? resolvedLabel
                : resolvedLabel + ": " + destinationLabel;
    }

    private static String roomLabel(DungeonLayout layout, Long roomId) {
        if (roomId == null) {
            return "Raum";
        }
        Room room = layout == null ? null : layout.findRoom(roomId);
        return room == null || room.name() == null || room.name().isBlank() ? "Raum " + roomId : room.name();
    }
}
