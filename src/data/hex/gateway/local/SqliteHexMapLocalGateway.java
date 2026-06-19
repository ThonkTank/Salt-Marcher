package src.data.hex.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import src.data.hex.model.HexMapRecord;
import src.data.hex.model.HexMapSnapshotRecord;
import src.data.hex.model.HexMarkerRecord;

public final class SqliteHexMapLocalGateway {

    private final HexSqliteConnectionFactory connectionFactory;
    private final HexSqliteSchemaMigrator schemaMigrator;

    public SqliteHexMapLocalGateway() {
        this(new HexSqliteConnectionFactory(), new HexSqliteSchemaMigrator());
    }

    SqliteHexMapLocalGateway(
            HexSqliteConnectionFactory connectionFactory,
            HexSqliteSchemaMigrator schemaMigrator
    ) {
        this.connectionFactory = Objects.requireNonNull(connectionFactory, "connectionFactory");
        this.schemaMigrator = Objects.requireNonNull(schemaMigrator, "schemaMigrator");
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
        Connection connection = connectionFactory.openConnection();
        try {
            schemaMigrator.ensureSchema(connection);
            return connection;
        } catch (SQLException exception) {
            connection.close();
            throw exception;
        }
    }
}
