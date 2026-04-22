package src.data.dungeon.gateway.local;

import org.jspecify.annotations.Nullable;
import src.data.dungeon.model.DungeonCorridorRecord;
import src.data.dungeon.model.DungeonMapRecord;
import src.data.dungeon.model.DungeonPersistenceSchema;
import src.data.dungeon.model.DungeonRoomClusterRecord;
import src.data.dungeon.model.DungeonTopologyElementRecord;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

final class DungeonSqliteTopologyElementGateway {

    private DungeonSqliteTopologyElementGateway() {
    }

    static List<DungeonTopologyElementRecord> load(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT dungeon_map_id, element_kind, element_id, cluster_id, corridor_id, label, sort_order"
                        + " FROM " + DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE
                        + " WHERE dungeon_map_id=? ORDER BY sort_order, element_kind, element_id")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<DungeonTopologyElementRecord> records = new ArrayList<>();
                while (resultSet.next()) {
                    records.add(new DungeonTopologyElementRecord(
                            resultSet.getLong("dungeon_map_id"),
                            resultSet.getString("element_kind"),
                            resultSet.getLong("element_id"),
                            DungeonSqliteStatementSupport.nullableLong(resultSet, "cluster_id"),
                            DungeonSqliteStatementSupport.nullableLong(resultSet, "corridor_id"),
                            resultSet.getString("label"),
                            resultSet.getInt("sort_order")));
                }
                return List.copyOf(records);
            }
        }
    }

    static void persist(Connection connection, DungeonMapRecord record) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                "DELETE FROM " + DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE + " WHERE dungeon_map_id=?")) {
            delete.setLong(1, record.mapId());
            delete.executeUpdate();
        }
        Set<Long> clusterIds = ids(record.roomClusters().stream().map(DungeonRoomClusterRecord::clusterId).toList());
        Set<Long> corridorIds = ids(record.corridors().stream().map(DungeonCorridorRecord::corridorId).toList());
        try (PreparedStatement insert = connection.prepareStatement(
                "INSERT INTO " + DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE
                        + "(dungeon_map_id, element_kind, element_id, cluster_id, corridor_id, label, sort_order)"
                        + " VALUES(?,?,?,?,?,?,?)")) {
            int sortOrder = 0;
            for (DungeonTopologyElementRecord element : record.topologyElements()) {
                if (element.elementId() <= 0L || "EMPTY".equals(element.elementKind())) {
                    continue;
                }
                insert.setLong(1, record.mapId());
                insert.setString(2, element.elementKind());
                insert.setLong(3, element.elementId());
                DungeonSqliteStatementSupport.setNullableLong(insert, 4, retainedId(element.clusterId(), clusterIds));
                DungeonSqliteStatementSupport.setNullableLong(insert, 5, retainedId(element.corridorId(), corridorIds));
                insert.setString(6, element.label());
                insert.setInt(7, sortOrder++);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static Set<Long> ids(List<Long> source) {
        Set<Long> result = new LinkedHashSet<>();
        for (Long value : source == null ? List.<Long>of() : source) {
            if (value != null && value > 0L) {
                result.add(value);
            }
        }
        return Set.copyOf(result);
    }

    private static @Nullable Long retainedId(@Nullable Long value, Set<Long> retainedIds) {
        if (value == null || value <= 0L) {
            return null;
        }
        return retainedIds.contains(value) ? value : null;
    }

}
