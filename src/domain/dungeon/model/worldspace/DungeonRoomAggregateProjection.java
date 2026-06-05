package src.domain.dungeon.model.worldspace;

import src.domain.dungeon.model.core.projection.DungeonAreaFacts;


import java.util.List;
import src.domain.dungeon.model.core.projection.DungeonAreaType;

final class DungeonRoomAggregateProjection {

    private DungeonRoomAggregateProjection() {
    }

    static void addRoomAggregates(
            List<DungeonState> aggregates,
            List<DungeonAreaFacts> areas,
            long clusterId,
            List<DungeonRoom> clusterRooms,
            java.util.Map<Long, List<DungeonCell>> roomCells
    ) {
        for (DungeonRoom room : clusterRooms) {
            List<DungeonCell> cells = roomCells.getOrDefault(room.roomId(), List.of(room.primaryAnchor()));
            DungeonState aggregate = new DungeonState(room.roomId(), DungeonAreaType.ROOM, room.name(), cells);
            aggregates.add(aggregate);
            areas.add(new DungeonAreaFacts(
                    aggregate.kind(),
                    aggregate.id(),
                    clusterId,
                    aggregate.label(),
                    aggregate.cells()));
        }
    }
}
