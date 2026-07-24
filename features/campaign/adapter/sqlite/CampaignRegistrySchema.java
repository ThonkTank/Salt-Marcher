package features.campaign.adapter.sqlite;

import java.sql.Connection;
import java.sql.SQLException;
import platform.persistence.FeatureStoreDefinition;
import platform.persistence.SqliteMigration;

/** Installation-owned Campaign registry schema definition. */
public final class CampaignRegistrySchema {

    public static final String OWNER = "campaign-registry";
    static final String CAMPAIGNS_TABLE = "campaign_registry_campaigns";
    static final String ACTIVATION_TABLE = "campaign_registry_activation";

    private CampaignRegistrySchema() { }

    public static FeatureStoreDefinition definition() {
        return FeatureStoreDefinition.validated(
                OWNER,
                CampaignRegistrySchema::validate,
                new SqliteMigration(1, CampaignRegistrySchema::migrateV1));
    }

    private static void migrateV1(Connection connection) throws SQLException {
        try (var statement = connection.createStatement()) {
            statement.execute("""
                    CREATE TABLE campaign_registry_campaigns (
                        campaign_id TEXT PRIMARY KEY,
                        name TEXT NOT NULL CHECK(length(trim(name)) > 0)
                    )
                    """);
            statement.execute("""
                    CREATE TABLE campaign_registry_activation (
                        singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
                        campaign_id TEXT NOT NULL,
                        generation INTEGER NOT NULL CHECK(generation > 0),
                        FOREIGN KEY(campaign_id)
                            REFERENCES campaign_registry_campaigns(campaign_id)
                            ON DELETE RESTRICT
                    )
                    """);
        }
    }

    private static void validate(Connection connection) throws SQLException {
        requireTable(connection, CAMPAIGNS_TABLE);
        requireTable(connection, ACTIVATION_TABLE);
    }

    private static void requireTable(Connection connection, String table) throws SQLException {
        try (var statement = connection.prepareStatement(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")) {
            statement.setString(1, table);
            try (var result = statement.executeQuery()) {
                if (!result.next()) {
                    throw new SQLException("Campaign registry table is missing: " + table);
                }
            }
        }
    }
}
