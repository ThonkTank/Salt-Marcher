package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.port.DungeonWindow;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** Exact inbound relation queries; no authored entity graph is hydrated here. */
final class DungeonSqliteInboundReferenceDiscovery {
    private DungeonSqliteInboundReferenceDiscovery() {
    }

    static List<DungeonPatchEntityRef> load(
            Connection connection,
            long mapId,
            List<DungeonPatchEntityRef> targets,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        Set<DungeonPatchEntityRef> result = new LinkedHashSet<>();
        for (DungeonPatchEntityRef target : targets) {
            switch (target.kind()) {
                case ROOM -> roomInbound(connection, mapId, target.id(), queries, result);
                case ROOM_CLUSTER -> clusterInbound(connection, mapId, target.id(), queries, result);
                case CORRIDOR -> corridorInbound(connection, mapId, target.id(), queries, result);
                case TRANSITION -> transitionInbound(connection, mapId, target.id(), queries, result);
                case STAIR, FEATURE_MARKER -> {
                    // These target families own no persisted inbound authored references.
                }
            }
        }
        return result.stream().sorted(DungeonWindow.ENTITY_ORDER).toList();
    }

    private static void roomInbound(
            Connection connection, long mapId, long roomId, DungeonSqliteQueryCounter queries,
            Set<DungeonPatchEntityRef> result
    ) throws SQLException {
        collectIds(connection, queries,
                "SELECT DISTINCT c.corridor_id FROM " + DungeonPersistenceSchema.CORRIDORS_TABLE + " c "
                        + "JOIN " + DungeonPersistenceSchema.CORRIDOR_MEMBERS_TABLE
                        + " m ON m.corridor_id=c.corridor_id "
                        + "WHERE c.dungeon_map_id=? AND m.room_id=? ORDER BY c.corridor_id",
                mapId, roomId, DungeonPatchEntityRef::corridor, result);
        collectRouteDependentsForRoom(connection, mapId, roomId, queries, result);
    }

    private static void clusterInbound(
            Connection connection, long mapId, long clusterId, DungeonSqliteQueryCounter queries,
            Set<DungeonPatchEntityRef> result
    ) throws SQLException {
        collectIds(connection, queries,
                "SELECT room_id FROM " + DungeonPersistenceSchema.ROOMS_TABLE
                        + " WHERE dungeon_map_id=? AND cluster_id=? ORDER BY room_id",
                mapId, clusterId, DungeonPatchEntityRef::room, result);
        collectIds(connection, queries,
                "SELECT DISTINCT c.corridor_id FROM " + DungeonPersistenceSchema.CORRIDORS_TABLE + " c "
                        + "JOIN " + DungeonPersistenceSchema.CORRIDOR_WAYPOINTS_TABLE
                        + " w ON w.corridor_id=c.corridor_id "
                        + "WHERE c.dungeon_map_id=? AND w.cluster_id=? ORDER BY c.corridor_id",
                mapId, clusterId, DungeonPatchEntityRef::corridor, result);
        collectIds(connection, queries,
                "SELECT DISTINCT c.corridor_id FROM " + DungeonPersistenceSchema.CORRIDORS_TABLE + " c "
                        + "JOIN " + DungeonPersistenceSchema.CORRIDOR_DOOR_OVERRIDES_TABLE
                        + " d ON d.corridor_id=c.corridor_id "
                        + "WHERE c.dungeon_map_id=? AND d.cluster_id=? ORDER BY c.corridor_id",
                mapId, clusterId, DungeonPatchEntityRef::corridor, result);
        collectRouteDependentsForCluster(connection, mapId, clusterId, queries, result);
    }

