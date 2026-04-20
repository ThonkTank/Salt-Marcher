package src.data.creatures.gateway.local;

import org.jspecify.annotations.Nullable;
import src.data.creatures.model.CreatureCatalogPageRecord;
import src.data.creatures.model.CreatureDetailRecord;
import src.data.creatures.model.CreatureFilterValuesRecord;
import src.data.creatures.model.EncounterCandidateRecord;
import src.domain.creatures.catalog.port.CreatureCatalogLookup;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;

/**
 * SQLite-backed local gateway for read-only creature catalog access.
 */
public final class SqliteCreatureCatalogLocalGateway {

    private final CreaturesSqliteConnectionFactory connectionFactory;
    private final CreaturesSchemaMigrator schemaMigrator;
    private final CreatureCatalogFilterValuesSqliteStore filterValuesStore = new CreatureCatalogFilterValuesSqliteStore();
    private final CreatureCatalogSearchSqliteStore catalogSearchStore = new CreatureCatalogSearchSqliteStore();
    private final CreatureDetailSqliteStore creatureDetailStore = new CreatureDetailSqliteStore();
    private final EncounterCandidateSqliteStore encounterCandidateStore = new EncounterCandidateSqliteStore();

    public SqliteCreatureCatalogLocalGateway() {
        this(new CreaturesSqliteConnectionFactory(), new CreaturesSchemaMigrator());
    }

    SqliteCreatureCatalogLocalGateway(
            CreaturesSqliteConnectionFactory connectionFactory,
            CreaturesSchemaMigrator schemaMigrator
    ) {
        this.connectionFactory = Objects.requireNonNull(connectionFactory, "connectionFactory");
        this.schemaMigrator = Objects.requireNonNull(schemaMigrator, "schemaMigrator");
    }

    public CreatureFilterValuesRecord loadFilterValues() {
        try (Connection connection = openReadyConnection()) {
            return filterValuesStore.loadFilterValues(connection);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load creature filter values from SQLite.", exception);
        }
    }

    public CreatureCatalogPageRecord searchCatalog(CreatureCatalogLookup.CatalogSearchSpec spec) {
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

    public List<EncounterCandidateRecord> loadEncounterCandidates(CreatureCatalogLookup.EncounterCandidateSpec spec) {
        Objects.requireNonNull(spec, "spec");
        try (Connection connection = openReadyConnection()) {
            return encounterCandidateStore.loadEncounterCandidates(connection, spec);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load encounter-ready creatures from SQLite.", exception);
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
