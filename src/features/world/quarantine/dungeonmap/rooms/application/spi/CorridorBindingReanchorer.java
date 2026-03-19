package features.world.quarantine.dungeonmap.rooms.application.spi;

import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Map;
import java.util.Set;

public interface CorridorBindingReanchorer {

    void reanchorCorridorClusterBindings(
            Connection conn,
            DungeonLayout layout,
            Map<Long, ClusterAnchor> replacementAnchorsByClusterId,
            Set<Long> deletedClusterIds
    ) throws SQLException;
}
