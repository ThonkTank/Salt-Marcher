package features.world.dungeonmap.service;

import database.DatabaseManager;
import features.world.dungeonmap.model.projection.DungeonConceptState;
import features.world.dungeonmap.service.projection.DungeonConceptStateLoader;

import java.sql.Connection;

public final class DungeonConceptQueryService {

    public DungeonConceptState loadConceptState(long mapId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonConceptStateLoader.load(conn, mapId);
        }
    }
}
