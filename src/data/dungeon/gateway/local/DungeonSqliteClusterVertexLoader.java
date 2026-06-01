package src.data.dungeon.gateway.local;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.data.dungeon.model.DungeonPersistenceSchema;
import src.data.dungeon.model.DungeonRoomClusterVertexRecord;

final class DungeonSqliteClusterVertexLoader {

    private static final int LOOP_SEPARATOR_COORDINATE = Integer.MIN_VALUE;
    private static final String COLUMN_CLUSTER_ID = "cluster_id";
    private static final String COLUMN_LEVEL_Z = "level_z";
    private static final String VERTEX_TABLE = DungeonPersistenceSchema.ROOM_CLUSTER_VERTICES_TABLE;
    private static final String CLUSTER_TABLE = DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE;
    private static final String SQL_JOIN = " JOIN ";
    private static final String MAP_CLUSTER_FILTER =
            " IN (SELECT cluster_id FROM " + CLUSTER_TABLE + " WHERE dungeon_map_id=?)";
    private static final String TOTAL_VERTEX_ROWS_SQL =
            "SELECT COUNT(*) FROM " + VERTEX_TABLE + " WHERE cluster_id" + MAP_CLUSTER_FILTER;
    private static final String COMPACT_FILLED_UNIT_LOOPS_SQL =
            "SELECT base.cluster_id, base.level_z,"
                    + " COUNT(*) AS loop_count,"
                    + " COUNT(DISTINCT base.relative_x || ':' || base.relative_y) AS distinct_cell_count,"
                    + " MIN(base.relative_x) AS min_x,"
                    + " MAX(base.relative_x) AS max_x,"
                    + " MIN(base.relative_y) AS min_y,"
                    + " MAX(base.relative_y) AS max_y,"
                    + " total.row_count AS row_count"
                    + " FROM " + VERTEX_TABLE + " base"
                    + SQL_JOIN + VERTEX_TABLE + " one"
                    + " ON one.cluster_id=base.cluster_id"
                    + " AND one.level_z=base.level_z"
                    + " AND one.vertex_index=base.vertex_index + 1"
                    + SQL_JOIN + VERTEX_TABLE + " two"
                    + " ON two.cluster_id=base.cluster_id"
                    + " AND two.level_z=base.level_z"
                    + " AND two.vertex_index=base.vertex_index + 2"
                    + SQL_JOIN + VERTEX_TABLE + " three"
                    + " ON three.cluster_id=base.cluster_id"
                    + " AND three.level_z=base.level_z"
                    + " AND three.vertex_index=base.vertex_index + 3"
                    + SQL_JOIN + VERTEX_TABLE + " separator"
                    + " ON separator.cluster_id=base.cluster_id"
                    + " AND separator.level_z=base.level_z"
                    + " AND separator.vertex_index=base.vertex_index + 4"
                    + SQL_JOIN + "(SELECT cluster_id, level_z, COUNT(*) AS row_count"
                    + " FROM " + VERTEX_TABLE
                    + " WHERE cluster_id" + MAP_CLUSTER_FILTER
                    + " GROUP BY cluster_id, level_z) total"
                    + " ON total.cluster_id=base.cluster_id"
                    + " AND total.level_z=base.level_z"
                    + " WHERE base.cluster_id" + MAP_CLUSTER_FILTER
                    + " AND base.vertex_index % 5 = 0"
                    + " AND one.relative_x=base.relative_x + 1"
                    + " AND one.relative_y=base.relative_y"
                    + " AND two.relative_x=base.relative_x + 1"
                    + " AND two.relative_y=base.relative_y + 1"
                    + " AND three.relative_x=base.relative_x"
                    + " AND three.relative_y=base.relative_y + 1"
                    + " AND separator.relative_x=?"
                    + " AND separator.relative_y=?"
                    + " GROUP BY base.cluster_id, base.level_z, total.row_count";
    private static final String LOAD_VERTICES_SQL =
            "SELECT cluster_id, level_z, vertex_index, relative_x, relative_y"
                    + " FROM " + VERTEX_TABLE
                    + " WHERE cluster_id" + MAP_CLUSTER_FILTER
                    + " ORDER BY cluster_id, level_z, vertex_index";

    private DungeonSqliteClusterVertexLoader() {
    }

