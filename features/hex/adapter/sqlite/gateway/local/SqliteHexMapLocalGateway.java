package features.hex.adapter.sqlite.gateway.local;

import features.hex.adapter.sqlite.model.HexMapRecord;
import features.hex.adapter.sqlite.model.HexMapSnapshotRecord;
import features.hex.adapter.sqlite.model.HexMarkerRecord;
import platform.persistence.FeatureStoreDefinition;
import platform.persistence.FeatureStoreHandle;
import platform.persistence.SqliteMigration;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

public final class SqliteHexMapLocalGateway {

    private final FeatureStoreHandle connections;

    public static FeatureStoreDefinition storeDefinition() {
        HexSqliteSchemaMigrator schemaMigrator = new HexSqliteSchemaMigrator();
        return FeatureStoreDefinition.of(
                "hex",
                new SqliteMigration(1, schemaMigrator::ensureSchema));
    }

    public SqliteHexMapLocalGateway(FeatureStoreHandle store) {
        this.connections = FeatureStoreHandle.requireOwner(store, "hex");
    }

    public Optional<HexMapSnapshotRecord> loadSelected() {
        try (Connection connection = openReadyConnection()) {
            return SqliteHexMapReader.loadSelected(connection);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load selected Hex map from SQLite.", exception);
        }
    }

    public Optional<HexMapSnapshotRecord> loadById(long mapId) {
        try (Connection connection = openReadyConnection()) {
            return SqliteHexMapReader.loadById(connection, mapId);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load Hex map from SQLite.", exception);
        }
    }

    public Optional<HexMapRecord> loadSummaryById(long mapId) {
        try (Connection connection = openReadyConnection()) {
            return SqliteHexMapReader.loadSummaryById(connection, mapId);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load Hex map summary from SQLite.", exception);
        }
    }

    public List<HexMapRecord> listMaps() {
        try (Connection connection = openReadyConnection()) {
            return SqliteHexMapReader.listMaps(connection);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to list Hex maps from SQLite.", exception);
        }
    }

    public HexMapSnapshotRecord save(HexMapSnapshotRecord snapshot) {
        Objects.requireNonNull(snapshot, "snapshot");
        try (Connection connection = openReadyConnection()) {
            return SqliteHexMapWriter.saveSnapshot(connection, snapshot);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to save Hex map to SQLite.", exception);
        }
    }

    public HexMapSnapshotRecord saveTerrain(long mapId, int q, int r, String terrain) {
        try (Connection connection = openReadyConnection()) {
            SqliteHexMapWriter.saveTerrain(connection, mapId, q, r, terrain);
            return SqliteHexMapReader.requireMap(connection, mapId);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to save Hex terrain override to SQLite.", exception);
        }
    }

    public HexMapSnapshotRecord saveMarker(long mapId, HexMarkerRecord marker) {
        Objects.requireNonNull(marker, "marker");
        try (Connection connection = openReadyConnection()) {
            SqliteHexMapWriter.saveMarker(connection, marker);
            return SqliteHexMapReader.requireMap(connection, mapId);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to save Hex marker to SQLite.", exception);
        }
    }

    public long nextMapId() {
        try (Connection connection = openReadyConnection()) {
            return SqliteHexMapReader.nextMapId(connection);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to allocate next Hex map id from SQLite.", exception);
        }
    }

    public long nextMarkerId(long mapId) {
        try (Connection connection = openReadyConnection()) {
            return SqliteHexMapReader.nextMarkerId(connection, mapId);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to allocate next Hex marker id from SQLite.", exception);
        }
    }

    public void setSelectedMap(long mapId) {
        try (Connection connection = openReadyConnection()) {
            SqliteHexMapWriter.setSelectedMap(connection, mapId);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to update selected Hex map pointer in SQLite.", exception);
        }
    }

    private Connection openReadyConnection() throws SQLException {
        return connections.openConnection();
    }
}
