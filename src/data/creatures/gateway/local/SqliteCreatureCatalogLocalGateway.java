package src.data.creatures.gateway.local;

import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteConnectionSource;
import platform.persistence.SqliteDatabase;
import platform.persistence.SqliteMigration;
import org.jspecify.annotations.Nullable;
import src.data.creatures.model.CreatureCatalogPageRecord;
import src.data.creatures.model.CreatureCatalogSearchCriteriaRecord;
import src.data.creatures.model.CreatureDetailRecord;
import src.data.creatures.model.CreatureFilterValuesRecord;
import src.data.creatures.model.EncounterCandidateCriteriaRecord;
import src.data.creatures.model.EncounterCandidateRecord;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;

/**
 * SQLite-backed local gateway for read-only creature catalog access.
 */
public final class SqliteCreatureCatalogLocalGateway {

    private final SqliteConnectionSource connections;
    private final CreatureCatalogFilterValuesSqliteStore filterValuesStore = new CreatureCatalogFilterValuesSqliteStore();
    private final CreatureCatalogSearchSqliteStore catalogSearchStore = new CreatureCatalogSearchSqliteStore();
    private final CreatureDetailSqliteStore creatureDetailStore = new CreatureDetailSqliteStore();
    private final EncounterCandidateSqliteStore encounterCandidateStore = new EncounterCandidateSqliteStore();

    public SqliteCreatureCatalogLocalGateway() {
        this(SqliteDatabase.defaultDatabase(
                SqliteDatabase.DEFAULT_DATABASE_FILE_NAME,
                NoopDiagnostics.INSTANCE));
    }

    public SqliteCreatureCatalogLocalGateway(SqliteDatabase database) {
        CreaturesSchemaMigrator schemaMigrator = new CreaturesSchemaMigrator();
        this.connections = Objects.requireNonNull(database, "database").connections(
                "creatures",
                new SqliteMigration(1, schemaMigrator::ensureSchema));
    }

    public CreatureFilterValuesRecord loadFilterValues() {
        try (Connection connection = openReadyConnection()) {
            return filterValuesStore.loadFilterValues(connection);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load creature filter values from SQLite.", exception);
        }
    }

    public CreatureCatalogPageRecord searchCatalog(CreatureCatalogSearchCriteriaRecord spec) {
        Objects.requireNonNull(spec, "spec");
        try (Connection connection = openReadyConnection()) {
            return catalogSearchStore.searchCatalog(connection, spec);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to search creatures in SQLite.", exception);
        }
    }

    public @Nullable CreatureDetailRecord loadCreatureDetail(long creatureId) {
        if (creatureId <= 0) {
            return null;
        }
        try (Connection connection = openReadyConnection()) {
            return creatureDetailStore.loadCreatureDetail(connection, creatureId);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load creature detail from SQLite.", exception);
        }
    }

    public List<EncounterCandidateRecord> loadEncounterCandidates(EncounterCandidateCriteriaRecord spec) {
        Objects.requireNonNull(spec, "spec");
        try (Connection connection = openReadyConnection()) {
            return encounterCandidateStore.loadEncounterCandidates(connection, spec);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load encounter-ready creatures from SQLite.", exception);
        }
    }

    private Connection openReadyConnection() throws SQLException {
        return connections.openConnection();
    }
}
