package src.data.dungeon.model;

import java.util.List;

public record DungeonRoomRecord(
        long roomId,
        long mapId,
        long clusterId,
        String name,
        String visualDescription,
        int componentX,
        int componentY,
        int levelZ,
        List<DungeonRoomFloorRecord> floors,
        List<DungeonRoomExitDescriptionRecord> exitDescriptions
) {

    public DungeonRoomRecord {
        name = name == null || name.isBlank() ? "Raum " + roomId : name.trim();
        visualDescription = visualDescription == null ? "" : visualDescription;
        floors = floors == null ? List.of() : List.copyOf(floors);
        exitDescriptions = exitDescriptions == null ? List.of() : List.copyOf(exitDescriptions);
    }
}
