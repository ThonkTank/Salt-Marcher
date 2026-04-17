package src.data.party.datasource.local;

import src.data.party.model.PartyCharacterRecord;
import src.data.party.model.PartyPersistenceSchema;
import src.data.party.model.PartyRosterRecord;
import src.domain.party.valueobject.PartyXpTables;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * SQLite-backed local storage for the party roster.
 */
public final class SqlitePartyLocalDataSource {

    private static final String APP_DATA_DIR_NAME = "salt-marcher";
    private static final String DB_FILE_NAME = PartyPersistenceSchema.DATABASE_FILE_NAME;
    private static final Path DATABASE_PATH = resolveDatabasePath();
    private static final String URL = "jdbc:sqlite:" + DATABASE_PATH.toAbsolutePath();

    private volatile boolean prepared;

    public PartyRosterRecord load() {
        try (Connection connection = openConnection()) {
            ensureSchema(connection);
            long nextCharacterId = loadNextCharacterId(connection);
            List<PartyCharacterRecord> characters = loadCharacters(connection);
            return new PartyRosterRecord(nextCharacterId, characters);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load party roster from SQLite.", exception);
        }
    }

    public void save(PartyRosterRecord rosterRecord) {
        Objects.requireNonNull(rosterRecord, "rosterRecord");
        try (Connection connection = openConnection()) {
            ensureSchema(connection);
            boolean previousAutoCommit = connection.getAutoCommit();
            connection.setAutoCommit(false);
            try {
                deleteMissingCharacters(connection, rosterRecord.characters());
                upsertCharacters(connection, rosterRecord.characters());
                saveNextCharacterId(connection, rosterRecord.nextCharacterId());
                connection.commit();
            } catch (SQLException exception) {
                connection.rollback();
                throw exception;
            } finally {
                connection.setAutoCommit(previousAutoCommit);
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to save party roster to SQLite.", exception);
        }
    }

    private Connection openConnection() throws SQLException {
        prepareDatabasePath();
        try {
            Class.forName("org.sqlite.JDBC");
        } catch (ClassNotFoundException exception) {
            throw new SQLException("SQLite JDBC driver not available.", exception);
        }
        Connection connection = DriverManager.getConnection(URL);
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys = ON");
            statement.execute("PRAGMA journal_mode = WAL");
        } catch (SQLException exception) {
            connection.close();
            throw exception;
        }
        return connection;
    }

    private synchronized void prepareDatabasePath() throws SQLException {
        if (prepared) {
            return;
        }
        try {
            Files.createDirectories(DATABASE_PATH.getParent());
            migrateLegacyDatabaseIfNeeded();
            prepared = true;
        } catch (Exception exception) {
            throw new SQLException("Could not prepare SQLite path " + DATABASE_PATH.toAbsolutePath(), exception);
        }
    }

    private void migrateLegacyDatabaseIfNeeded() throws Exception {
        Path legacyPath = Path.of(DB_FILE_NAME).toAbsolutePath().normalize();
        Path targetPath = DATABASE_PATH.toAbsolutePath().normalize();
        if (legacyPath.equals(targetPath) || Files.exists(targetPath) || !Files.exists(legacyPath)) {
            return;
        }
        Files.copy(legacyPath, targetPath, StandardCopyOption.COPY_ATTRIBUTES);
    }

    private static Path resolveDatabasePath() {
        String xdgDataHome = System.getenv("XDG_DATA_HOME");
        if (xdgDataHome != null && !xdgDataHome.isBlank()) {
            return Path.of(xdgDataHome, APP_DATA_DIR_NAME, DB_FILE_NAME).toAbsolutePath().normalize();
        }
        return Path.of(System.getProperty("user.home"), ".local", "share", APP_DATA_DIR_NAME, DB_FILE_NAME)
                .toAbsolutePath()
                .normalize();
    }

