package features.world.dungeonmap.service.topology;

import features.world.dungeonmap.model.domain.DungeonRoom;

import java.util.Collection;
import java.util.Map;

final class TopologyConceptLevelSupport {

    private TopologyConceptLevelSupport() {
    }

    static Long requireConsistentConceptLevel(
            Collection<Long> roomIds,
            Map<Long, DungeonRoom> roomsById,
            String context
    ) {
        Long resolvedConceptLevelId = null;
        for (Long roomId : roomIds) {
            if (roomId == null) {
                continue;
            }
            DungeonRoom room = roomsById.get(roomId);
            if (room == null || room.conceptLevelId() == null) {
                continue;
            }
            if (resolvedConceptLevelId == null) {
                resolvedConceptLevelId = room.conceptLevelId();
                continue;
            }
            if (!resolvedConceptLevelId.equals(room.conceptLevelId())) {
                throw new IllegalStateException(context + " darf keine Raeume aus verschiedenen Graph-Ebenen zusammenfuehren.");
            }
        }
        return resolvedConceptLevelId;
    }
}
