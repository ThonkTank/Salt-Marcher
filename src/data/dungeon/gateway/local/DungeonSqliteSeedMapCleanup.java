package src.data.dungeon.gateway.local;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import src.data.dungeon.model.DungeonPersistenceSchema;

final class DungeonSqliteSeedMapCleanup {

    private static final String AND_NOT_EXISTS_SELECT_ONE_FROM = " AND NOT EXISTS (SELECT 1 FROM ";

    void apply(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "DELETE FROM " + DungeonPersistenceSchema.MAPS_TABLE
                        + " WHERE dungeon_map_id IN ("
                        + " SELECT m.dungeon_map_id FROM " + DungeonPersistenceSchema.MAPS_TABLE + " m"
                        + " WHERE m.name IN ('Dungeon', 'Dungeon Bastion', 'Dungeon Map')"
                        + " AND (SELECT COUNT(*) FROM " + DungeonPersistenceSchema.ROOMS_TABLE
                        + " r WHERE r.dungeon_map_id=m.dungeon_map_id)=1"
                        + " AND (SELECT COUNT(*) FROM " + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE
                        + " c WHERE c.dungeon_map_id=m.dungeon_map_id)=1"
                        + " AND EXISTS (SELECT 1 FROM " + DungeonPersistenceSchema.ROOMS_TABLE
                        + " r WHERE r.dungeon_map_id=m.dungeon_map_id"
                        + " AND r.name='Entry Hall'"
                        + " AND r.component_x=2 AND r.component_y=2 AND r.level_z=0"
                        + " AND (r.visual_description IS NULL OR TRIM(r.visual_description)=''))"
                        + " AND EXISTS (SELECT 1 FROM " + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE
                        + " c WHERE c.dungeon_map_id=m.dungeon_map_id"
                        + " AND c.center_x=2 AND c.center_y=2 AND c.level_z=0)"
                        + AND_NOT_EXISTS_SELECT_ONE_FROM + DungeonPersistenceSchema.CORRIDORS_TABLE
                        + " c WHERE c.dungeon_map_id=m.dungeon_map_id)"
                        + AND_NOT_EXISTS_SELECT_ONE_FROM + DungeonPersistenceSchema.STAIRS_TABLE
                        + " s WHERE s.dungeon_map_id=m.dungeon_map_id)"
                        + AND_NOT_EXISTS_SELECT_ONE_FROM + DungeonPersistenceSchema.TRANSITIONS_TABLE
                        + " t WHERE t.dungeon_map_id=m.dungeon_map_id)"
                        + AND_NOT_EXISTS_SELECT_ONE_FROM
                        + DungeonPersistenceSchema.ROOM_EXIT_DESCRIPTIONS_TABLE
                        + " x JOIN " + DungeonPersistenceSchema.ROOMS_TABLE + " r ON r.room_id=x.room_id"
                        + " WHERE r.dungeon_map_id=m.dungeon_map_id"
                        + " AND x.description IS NOT NULL AND TRIM(x.description) <> '')"
                        + ")")) {
            statement.executeUpdate();
        }
    }
}
