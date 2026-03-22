package features.world.dungeonmap.canvas.graph;

import features.world.dungeonmap.application.runtime.DungeonRuntimeLocation;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.corridor.Corridor;

import java.util.ArrayList;
import java.util.List;

final class DungeonGraphProjection {

    private DungeonGraphProjection() {
    }

    static List<RoomLink> roomLinks(Corridor corridor) {
        if (corridor == null) {
            return List.of();
        }
        List<RoomLink> links = new ArrayList<>();
        List<Long> roomIds = corridor.roomIds();
        for (int index = 1; index < roomIds.size(); index++) {
            Long fromRoomId = roomIds.get(index - 1);
            Long toRoomId = roomIds.get(index);
            if (fromRoomId == null || toRoomId == null || fromRoomId.equals(toRoomId)) {
                continue;
            }
            links.add(new RoomLink(fromRoomId, toRoomId));
        }
        return List.copyOf(links);
    }

    static Long activeRoomId(DungeonLayout layout, DungeonRuntimeLocation activeLocation) {
        if (layout == null || activeLocation == null) {
            return null;
        }
        if (activeLocation instanceof DungeonRuntimeLocation.Tile tile) {
            var room = layout.roomAtCell(tile.tile());
            if (room != null) {
                return room.roomId();
            }
            var network = layout.corridorNetworkAtCell(tile.tile());
            if (network != null) {
                return network.roomIds().stream().sorted().findFirst().orElse(null);
            }
            return layout.corridorsAtCell(tile.tile()).stream()
                    .flatMap(corridor -> corridor.roomIds().stream())
                    .sorted()
                    .findFirst()
                    .orElse(null);
        }
        if (activeLocation instanceof DungeonRuntimeLocation.Room room) {
            return room.roomId();
        }
        if (activeLocation instanceof DungeonRuntimeLocation.Corridor corridor) {
            Corridor resolvedCorridor = layout.findCorridor(corridor.corridorId());
            return resolvedCorridor == null ? null : resolvedCorridor.roomIds().stream().findFirst().orElse(null);
        }
        if (activeLocation instanceof DungeonRuntimeLocation.CorridorComponent component) {
            return layout.corridorNetworks().stream()
                    .filter(candidate -> component.componentId().equals(candidate.networkId()))
                    .flatMap(candidate -> candidate.roomIds().stream())
                    .sorted()
                    .findFirst()
                    .orElse(null);
        }
        return null;
    }

    record RoomLink(long fromRoomId, long toRoomId) {
    }
}
