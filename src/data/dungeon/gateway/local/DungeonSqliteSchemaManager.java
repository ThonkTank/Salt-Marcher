package src.data.dungeon.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

final class DungeonSqliteSchemaManager {

    void ensureSchema(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("CREATE TABLE IF NOT EXISTS dungeon_maps ("
                    + "dungeon_map_id INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "name           TEXT NOT NULL"
                    + ")");
            statement.execute("CREATE TABLE IF NOT EXISTS dungeon_room_clusters ("
                    + "cluster_id       INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "dungeon_map_id   INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                    + "center_x         INTEGER NOT NULL,"
                    + "center_y         INTEGER NOT NULL,"
                    + "level_z          INTEGER NOT NULL DEFAULT 0"
                    + ")");
            statement.execute("CREATE TABLE IF NOT EXISTS dungeon_rooms ("
                    + "room_id            INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "dungeon_map_id     INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                    + "cluster_id         INTEGER NOT NULL REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,"
                    + "name               TEXT NOT NULL,"
                    + "visual_description TEXT,"
                    + "component_x        INTEGER NOT NULL,"
                    + "component_y        INTEGER NOT NULL,"
                    + "level_z            INTEGER NOT NULL DEFAULT 0"
                    + ")");
            statement.execute("CREATE TABLE IF NOT EXISTS dungeon_corridors ("
                    + "corridor_id     INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "dungeon_map_id  INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                    + "level_z         INTEGER NOT NULL DEFAULT 0"
                    + ")");
            statement.execute("CREATE TABLE IF NOT EXISTS dungeon_corridor_members ("
                    + "corridor_id  INTEGER NOT NULL REFERENCES dungeon_corridors(corridor_id) ON DELETE CASCADE,"
                    + "room_id      INTEGER NOT NULL REFERENCES dungeon_rooms(room_id) ON DELETE CASCADE,"
                    + "member_order INTEGER NOT NULL DEFAULT 0,"
                    + "PRIMARY KEY (corridor_id, room_id)"
                    + ")");
            statement.execute("CREATE TABLE IF NOT EXISTS dungeon_room_cluster_vertices ("
                    + "cluster_id   INTEGER NOT NULL REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,"
                    + "level_z      INTEGER NOT NULL DEFAULT 0,"
                    + "vertex_index INTEGER NOT NULL,"
                    + "relative_x   INTEGER NOT NULL,"
                    + "relative_y   INTEGER NOT NULL,"
                    + "PRIMARY KEY (cluster_id, level_z, vertex_index)"
                    + ")");
            statement.execute("CREATE TABLE IF NOT EXISTS dungeon_room_cluster_edges ("
                    + "cluster_id     INTEGER NOT NULL REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,"
                    + "level_z        INTEGER NOT NULL DEFAULT 0,"
                    + "cell_x         INTEGER NOT NULL,"
                    + "cell_y         INTEGER NOT NULL,"
                    + "edge_direction TEXT NOT NULL,"
                    + "edge_type      TEXT NOT NULL,"
                    + "PRIMARY KEY (cluster_id, level_z, cell_x, cell_y, edge_direction)"
                    + ")");
            statement.execute("CREATE TABLE IF NOT EXISTS dungeon_room_floors ("
                    + "room_id  INTEGER NOT NULL REFERENCES dungeon_rooms(room_id) ON DELETE CASCADE,"
                    + "level_z  INTEGER NOT NULL,"
                    + "anchor_x INTEGER NOT NULL,"
                    + "anchor_y INTEGER NOT NULL,"
                    + "PRIMARY KEY (room_id, level_z)"
                    + ")");
            statement.execute("CREATE TABLE IF NOT EXISTS dungeon_stairs ("
                    + "stair_id       INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "dungeon_map_id INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                    + "name           TEXT,"
                    + "shape          TEXT NOT NULL DEFAULT 'LADDER',"
                    + "direction      INTEGER NOT NULL DEFAULT 0,"
                    + "dimension1     INTEGER NOT NULL DEFAULT 0,"
                    + "dimension2     INTEGER NOT NULL DEFAULT 0,"
                    + "corridor_id    INTEGER REFERENCES dungeon_corridors(corridor_id) ON DELETE CASCADE"
                    + ")");
            statement.execute("CREATE TABLE IF NOT EXISTS dungeon_stair_path_nodes ("
                    + "stair_id   INTEGER NOT NULL REFERENCES dungeon_stairs(stair_id) ON DELETE CASCADE,"
                    + "sort_order INTEGER NOT NULL,"
                    + "cell_x     INTEGER NOT NULL,"
                    + "cell_y     INTEGER NOT NULL,"
                    + "cell_z     INTEGER NOT NULL,"
                    + "PRIMARY KEY (stair_id, sort_order)"
                    + ")");
            statement.execute("CREATE TABLE IF NOT EXISTS dungeon_stair_exits ("
                    + "stair_exit_id INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "stair_id      INTEGER NOT NULL REFERENCES dungeon_stairs(stair_id) ON DELETE CASCADE,"
                    + "cell_x        INTEGER NOT NULL,"
                    + "cell_y        INTEGER NOT NULL,"
                    + "cell_z        INTEGER NOT NULL,"
                    + "label         TEXT"
                    + ")");
            statement.execute("CREATE TABLE IF NOT EXISTS dungeon_transitions ("
                    + "transition_id            INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "dungeon_map_id           INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                    + "description              TEXT,"
                    + "cell_x                   INTEGER,"
                    + "cell_y                   INTEGER,"
                    + "level_z                  INTEGER,"
                    + "destination_type         TEXT NOT NULL,"
                    + "target_overworld_map_id  INTEGER,"
                    + "target_overworld_tile_id INTEGER,"
                    + "target_dungeon_map_id    INTEGER REFERENCES dungeon_maps(dungeon_map_id) ON DELETE SET NULL,"
                    + "target_transition_id     INTEGER REFERENCES dungeon_transitions(transition_id) ON DELETE SET NULL,"
                    + "linked_transition_id     INTEGER REFERENCES dungeon_transitions(transition_id) ON DELETE SET NULL"
                    + ")");
        }
    }
}