    private void ensureSchema(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(PartyPersistenceSchema.PLAYER_CHARACTERS.createTableSql());
            statement.execute(PartyPersistenceSchema.PARTY_ROSTER_METADATA.createTableSql());
            statement.execute(PartyPersistenceSchema.INITIALIZE_METADATA_SQL);
        }
        ensureColumn(connection, PartyPersistenceSchema.PLAYER_CHARACTERS, "player_name");
        ensureColumn(connection, PartyPersistenceSchema.PLAYER_CHARACTERS, "passive_perception");
        ensureColumn(connection, PartyPersistenceSchema.PLAYER_CHARACTERS, "ac");
        ensureColumn(connection, PartyPersistenceSchema.PLAYER_CHARACTERS, "current_xp");
        ensureColumn(connection, PartyPersistenceSchema.PLAYER_CHARACTERS, "xp_since_long_rest");
        ensureColumn(connection, PartyPersistenceSchema.PLAYER_CHARACTERS, "xp_since_short_rest");
        ensureColumn(connection, PartyPersistenceSchema.PLAYER_CHARACTERS, "in_party");
        normalizeExistingXp(connection);
        initializeNextCharacterId(connection);
    }

    private void ensureColumn(Connection connection, PartyPersistenceSchema.TableSpec table, String columnName) throws SQLException {
        PartyPersistenceSchema.ColumnSpec column = table.column(columnName);
        if (hasColumn(connection, table.name(), column.name())) {
            return;
        }
        try (Statement statement = connection.createStatement()) {
            statement.execute("ALTER TABLE " + table.name() + " ADD COLUMN " + column.name() + " " + column.definition());
        }
    }

    private boolean hasColumn(Connection connection, String tableName, String columnName) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("PRAGMA table_info(" + tableName + ")");
             ResultSet resultSet = statement.executeQuery()) {
            while (resultSet.next()) {
                if (columnName.equalsIgnoreCase(resultSet.getString("name"))) {
                    return true;
                }
            }
        }
        return false;
    }

    private void normalizeExistingXp(Connection connection) throws SQLException {
        List<long[]> updates = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement("SELECT id, level, current_xp FROM player_characters");
             ResultSet resultSet = statement.executeQuery()) {
            while (resultSet.next()) {
                long id = resultSet.getLong("id");
                int level = resultSet.getInt("level");
                int currentXp = resultSet.getInt("current_xp");
                int normalized = Math.max(PartyXpTables.minimumXpForLevel(level), currentXp);
                if (normalized != currentXp) {
                    updates.add(new long[]{id, normalized});
                }
            }
        }
        if (updates.isEmpty()) {
            return;
        }
        try (PreparedStatement update = connection.prepareStatement(
                "UPDATE player_characters SET current_xp = ? WHERE id = ?")) {
            for (long[] entry : updates) {
                update.setInt(1, (int) entry[1]);
                update.setLong(2, entry[0]);
                update.addBatch();
            }
            update.executeBatch();
        }
    }

    private void initializeNextCharacterId(Connection connection) throws SQLException {
        long nextId = queryMaxCharacterId(connection) + 1L;
        try (PreparedStatement statement = connection.prepareStatement(
                "UPDATE " + PartyPersistenceSchema.PARTY_ROSTER_METADATA.name()
                        + " SET next_character_id = MAX(next_character_id, ?) WHERE singleton_id = 1")) {
            statement.setLong(1, Math.max(1L, nextId));
            statement.executeUpdate();
        }
    }

    private long queryMaxCharacterId(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT COALESCE(MAX(id), 0) AS max_id FROM " + PartyPersistenceSchema.PLAYER_CHARACTERS.name());
             ResultSet resultSet = statement.executeQuery()) {
            return resultSet.next() ? resultSet.getLong("max_id") : 0L;
        }
    }

    private long loadNextCharacterId(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT next_character_id FROM " + PartyPersistenceSchema.PARTY_ROSTER_METADATA.name() + " WHERE singleton_id = 1");
             ResultSet resultSet = statement.executeQuery()) {
            if (resultSet.next()) {
                return Math.max(1L, resultSet.getLong("next_character_id"));
            }
        }
        long nextId = queryMaxCharacterId(connection) + 1L;
        saveNextCharacterId(connection, nextId);
        return Math.max(1L, nextId);
    }

    private List<PartyCharacterRecord> loadCharacters(Connection connection) throws SQLException {
        List<PartyCharacterRecord> characters = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT id, name, player_name, level, current_xp, xp_since_long_rest, xp_since_short_rest,"
                        + " passive_perception, ac, in_party FROM " + PartyPersistenceSchema.PLAYER_CHARACTERS.name()
                        + " ORDER BY id");
             ResultSet resultSet = statement.executeQuery()) {
            while (resultSet.next()) {
                characters.add(new PartyCharacterRecord(
                        resultSet.getLong("id"),
                        resultSet.getString("name"),
                        resultSet.getString("player_name"),
                        resultSet.getInt("level"),
                        resultSet.getInt("current_xp"),
                        resultSet.getInt("xp_since_long_rest"),
                        resultSet.getInt("xp_since_short_rest"),
                        resultSet.getInt("passive_perception"),
                        resultSet.getInt("ac"),
                        resultSet.getInt("in_party") == 1 ? "ACTIVE" : "RESERVE"));
            }
        }
        return characters;
    }

    private void deleteMissingCharacters(Connection connection, List<PartyCharacterRecord> characters) throws SQLException {
        Set<Long> idsToKeep = new HashSet<>();
        for (PartyCharacterRecord character : characters) {
            idsToKeep.add(character.id());
        }
        List<Long> idsToDelete = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement("SELECT id FROM " + PartyPersistenceSchema.PLAYER_CHARACTERS.name());
             ResultSet resultSet = statement.executeQuery()) {
            while (resultSet.next()) {
                long id = resultSet.getLong("id");
                if (!idsToKeep.contains(id)) {
                    idsToDelete.add(id);
                }
            }
        }
        try (PreparedStatement delete = connection.prepareStatement(
                "DELETE FROM " + PartyPersistenceSchema.PLAYER_CHARACTERS.name() + " WHERE id = ?")) {
            for (Long id : idsToDelete) {
                delete.setLong(1, id);
                delete.addBatch();
            }
            if (!idsToDelete.isEmpty()) {
                delete.executeBatch();
            }
        }
    }

    private void upsertCharacters(Connection connection, List<PartyCharacterRecord> characters) throws SQLException {
        String sql = "INSERT INTO " + PartyPersistenceSchema.PLAYER_CHARACTERS.name() + "("
                + "id, name, player_name, level, current_xp, xp_since_long_rest, xp_since_short_rest,"
                + " passive_perception, ac, in_party)"
                + " VALUES(?,?,?,?,?,?,?,?,?,?)"
                + " ON CONFLICT(id) DO UPDATE SET"
                + " name = excluded.name,"
                + " player_name = excluded.player_name,"
                + " level = excluded.level,"
                + " current_xp = excluded.current_xp,"
                + " xp_since_long_rest = excluded.xp_since_long_rest,"
                + " xp_since_short_rest = excluded.xp_since_short_rest,"
                + " passive_perception = excluded.passive_perception,"
                + " ac = excluded.ac,"
                + " in_party = excluded.in_party";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (PartyCharacterRecord character : characters) {
                statement.setLong(1, character.id());
                statement.setString(2, character.name());
                statement.setString(3, blankToNull(character.playerName()));
                statement.setInt(4, character.level());
                statement.setInt(5, Math.max(0, character.currentXp()));
                statement.setInt(6, Math.max(0, character.xpSinceLongRest()));
                statement.setInt(7, Math.max(0, character.xpSinceShortRest()));
                statement.setInt(8, Math.max(1, character.passivePerception()));
                statement.setInt(9, Math.max(1, character.armorClass()));
                statement.setInt(10, "ACTIVE".equalsIgnoreCase(character.membership()) ? 1 : 0);
                statement.addBatch();
            }
            if (!characters.isEmpty()) {
                statement.executeBatch();
            }
        }
    }

    private void saveNextCharacterId(Connection connection, long nextCharacterId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "UPDATE " + PartyPersistenceSchema.PARTY_ROSTER_METADATA.name() + " SET next_character_id = ? WHERE singleton_id = 1")) {
            statement.setLong(1, Math.max(1L, nextCharacterId));
            statement.executeUpdate();
        }
    }

    private String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
