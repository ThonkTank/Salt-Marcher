package features.world.dungeonmap.application.runtime.description;

import features.world.dungeonmap.application.runtime.DungeonRuntimeAction;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.ArrayList;
import java.util.List;

final class RoomRuntimeDescriptionBuilder {

    private RoomRuntimeDescriptionBuilder() {
        throw new AssertionError("No instances");
    }

    static DungeonRuntimeDescription build(
            DungeonLayout layout,
            Room room,
            CardinalDirection heading,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        if (layout == null || room == null || room.roomId() == null) {
            return null;
        }
        List<DungeonRuntimeExit> exits = layout.describeRoomExits(room).stream()
                .map(exit -> DungeonRuntimeExitFactory.roomExit(layout, room, heading, exit))
                .filter(java.util.Objects::nonNull)
                .toList();
        ArrayList<DungeonRuntimeAction> actions = new ArrayList<>();
        for (int levelZ : room.structure().relevantLevels(activeCell, activeLevelZ)) {
            StairRuntimeDescriptionBuilder.appendStructureStairs(
                    layout,
                    room.structure().cellCoordsAtLevel(levelZ),
                    levelZ,
                    activeCell,
                    activeLevelZ,
                    actions);
            TransitionRuntimeDescriptionBuilder.appendStructureTransitions(
                    layout,
                    room.structure().cellCoordsAtLevel(levelZ),
                    levelZ,
                    actions);
        }
        return new DungeonRuntimeDescription(
                roomLabel(room),
                DungeonRuntimeDescriptionRef.room(layout.mapId(), room.roomId()),
                room.narration().visualDescription(),
                exits,
                actions);
    }

    private static String roomLabel(Room room) {
        if (room == null) {
            return "Raum";
        }
        return room.name() == null || room.name().isBlank() ? "Raum " + room.roomId() : room.name();
    }
}
