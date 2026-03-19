package features.world.quarantine.dungeonmap.runtime.application;

import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorComponent;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorTopology;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.runtime.model.DungeonRuntimeLocation;

public final class DungeonRuntimePresenter {

    private DungeonRuntimePresenter() {
        throw new AssertionError("No instances");
    }

    public static String activeLocationLabel(DungeonLayout layout, DungeonRuntimeLocation location, CorridorTopology corridorTopology) {
        if (location == null || layout == null) {
            return null;
        }
        if (location instanceof DungeonRuntimeLocation.CorridorComponent corridorComponentLocation) {
            CorridorComponent component = corridorTopology == null
                    ? null
                    : corridorTopology.componentById(corridorComponentLocation.componentId());
            if (component == null) {
                return null;
            }
            return component.roomIds().stream()
                    .sorted()
                    .map(roomId -> {
                        DungeonRoom room = layout.findRoom(roomId);
                        return room == null ? "Raum " + roomId : room.name();
                    })
                    .reduce((left, right) -> left + ", " + right)
                    .orElse("Korridor");
        }
        if (location instanceof DungeonRuntimeLocation.Room roomLocation) {
            DungeonRoom room = layout.findRoom(roomLocation.roomId());
            return room == null ? null : room.name();
        }
        return null;
    }
}
