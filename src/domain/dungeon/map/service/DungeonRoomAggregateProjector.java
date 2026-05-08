package src.domain.dungeon.map.service;

import src.domain.dungeon.map.entity.DungeonAggregate;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.value.DungeonAreaFacts;
import src.domain.dungeon.map.value.DungeonAreaType;
import src.domain.dungeon.map.value.DungeonCell;

import java.util.List;

final class DungeonRoomAggregateProjector {

    private DungeonRoomAggregateProjector() {
    }

    static void addRoomAggregates(
            List<DungeonAggregate> aggregates,
            List<DungeonAreaFacts> areas,
            long clusterId,
            List<DungeonRoom> clusterRooms,
            java.util.Map<Long, List<DungeonCell>> roomCells
    ) {
        for (DungeonRoom room : clusterRooms) {
            List<DungeonCell> cells = roomCells.getOrDefault(room.roomId(), List.of(room.primaryAnchor()));
            DungeonAggregate aggregate = new DungeonAggregate(room.roomId(), DungeonAreaType.ROOM, room.name(), cells);
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
