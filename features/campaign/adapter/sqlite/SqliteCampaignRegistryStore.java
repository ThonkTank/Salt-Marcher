package features.campaign.adapter.sqlite;

import features.campaign.api.CampaignActivation;
import features.campaign.api.CampaignId;
import features.campaign.api.CampaignSnapshot;
import features.campaign.application.CampaignRegistryStore;
import features.campaign.application.CampaignRegistryStoreFailure;
import features.campaign.domain.CampaignName;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import platform.persistence.FeatureStoreHandle;

/** SQLite persistence for the installation-owned Campaign registry. */
public final class SqliteCampaignRegistryStore implements CampaignRegistryStore {

    private final FeatureStoreHandle store;

    public SqliteCampaignRegistryStore(FeatureStoreHandle store) {
        this.store = FeatureStoreHandle.requireOwner(store, CampaignRegistrySchema.OWNER);
    }

    @Override
    public PointerCommitAttempt registerAndCommitActivePointer(
            CampaignId campaignId,
            CampaignName name,
            long expectedGeneration) {
        return access(() -> registerAndCommitSql(campaignId, name, expectedGeneration));
    }

    private PointerCommitAttempt registerAndCommitSql(
            CampaignId campaignId,
            CampaignName name,
            long expectedGeneration) throws SQLException {
        CampaignId safeCampaignId = Objects.requireNonNull(campaignId, "campaignId");
        CampaignName safeName = Objects.requireNonNull(name, "name");
        try (Connection connection = store.openConnection()) {
            boolean previousAutoCommit = connection.getAutoCommit();
            connection.setAutoCommit(false);
            try {
                try (var statement = connection.prepareStatement("""
                        INSERT INTO campaign_registry_campaigns(campaign_id, name)
                        VALUES(?, ?)
                        """)) {
                    statement.setString(1, safeCampaignId.value().toString());
                    statement.setString(2, safeName.value());
                    statement.executeUpdate();
                }
                PointerCommitAttempt attempt = commitPointer(
                        connection,
                        safeCampaignId,
                        expectedGeneration);
                if (attempt.status() == PointerCommitAttempt.Status.COMMITTED) {
                    connection.commit();
                } else {
                    connection.rollback();
                }
                return attempt;
            } catch (SQLException | RuntimeException failure) {
                rollback(connection, failure);
                throw failure;
            } finally {
                connection.setAutoCommit(previousAutoCommit);
            }
        }
    }

    @Override
    public List<CampaignSnapshot> list() {
        return access(this::listSql);
    }

    private List<CampaignSnapshot> listSql() throws SQLException {
        try (Connection connection = store.openConnection();
                var statement = connection.prepareStatement("""
                        SELECT campaign_id, name
                        FROM campaign_registry_campaigns
                        ORDER BY name COLLATE NOCASE, campaign_id
                        """);
                ResultSet result = statement.executeQuery()) {
            List<CampaignSnapshot> campaigns = new ArrayList<>();
            while (result.next()) {
                campaigns.add(toCampaign(result));
            }
            return List.copyOf(campaigns);
        }
    }

    @Override
    public Optional<CampaignSnapshot> read(CampaignId campaignId) {
        return access(() -> readSql(campaignId));
    }

    private Optional<CampaignSnapshot> readSql(CampaignId campaignId) throws SQLException {
        Objects.requireNonNull(campaignId, "campaignId");
        try (Connection connection = store.openConnection()) {
            return read(connection, campaignId);
        }
    }

    @Override
    public CampaignActivation active() {
        return access(this::activeSql);
    }

    private CampaignActivation activeSql() throws SQLException {
        try (Connection connection = store.openConnection()) {
            return readActivation(connection);
        }
    }

    @Override
    public PointerCommitAttempt commitActivePointer(
            CampaignId campaignId,
            long expectedGeneration) {
        return access(() -> commitActivePointerSql(campaignId, expectedGeneration));
    }

    private PointerCommitAttempt commitActivePointerSql(
            CampaignId campaignId,
            long expectedGeneration)
            throws SQLException {
        Objects.requireNonNull(campaignId, "campaignId");
        try (Connection connection = store.openConnection()) {
            boolean previousAutoCommit = connection.getAutoCommit();
            connection.setAutoCommit(false);
            try {
                PointerCommitAttempt attempt = commitPointer(
                        connection,
                        campaignId,
                        expectedGeneration);
                connection.commit();
                return attempt;
            } catch (SQLException | RuntimeException failure) {
                rollback(connection, failure);
                if (failure instanceof SQLException sqlFailure) {
                    throw sqlFailure;
                }
                throw new SQLException("Campaign activation failed", failure);
            } finally {
                connection.setAutoCommit(previousAutoCommit);
            }
        }
    }

