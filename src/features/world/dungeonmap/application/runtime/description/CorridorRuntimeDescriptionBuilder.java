package features.world.dungeonmap.application.runtime.description;

import features.world.dungeonmap.application.runtime.DungeonRuntimeAction;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.ArrayList;
import java.util.List;

final class CorridorRuntimeDescriptionBuilder {

    private CorridorRuntimeDescriptionBuilder() {
        throw new AssertionError("No instances");
    }

    static DungeonRuntimeDescription build(
            DungeonLayout layout,
            Corridor corridor,
            CardinalDirection heading,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        if (layout == null || corridor == null || corridor.corridorId() == null) {
            return null;
        }
        List<DungeonRuntimeExit> exits = layout.describeCorridorExits(corridor).stream()
                .map(exit -> DungeonRuntimeExitFactory.corridorExit(layout, corridor, heading, exit))
                .filter(java.util.Objects::nonNull)
                .toList();
        ArrayList<DungeonRuntimeAction> actions = new ArrayList<>();
        StairRuntimeDescriptionBuilder.appendStructureStairs(
                layout,
                corridor.structure().cellCoordsAtLevel(corridor.levelZ()),
                corridor.levelZ(),
                activeCell,
                activeLevelZ,
                actions);
        TransitionRuntimeDescriptionBuilder.appendStructureTransitions(
                layout,
                corridor.structure().cellCoordsAtLevel(corridor.levelZ()),
                corridor.levelZ(),
                actions);
        return new DungeonRuntimeDescription(
                corridorLabel(layout, corridor),
                DungeonRuntimeDescriptionRef.corridor(layout.mapId(), corridor.corridorId()),
                "",
                exits,
                actions);
    }

    private static String corridorLabel(DungeonLayout layout, Corridor corridor) {
        if (corridor == null) {
            return "Korridor";
        }
        String joinedRooms = corridor.connectedRoomIds().stream()
                .map(roomId -> roomLabel(layout, roomId))
                .distinct()
                .sorted(String::compareToIgnoreCase)
                .reduce((left, right) -> left + ", " + right)
                .orElse("Korridor");
        return "Korridor: " + joinedRooms;
    }

    private static String roomLabel(DungeonLayout layout, Long roomId) {
        if (roomId == null) {
            return "Raum";
        }
        Room room = layout == null ? null : layout.findRoom(roomId);
        return room == null || room.name() == null || room.name().isBlank() ? "Raum " + roomId : room.name();
    }
}
