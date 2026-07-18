package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import features.dungeon.adapter.sqlite.model.DungeonTopologyElementRecord;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

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
}