    static Map<Long, List<DungeonRoomClusterVertexRecord>> load(Connection connection, long mapId) throws SQLException {
        Map<GroupKey, CompactLoop> compactLoops = compactFilledUnitLoops(connection, mapId);
        long totalRows = totalVertexRows(connection, mapId);
        long compactedRows = compactLoops.values().stream().mapToLong(CompactLoop::rowCount).sum();
        if (compactedRows == totalRows) {
            return groupedCompactRecords(compactLoops);
        }
        return loadFull(connection, mapId);
    }

    private static long totalVertexRows(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(TOTAL_VERTEX_ROWS_SQL)) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                return resultSet.next() ? resultSet.getLong(1) : 0L;
            }
        }
    }

    private static Map<GroupKey, CompactLoop> compactFilledUnitLoops(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(COMPACT_FILLED_UNIT_LOOPS_SQL)) {
            statement.setLong(1, mapId);
            statement.setLong(2, mapId);
            statement.setInt(3, LOOP_SEPARATOR_COORDINATE);
            statement.setInt(4, LOOP_SEPARATOR_COORDINATE);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<GroupKey, CompactLoop> result = new LinkedHashMap<>();
                while (resultSet.next()) {
                    CompactLoop loop = compactLoop(resultSet);
                    if (loop.compactible()) {
                        result.put(new GroupKey(loop.clusterId(), loop.level()), loop);
                    }
                }
                return Map.copyOf(result);
            }
        }
    }

    private static CompactLoop compactLoop(ResultSet resultSet) throws SQLException {
        return new CompactLoop(
                resultSet.getLong(COLUMN_CLUSTER_ID),
                resultSet.getInt(COLUMN_LEVEL_Z),
                resultSet.getLong("loop_count"),
                resultSet.getLong("distinct_cell_count"),
                resultSet.getInt("min_x"),
                resultSet.getInt("max_x"),
                resultSet.getInt("min_y"),
                resultSet.getInt("max_y"),
                resultSet.getLong("row_count"));
    }

    private static Map<Long, List<DungeonRoomClusterVertexRecord>> groupedCompactRecords(
            Map<GroupKey, CompactLoop> compactLoops
    ) {
        Map<Long, List<DungeonRoomClusterVertexRecord>> records = new LinkedHashMap<>();
        for (CompactLoop loop : compactLoops.values()) {
            records.computeIfAbsent(loop.clusterId(), ignored -> new ArrayList<>())
                    .addAll(compactRecords(loop));
        }
        return DungeonSqliteStatementSupport.copyGrouped(records);
    }

    private static List<DungeonRoomClusterVertexRecord> compactRecords(CompactLoop loop) {
        return List.of(
                vertex(loop, 0, loop.minX(), loop.minY()),
                vertex(loop, 1, loop.maxX() + 1, loop.minY()),
                vertex(loop, 2, loop.maxX() + 1, loop.maxY() + 1),
                vertex(loop, 3, loop.minX(), loop.maxY() + 1));
    }

    private static DungeonRoomClusterVertexRecord vertex(CompactLoop loop, int index, int x, int y) {
        return new DungeonRoomClusterVertexRecord(loop.clusterId(), loop.level(), index, x, y);
    }

    private static Map<Long, List<DungeonRoomClusterVertexRecord>> loadFull(
            Connection connection,
            long mapId
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(LOAD_VERTICES_SQL)) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                Map<Long, List<DungeonRoomClusterVertexRecord>> records = new LinkedHashMap<>();
                while (resultSet.next()) {
                    long clusterId = resultSet.getLong(COLUMN_CLUSTER_ID);
                    records.computeIfAbsent(clusterId, ignored -> new ArrayList<>())
                            .add(new DungeonRoomClusterVertexRecord(
                                    clusterId,
                                    resultSet.getInt(COLUMN_LEVEL_Z),
                                    resultSet.getInt("vertex_index"),
                                    resultSet.getInt("relative_x"),
                                    resultSet.getInt("relative_y")));
                }
                return DungeonSqliteStatementSupport.copyGrouped(records);
            }
        }
    }

    private record GroupKey(long clusterId, int level) {
    }

    private record CompactLoop(
            long clusterId,
            int level,
            long loopCount,
            long distinctCellCount,
            int minX,
            int maxX,
            int minY,
            int maxY,
            long rowCount
    ) {

        boolean compactible() {
            long width = (long) maxX - minX + 1L;
            long height = (long) maxY - minY + 1L;
            long expectedCells = width * height;
            return rowCount == loopCount * 5L
                    && loopCount == distinctCellCount
                    && loopCount == expectedCells;
        }
    }
}