    private static void corridorInbound(
            Connection connection, long mapId, long corridorId, DungeonSqliteQueryCounter queries,
            Set<DungeonPatchEntityRef> result
    ) throws SQLException {
        collectIds(connection, queries,
                "SELECT DISTINCT c.corridor_id FROM " + DungeonPersistenceSchema.CORRIDORS_TABLE + " c "
                        + "JOIN " + DungeonPersistenceSchema.CORRIDOR_ANCHOR_REFS_TABLE
                        + " r ON r.corridor_id=c.corridor_id "
                        + "WHERE c.dungeon_map_id=? AND r.host_corridor_id=? ORDER BY c.corridor_id",
                mapId, corridorId, DungeonPatchEntityRef::corridor, result);
        collectIds(connection, queries,
                "SELECT stair_id FROM " + DungeonPersistenceSchema.STAIRS_TABLE
                        + " WHERE dungeon_map_id=? AND corridor_id=? ORDER BY stair_id",
                mapId, corridorId, DungeonPatchEntityRef::stair, result);
    }

    private static void transitionInbound(
            Connection connection, long mapId, long transitionId, DungeonSqliteQueryCounter queries,
            Set<DungeonPatchEntityRef> result
    ) throws SQLException {
        collectIds(connection, queries,
                "SELECT transition_id FROM " + DungeonPersistenceSchema.TRANSITIONS_TABLE
                        + " WHERE dungeon_map_id=? AND (linked_transition_id=? OR "
                        + "(target_dungeon_map_id=? AND target_transition_id=?)) ORDER BY transition_id",
                new long[]{mapId, transitionId, mapId, transitionId},
                DungeonPatchEntityRef::transition, result);
    }

    private static void collectRouteDependentsForRoom(
            Connection connection, long mapId, long roomId, DungeonSqliteQueryCounter queries,
            Set<DungeonPatchEntityRef> result
    ) throws SQLException {
        collectIds(connection, queries,
                "SELECT DISTINCT d.corridor_id FROM "
                        + DungeonPersistenceSchema.CORRIDOR_ROUTE_DEPENDENCIES_TABLE + " d "
                        + "JOIN " + DungeonPersistenceSchema.ROOM_CELLS_TABLE
                        + " rc ON rc.level_z=d.level_z AND rc.cell_x=d.cell_x AND rc.cell_y=d.cell_y "
                        + "WHERE d.dungeon_map_id=? AND rc.room_id=? ORDER BY d.corridor_id",
                mapId, roomId, DungeonPatchEntityRef::corridor, result);
    }

    private static void collectRouteDependentsForCluster(
            Connection connection, long mapId, long clusterId, DungeonSqliteQueryCounter queries,
            Set<DungeonPatchEntityRef> result
    ) throws SQLException {
        collectIds(connection, queries,
                "SELECT DISTINCT d.corridor_id FROM "
                        + DungeonPersistenceSchema.CORRIDOR_ROUTE_DEPENDENCIES_TABLE + " d "
                        + "JOIN " + DungeonPersistenceSchema.ROOM_CELLS_TABLE
                        + " rc ON rc.level_z=d.level_z AND rc.cell_x=d.cell_x AND rc.cell_y=d.cell_y "
                        + "JOIN " + DungeonPersistenceSchema.ROOMS_TABLE + " r ON r.room_id=rc.room_id "
                        + "WHERE d.dungeon_map_id=? AND r.dungeon_map_id=? AND r.cluster_id=? "
                        + "ORDER BY d.corridor_id",
                new long[]{mapId, mapId, clusterId}, DungeonPatchEntityRef::corridor, result);
    }

    private static void collectIds(
            Connection connection,
            DungeonSqliteQueryCounter queries,
            String sql,
            long first,
            long second,
            RefFactory factory,
            Set<DungeonPatchEntityRef> result
    ) throws SQLException {
        collectIds(connection, queries, sql, new long[]{first, second}, factory, result);
    }

    private static void collectIds(
            Connection connection,
            DungeonSqliteQueryCounter queries,
            String sql,
            long[] arguments,
            RefFactory factory,
            Set<DungeonPatchEntityRef> result
    ) throws SQLException {
        try (PreparedStatement statement = queries.prepare(connection, sql)) {
            for (int index = 0; index < arguments.length; index++) {
                statement.setLong(index + 1, arguments[index]);
            }
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    long id = rows.getLong(1);
                    if (id > 0L) {
                        result.add(factory.create(id));
                    }
                }
            }
        }
    }

    @FunctionalInterface
    private interface RefFactory {
        DungeonPatchEntityRef create(long id);
    }
}
