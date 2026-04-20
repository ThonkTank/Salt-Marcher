package src.data.creatures.gateway.local;

import src.domain.creatures.catalog.port.CreatureCatalogLookup;

import java.sql.Connection;
import java.sql.SQLException;

final class CreatureFilterTempTables {

    private CreatureFilterTempTables() {
    }

    static void prepareCatalogFilters(
            Connection connection,
            CreatureCatalogLookup.CatalogSearchSpec spec
    ) throws SQLException {
        CreatureFilterTempTableSchema.createTempTables(connection);
        clearFilters(connection);
        try {
            CreatureFilterTempTableValues.insertSizes(connection, spec.sizes());
            CreatureFilterTempTableValues.insertTypes(connection, spec.types());
            CreatureFilterTempTableValues.insertAlignments(connection, spec.alignments());
            CreatureFilterTempTableValues.insertSubtypes(connection, spec.subtypes());
            CreatureFilterTempTableValues.insertBiomes(connection, spec.biomes());
        } catch (SQLException exception) {
            clearFilters(connection);
            throw exception;
        }
    }

    static void prepareEncounterFilters(
            Connection connection,
            CreatureCatalogLookup.EncounterCandidateSpec spec
    ) throws SQLException {
        CreatureFilterTempTableSchema.createTempTables(connection);
        clearFilters(connection);
        try {
            CreatureFilterTempTableValues.insertTypes(connection, spec.types());
            CreatureFilterTempTableValues.insertSubtypes(connection, spec.subtypes());
            CreatureFilterTempTableValues.insertBiomes(connection, spec.biomes());
        } catch (SQLException exception) {
            clearFilters(connection);
            throw exception;
        }
    }

    static void clearFilters(Connection connection) throws SQLException {
        CreatureFilterTempTableSchema.clearTempTables(connection);
    }
}
