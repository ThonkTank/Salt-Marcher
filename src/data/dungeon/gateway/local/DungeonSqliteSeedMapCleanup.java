package src.data.dungeon.gateway.local;

import src.data.dungeon.model.DungeonPersistenceSchema;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

final class DungeonSqliteSeedMapCleanup {

    private static final String SQL_AND_NOT_EXISTS = " AND NOT EXISTS (SELECT 1 FROM ";

    void apply(Connection connection) throws SQLException {
        String maps = DungeonPersistenceSchema.MAPS_TABLE;
        String rooms = DungeonPersistenceSchema.ROOMS_TABLE;
        String clusters = DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE;
        String corridors = DungeonPersistenceSchema.CORRIDORS_TABLE;
        String stairs = DungeonPersistenceSchema.STAIRS_TABLE;
        String transitions = DungeonPersistenceSchema.TRANSITIONS_TABLE;
        String exits = DungeonPersistenceSchema.ROOM_EXIT_DESCRIPTIONS_TABLE;
        try (PreparedStatement statement = connection.prepareStatement(
                "DELETE FROM " + maps
                        + " WHERE dungeon_map_id IN ("
                        + " SELECT m.dungeon_map_id FROM " + maps + " m"
                        + " WHERE m.name IN ('Dungeon', 'Dungeon Bastion', 'Dungeon Map')"
                        + " AND (SELECT COUNT(*) FROM " + rooms
                        + " r WHERE r.dungeon_map_id=m.dungeon_map_id)=1"
                        + " AND (SELECT COUNT(*) FROM " + clusters
                        + " c WHERE c.dungeon_map_id=m.dungeon_map_id)=1"
                        + " AND EXISTS (SELECT 1 FROM " + rooms
                        + " r WHERE r.dungeon_map_id=m.dungeon_map_id"
                        + " AND r.name='Entry Hall'"
                        + " AND r.component_x=2 AND r.component_y=2 AND r.level_z=0"
                        + " AND (r.visual_description IS NULL OR TRIM(r.visual_description)=''))"
                        + " AND EXISTS (SELECT 1 FROM " + clusters
                        + " c WHERE c.dungeon_map_id=m.dungeon_map_id"
                        + " AND c.center_x=2 AND c.center_y=2 AND c.level_z=0)"
                        + SQL_AND_NOT_EXISTS + corridors
                        + " c WHERE c.dungeon_map_id=m.dungeon_map_id)"
                        + SQL_AND_NOT_EXISTS + stairs
                        + " s WHERE s.dungeon_map_id=m.dungeon_map_id)"
                        + SQL_AND_NOT_EXISTS + transitions
                        + " t WHERE t.dungeon_map_id=m.dungeon_map_id)"
                        + SQL_AND_NOT_EXISTS + exits
                        + " x JOIN " + rooms + " r ON r.room_id=x.room_id"
                        + " WHERE r.dungeon_map_id=m.dungeon_map_id"
                        + " AND x.description IS NOT NULL AND TRIM(x.description) <> '')"
                        + ")")) {
            statement.executeUpdate();
        }
    }
}
