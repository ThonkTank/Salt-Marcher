package features.campaign.adapter.sqlite;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import platform.persistence.FeatureStoreDefinition;
import platform.persistence.SqliteMigration;
import platform.persistence.SqliteSchemaValidator;

/** Installation-owned Campaign registry schema definition. */
public final class CampaignRegistrySchema {

    public static final String OWNER = "campaign-registry";
    static final String CREATE_CAMPAIGNS_TABLE_SQL = """
            CREATE TABLE campaign_registry_campaigns (
                campaign_id TEXT PRIMARY KEY,
                name TEXT NOT NULL CHECK(length(trim(name)) > 0)
            )
            """;
    static final String CREATE_ACTIVATION_TABLE_SQL = """
            CREATE TABLE campaign_registry_activation (
                singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
                campaign_id TEXT NOT NULL,
                generation INTEGER NOT NULL CHECK(generation > 0),
                FOREIGN KEY(campaign_id)
                    REFERENCES campaign_registry_campaigns(campaign_id)
                    ON DELETE RESTRICT
            )
            """;
    static final List<String> CREATE_TABLE_SQL = List.of(
            CREATE_CAMPAIGNS_TABLE_SQL,
            CREATE_ACTIVATION_TABLE_SQL);
    static final List<String> CREATE_INDEX_SQL = List.of();

    private CampaignRegistrySchema() { }

    public static FeatureStoreDefinition definition() {
        SqliteSchemaValidator targetSchema = SqliteSchemaValidator.exactSchema(
                CREATE_TABLE_SQL,
                CREATE_INDEX_SQL,
                List.of("campaign_registry_"),
                List.of());
        return FeatureStoreDefinition.validated(
                OWNER,
                targetSchema,
                new SqliteMigration(1, CampaignRegistrySchema::initializeCurrentTarget));
    }

    private static void initializeCurrentTarget(Connection connection) throws SQLException {
        requireEmptyOwnerNamespace(connection);
        try (Statement statement = connection.createStatement()) {
            for (String createTableSql : CREATE_TABLE_SQL) {
                statement.execute(createTableSql);
            }
        }
    }

    private static void requireEmptyOwnerNamespace(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(
                     "SELECT name FROM sqlite_master "
                             + "WHERE type IN ('table', 'index', 'view', 'trigger') "
                             + "AND name GLOB 'campaign_registry_*' LIMIT 1")) {
            if (result.next()) {
                throw new SQLException("Campaign registry owner namespace is not empty.");
            }
        }
    }
}
