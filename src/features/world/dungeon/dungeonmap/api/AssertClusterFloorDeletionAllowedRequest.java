package features.world.dungeon.dungeonmap.api;

import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.model.structures.room.Room;

import java.util.Objects;

public record AssertClusterFloorDeletionAllowedRequest(
        DungeonMap map,
        Room room,
        int levelZ,
        GridArea removedFloorCells
) {
    public AssertClusterFloorDeletionAllowedRequest {
        map = Objects.requireNonNull(map, "map");
        removedFloorCells = removedFloorCells == null ? GridArea.empty() : removedFloorCells.onLevel(levelZ);
    }
}
