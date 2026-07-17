package features.dungeon.adapter.sqlite.gateway;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.Set;
import features.dungeon.adapter.sqlite.model.DungeonFeatureMarkerRecord;
import features.dungeon.adapter.sqlite.model.DungeonMapRecord;
import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;

final class DungeonSqliteFeatureMarkerPersistence {

    private static final String INSERT_INTO = "INSERT INTO ";

    private DungeonSqliteFeatureMarkerPersistence() {
    }

    static void persist(Connection connection, DungeonMapRecord record) throws SQLException {
        Set<Long> markerIds = new LinkedHashSet<>();
        for (DungeonFeatureMarkerRecord marker : record.featureMarkers()) {
            markerIds.add(marker.markerId());
            upsertFeatureMarker(connection, marker);
        }
        DungeonSqliteRetainedIdCleanup.deleteObsoleteFeatureMarkers(connection, record.mapId(), markerIds);
    }

    static void persistChange(Connection connection, DungeonMapRecord before, DungeonMapRecord after)
            throws SQLException {
        for (DungeonFeatureMarkerRecord marker : DungeonSqliteChangedRecords.changed(
                before.featureMarkers(), after.featureMarkers(), DungeonFeatureMarkerRecord::markerId)) {
            upsertFeatureMarker(connection, marker);
        }
        DungeonSqliteRetainedIdCleanup.deleteObsoleteFeatureMarkers(
                connection,
                after.mapId(),
                DungeonSqliteChangedRecords.identities(
                        after.featureMarkers(), DungeonFeatureMarkerRecord::markerId));
    }

    private static void upsertFeatureMarker(
            Connection connection,
            DungeonFeatureMarkerRecord marker
    ) throws SQLException {
        try (PreparedStatement update = connection.prepareStatement(
                "UPDATE " + DungeonPersistenceSchema.FEATURE_MARKERS_TABLE
                        + " SET marker_kind=?, cell_x=?, cell_y=?, level_z=?, label=?, description=?"
                        + " WHERE feature_marker_id=? AND dungeon_map_id=?")) {
            bindFeatureMarker(update, marker, false);
            if (update.executeUpdate() > 0) {
                return;
            }
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO + DungeonPersistenceSchema.FEATURE_MARKERS_TABLE
                        + "(feature_marker_id, dungeon_map_id, marker_kind, cell_x, cell_y, level_z, label, description)"
                        + " VALUES(?,?,?,?,?,?,?,?)")) {
            bindFeatureMarker(insert, marker, true);
            insert.executeUpdate();
        }
    }

    private static void bindFeatureMarker(
            PreparedStatement statement,
            DungeonFeatureMarkerRecord marker,
            boolean insert
    ) throws SQLException {
        int index = 1;
        if (insert) {
            statement.setLong(index, marker.markerId());
            index++;
            statement.setLong(index, marker.mapId());
            index++;
        }
        statement.setString(index, marker.markerKind());
        index++;
        statement.setInt(index, marker.cellX());
        index++;
        statement.setInt(index, marker.cellY());
        index++;
        statement.setInt(index, marker.levelZ());
        index++;
        statement.setString(index, marker.label());
        index++;
        statement.setString(index, marker.description());
        index++;
        if (!insert) {
            statement.setLong(index, marker.markerId());
            index++;
            statement.setLong(index, marker.mapId());
        }
    }
}
