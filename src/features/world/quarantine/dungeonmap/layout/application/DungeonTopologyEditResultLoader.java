package features.world.quarantine.dungeonmap.layout.application;

import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayoutEditResult;
import features.world.quarantine.dungeonmap.layout.model.DungeonSelection;
import features.world.quarantine.dungeonmap.layout.persistence.DungeonLayoutReadRepository;

import java.sql.Connection;
import java.sql.SQLException;

public final class DungeonTopologyEditResultLoader {

    private DungeonTopologyEditResultLoader() {
        throw new AssertionError("No instances");
    }

    public static DungeonLayout requireLayout(Connection conn, long mapId) throws SQLException {
        return DungeonLayoutReadRepository.loadLayout(conn, mapId)
                .orElseThrow(() -> new IllegalArgumentException("Unbekannte Dungeon-Map: " + mapId));
    }

    public static DungeonCorridor requireCorridor(DungeonLayout layout, long corridorId) {
        DungeonCorridor corridor = layout == null ? null : layout.findCorridor(corridorId);
        if (corridor == null) {
            throw new IllegalArgumentException("Unbekannter Korridor: " + corridorId);
        }
        return corridor;
    }

    public static DungeonLayoutEditResult loadCorridorEditResult(Connection conn, long mapId, Long focusCorridorId) throws SQLException {
        DungeonSelection focusSelection = focusCorridorId == null ? null : DungeonSelection.corridor(focusCorridorId);
        return loadEditResult(conn, mapId, focusSelection);
    }

    public static DungeonLayoutEditResult loadEditResult(Connection conn, long mapId, DungeonSelection focusSelection) throws SQLException {
        DungeonLayout layout = requireLayout(conn, mapId);
        return new DungeonLayoutEditResult(layout, focusSelection);
    }
}
