package features.dungeon.adapter.sqlite.model;

import java.util.List;

public record DungeonRoomRecord(
        long roomId,
        long mapId,
        long clusterId,
        String name,
        String visualDescription,
        List<DungeonRoomCellRecord> floorCells,
        List<DungeonRoomExitDescriptionRecord> exitDescriptions
) {

    public DungeonRoomRecord {
        name = name == null || name.isBlank() ? "Raum " + roomId : name.trim();
        visualDescription = visualDescription == null ? "" : visualDescription;
        floorCells = floorCells == null ? List.of() : List.copyOf(floorCells);
        exitDescriptions = exitDescriptions == null ? List.of() : List.copyOf(exitDescriptions);
    }
}
