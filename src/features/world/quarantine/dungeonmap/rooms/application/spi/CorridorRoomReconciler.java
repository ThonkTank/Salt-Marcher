package features.world.quarantine.dungeonmap.rooms.application.spi;

import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

public interface CorridorRoomReconciler {

    void reconcileRoomCorridors(
            Connection conn,
            DungeonLayout layout,
            long mapId,
            long originalRoomId,
            List<DungeonRoom> fragments
    ) throws SQLException;
}
