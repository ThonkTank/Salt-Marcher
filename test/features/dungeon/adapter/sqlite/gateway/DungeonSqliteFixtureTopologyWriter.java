package features.dungeon.adapter.sqlite.gateway;

import org.jspecify.annotations.Nullable;
import features.dungeon.adapter.sqlite.model.DungeonCorridorRecord;
import features.dungeon.adapter.sqlite.model.DungeonClusterBoundaryRecord;
import features.dungeon.adapter.sqlite.model.DungeonMapRecord;
import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import features.dungeon.adapter.sqlite.model.DungeonRoomClusterRecord;
import features.dungeon.adapter.sqlite.model.DungeonTopologyElementRecord;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

final class DungeonSqliteFixtureTopologyWriter {
    private static final String ELEMENT_KIND_EMPTY = "EMPTY";
    private static final String ELEMENT_KIND_DOOR = "DOOR";
    private static final String ELEMENT_KIND_WALL = "WALL";

    private DungeonSqliteFixtureTopologyWriter() {
    }

    static void persist(Connection connection, DungeonMapRecord record) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                "DELETE FROM " + DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE + " WHERE dungeon_map_id=?")) {
            delete.setLong(1, record.mapId());
            delete.executeUpdate();
        }
        Set<Long> clusterIds = ids(record.roomClusters().stream().map(DungeonRoomClusterRecord::clusterId).toList());
        Set<Long> corridorIds = ids(record.corridors().stream().map(DungeonCorridorRecord::corridorId).toList());
        Set<TopologyElementKey> openOnlyBoundaryKeys = openOnlyBoundaryKeys(record.roomClusters());
        try (PreparedStatement insert = connection.prepareStatement(
                "INSERT INTO " + DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE
                        + "(dungeon_map_id, element_kind, element_id, cluster_id, corridor_id, label, sort_order)"
                        + " VALUES(?,?,?,?,?,?,?)")) {
            int sortOrder = 0;
            for (DungeonTopologyElementRecord element : record.topologyElements()) {
                if (element.elementId() <= 0L
                        || ELEMENT_KIND_EMPTY.equals(element.elementKind())
                        || openOnlyBoundaryKeys.contains(TopologyElementKey.from(element))) {
                    continue;
                }
                insert.setLong(1, record.mapId());
                insert.setString(2, element.elementKind());
                insert.setLong(3, element.elementId());
                DungeonSqliteStatementSupport.setNullableLong(insert, 4, retainedId(element.clusterId(), clusterIds));
                DungeonSqliteStatementSupport.setNullableLong(insert, 5, retainedId(element.corridorId(), corridorIds));
                insert.setString(6, element.label());
                insert.setInt(7, sortOrder);
                sortOrder++;
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static Set<TopologyElementKey> openOnlyBoundaryKeys(List<DungeonRoomClusterRecord> clusters) {
        Set<TopologyElementKey> openKeys = new LinkedHashSet<>();
        Set<TopologyElementKey> renderableKeys = new LinkedHashSet<>();
        for (DungeonRoomClusterRecord cluster : clusters == null ? List.<DungeonRoomClusterRecord>of() : clusters) {
            for (DungeonClusterBoundaryRecord boundary : cluster.boundaries()) {
                long elementId = boundaryStableId(boundary);
                if (openBoundary(boundary)) {
                    openKeys.add(new TopologyElementKey(ELEMENT_KIND_WALL, elementId));
                } else {
                    renderableKeys.add(new TopologyElementKey(boundaryElementKind(boundary), elementId));
                }
            }
        }
        openKeys.removeAll(renderableKeys);
        return Set.copyOf(openKeys);
    }

    private static long boundaryStableId(DungeonClusterBoundaryRecord boundary) {
        Edge edge = Edge.sideOf(
                new Cell(boundary.cellX(), boundary.cellY(), boundary.levelZ()),
                Direction.parse(boundary.edgeDirection()));
        return DungeonBoundaryKey.from(edge).stableId();
    }

    private static boolean openBoundary(DungeonClusterBoundaryRecord boundary) {
        String edgeType = boundary.edgeType() == null ? "" : boundary.edgeType().trim().toUpperCase(Locale.ROOT);
        return "OPEN".equals(edgeType);
    }

    private static String boundaryElementKind(DungeonClusterBoundaryRecord boundary) {
        String edgeType = boundary.edgeType() == null ? "" : boundary.edgeType().trim().toUpperCase(Locale.ROOT);
        return ELEMENT_KIND_DOOR.equals(edgeType) ? ELEMENT_KIND_DOOR : ELEMENT_KIND_WALL;
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

    private record TopologyElementKey(String elementKind, long elementId) {
        TopologyElementKey {
            elementKind = elementKind == null || elementKind.isBlank()
                    ? ELEMENT_KIND_EMPTY
                    : elementKind.trim().toUpperCase(Locale.ROOT);
        }

        static TopologyElementKey from(DungeonTopologyElementRecord element) {
            return new TopologyElementKey(element.elementKind(), element.elementId());
        }
    }

}
