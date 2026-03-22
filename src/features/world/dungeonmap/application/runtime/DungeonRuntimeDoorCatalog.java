package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.application.room.DoorExitCatalog;
import features.world.dungeonmap.application.room.RoomExitCatalog;
import features.world.dungeonmap.application.room.RoomExitDescriptor;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.objects.Door;
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

    public static List<DungeonRuntimeDoorDescriptor> describe(DungeonLayout layout, Room room, DungeonHeading heading) {
        if (layout == null || room == null) {
            return List.of();
        }
        return RoomExitCatalog.describe(room).stream()
                .map(exit -> toDescriptor(layout, room, exit, heading))
                .toList();
    }

    public static List<DungeonRuntimeDoorDescriptor> describe(DungeonLayout layout, Corridor corridor, DungeonHeading heading) {
        if (layout == null || corridor == null || corridor.path() == null) {
            return List.of();
        }
        return describe(
                corridor.path().floor().shape().absoluteCells(),
                corridor.path().doors(),
                heading,
                (cell, direction) -> "",
                exit -> destinationRoomLabel(layout, exit.outsideCell(), Set.of()));
    }

    public static List<DungeonRuntimeDoorDescriptor> describe(DungeonLayout layout, CorridorNetwork network, DungeonHeading heading) {
        if (layout == null || network == null || network.floor() == null) {
            return List.of();
        }
        return describe(
                network.floor().shape().absoluteCells(),
                network.doors(),
                heading,
                (cell, direction) -> "",
                exit -> destinationRoomLabel(layout, exit.outsideCell(), Set.of()));
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
        Set<String> labels = new LinkedHashSet<>();
        for (Corridor corridor : layout.corridorsForRoom(room.roomId())) {
            if (corridor == null || corridor.path() == null || !matchesDoor(corridor, exit.anchorEdge())) {
                continue;
            }
            for (Long roomId : corridor.roomIds()) {
                if (roomId == null || roomId.equals(room.roomId())) {
                    continue;
                }
                String label = DungeonRuntimeLabels.roomLabel(layout, roomId);
                if (label != null && !label.isBlank()) {
                    labels.add(label);
                }
            }
        }
        if (!labels.isEmpty()) {
            return String.join(", ", labels);
        }
        return destinationRoomLabel(layout, exit.outsideCell(), Set.of(room.roomId()));
    }

    private static boolean matchesDoor(Corridor corridor, VertexEdge anchorEdge) {
        return corridor.path().doors().stream()
                .anyMatch(door -> door.edges().contains(anchorEdge));
    }

    private static String destinationRoomLabel(DungeonLayout layout, Point2i targetCell, Set<Long> excludedRoomIds) {
        if (layout == null || targetCell == null) {
            return "";
        }
        Room room = layout.roomAtCell(targetCell);
        if (room == null || (room.roomId() != null && excludedRoomIds.contains(room.roomId()))) {
            return "";
        }
        return DungeonRuntimeLabels.roomLabel(room);
    }
}