    private static PointerCommitAttempt commitPointer(
            Connection connection,
            CampaignId campaignId,
            long expectedGeneration) throws SQLException {
        long nextGeneration = Math.incrementExact(expectedGeneration);
        boolean committed = expectedGeneration == 0L
                ? insertInitialPointer(connection, campaignId)
                : updatePointer(
                        connection,
                        campaignId,
                        expectedGeneration,
                        nextGeneration);
        if (committed) {
            CampaignSnapshot target = read(connection, campaignId)
                    .orElseThrow(() -> new SQLException(
                            "Committed Campaign pointer target is missing"));
            return new PointerCommitAttempt(
                    PointerCommitAttempt.Status.COMMITTED,
                    new CampaignActivation(Optional.of(target), nextGeneration));
        }

        CampaignActivation current = readActivation(connection);
        if (current.generation() != expectedGeneration) {
            return new PointerCommitAttempt(
                    PointerCommitAttempt.Status.STALE_GENERATION,
                    current);
        }
        if (read(connection, campaignId).isEmpty()) {
            return new PointerCommitAttempt(
                    PointerCommitAttempt.Status.CAMPAIGN_NOT_FOUND,
                    current);
        }
        throw new SQLException("Campaign pointer compare-and-set made no progress");
    }

    private static Optional<CampaignSnapshot> read(
            Connection connection,
            CampaignId campaignId) throws SQLException {
        try (var statement = connection.prepareStatement("""
                SELECT campaign_id, name
                FROM campaign_registry_campaigns
                WHERE campaign_id = ?
                """)) {
            statement.setString(1, campaignId.value().toString());
            try (ResultSet result = statement.executeQuery()) {
                return result.next() ? Optional.of(toCampaign(result)) : Optional.empty();
            }
        }
    }

    private static CampaignActivation readActivation(Connection connection) throws SQLException {
        try (var statement = connection.prepareStatement("""
                SELECT campaign_id, generation
                FROM campaign_registry_activation
                WHERE singleton = 1
                """);
                ResultSet result = statement.executeQuery()) {
            if (!result.next()) {
                return CampaignActivation.none();
            }
            CampaignId campaignId = parseId(result.getString("campaign_id"));
            long generation = result.getLong("generation");
            CampaignSnapshot campaign = read(connection, campaignId)
                    .orElseThrow(() -> new SQLException(
                            "Active Campaign is missing from the installation registry"));
            return new CampaignActivation(Optional.of(campaign), generation);
        }
    }

    private static boolean insertInitialPointer(
            Connection connection,
            CampaignId campaignId) throws SQLException {
        try (var statement = connection.prepareStatement("""
                INSERT INTO campaign_registry_activation(singleton, campaign_id, generation)
                SELECT 1, ?, 1
                WHERE EXISTS (
                    SELECT 1 FROM campaign_registry_campaigns WHERE campaign_id = ?
                )
                ON CONFLICT(singleton) DO NOTHING
                """)) {
            statement.setString(1, campaignId.value().toString());
            statement.setString(2, campaignId.value().toString());
            return statement.executeUpdate() == 1;
        }
    }

    private static boolean updatePointer(
            Connection connection,
            CampaignId campaignId,
            long expectedGeneration,
            long nextGeneration) throws SQLException {
        try (var statement = connection.prepareStatement("""
                UPDATE campaign_registry_activation
                SET campaign_id = ?, generation = ?
                WHERE singleton = 1
                  AND generation = ?
                  AND EXISTS (
                      SELECT 1 FROM campaign_registry_campaigns WHERE campaign_id = ?
                  )
                """)) {
            statement.setString(1, campaignId.value().toString());
            statement.setLong(2, nextGeneration);
            statement.setLong(3, expectedGeneration);
            statement.setString(4, campaignId.value().toString());
            return statement.executeUpdate() == 1;
        }
    }

    private static CampaignSnapshot toCampaign(ResultSet result) throws SQLException {
        return new CampaignSnapshot(
                parseId(result.getString("campaign_id")),
                new CampaignName(result.getString("name")).value());
    }

    private static CampaignId parseId(String value) throws SQLException {
        try {
            return new CampaignId(UUID.fromString(value));
        } catch (NullPointerException | IllegalArgumentException invalidIdentity) {
            throw new SQLException("Campaign registry contains an invalid identity", invalidIdentity);
        }
    }

    private static void rollback(Connection connection, Throwable failure) throws SQLException {
        try {
            connection.rollback();
        } catch (SQLException rollbackFailure) {
            if (failure == null) {
                throw rollbackFailure;
            }
            failure.addSuppressed(rollbackFailure);
        }
    }

    private static <T> T access(SqlSupplier<T> operation) {
        try {
            return operation.get();
        } catch (SQLException | RuntimeException failure) {
            throw new CampaignRegistryStoreFailure(failure);
        }
    }

    @FunctionalInterface
    private interface SqlSupplier<T> {
        T get() throws SQLException;
    }
}
