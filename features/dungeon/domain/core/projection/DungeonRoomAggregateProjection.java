package features.dungeon.domain.core.projection;

import java.util.List;
import java.util.Map;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.graph.DungeonTopologyElementKind;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.room.DungeonRoom;

public final class DungeonRoomAggregateProjection {

    private DungeonRoomAggregateProjection() {
    }

    public static void addRoomAggregates(
            List<DungeonState> aggregates,
            List<DungeonAreaFacts> areas,
            long clusterId,
            List<DungeonRoom> clusterRooms,
            Map<Long, List<Cell>> roomCells
    ) {
        for (DungeonRoom room : clusterRooms) {
            List<Cell> cells = roomCells.getOrDefault(room.roomId(), List.of(room.primaryAnchor()));
            DungeonState aggregate = new DungeonState(room.roomId(), DungeonAreaType.ROOM, room.name(), cells);
            aggregates.add(aggregate);
            areas.add(new DungeonAreaFacts(
                    aggregate.kind(),
                    aggregate.id(),
                    clusterId,
                    aggregate.label(),
                    aggregate.cells(),
                    new DungeonTopologyRef(DungeonTopologyElementKind.ROOM, room.roomId())));
        }
    }
}
