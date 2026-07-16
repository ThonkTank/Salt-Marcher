package src.data.encounter.runtime;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.data.persistencecore.sqlite.AbstractSqliteConnectionFactory;
import src.domain.encounter.model.session.EncounterSessionMemento;
import src.domain.encounter.model.session.repository.EncounterRuntimeStateRepository;

public final class SqliteEncounterRuntimeStateRepository implements EncounterRuntimeStateRepository {
    private static final String TABLE = "encounter_runtime_state_rows";
    private final ConnectionFactory connections = new ConnectionFactory();
    private final EncounterRuntimeTextCodec codec = new EncounterRuntimeTextCodec();

    @Override
    public Map<String, EncounterSessionMemento> loadAll() {
        try (Connection connection = ready()) {
            Map<String, List<String>> rows = new LinkedHashMap<>();
            try (PreparedStatement statement = connection.prepareStatement(
                    "SELECT context_key, row_value FROM " + TABLE + " ORDER BY context_key, row_order");
                    ResultSet result = statement.executeQuery()) {
                while (result.next()) {
                    rows.computeIfAbsent(result.getString("context_key"), ignored -> new ArrayList<>())
                            .add(result.getString("row_value"));
                }
            }
            Map<String, EncounterSessionMemento> state = new LinkedHashMap<>();
            for (Map.Entry<String, List<String>> entry : rows.entrySet()) {
                state.put(entry.getKey(), codec.decode(entry.getValue()));
            }
            return Map.copyOf(state);
        } catch (SQLException | IllegalArgumentException exception) {
            throw new IllegalStateException("Failed to load encounter runtime state.", exception);
        }
    }

    @Override
    public void saveAll(Map<String, EncounterSessionMemento> sessions) {
        try (Connection connection = ready()) {
            boolean autoCommit = connection.getAutoCommit();
            connection.setAutoCommit(false);
            try (Statement clear = connection.createStatement()) {
                clear.executeUpdate("DELETE FROM " + TABLE);
                try (PreparedStatement statement = connection.prepareStatement(
                        "INSERT INTO " + TABLE + " (context_key, row_order, row_value) VALUES (?, ?, ?)")) {
                    for (Map.Entry<String, EncounterSessionMemento> entry : sessions.entrySet()) {
                        List<String> rows = codec.encode(entry.getValue());
                        for (int index = 0; index < rows.size(); index++) {
                            statement.setString(1, entry.getKey()); statement.setInt(2, index);
                            statement.setString(3, rows.get(index)); statement.addBatch();
                        }
                    }
                    statement.executeBatch();
                }
                connection.commit();
            } catch (SQLException exception) {
                connection.rollback();
                throw exception;
            } finally {
                connection.setAutoCommit(autoCommit);
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to save encounter runtime state.", exception);
        }
    }

    private Connection ready() throws SQLException {
        Connection connection = connections.openConnection();
        try (Statement statement = connection.createStatement()) {
            statement.execute("CREATE TABLE IF NOT EXISTS " + TABLE + " (context_key TEXT NOT NULL, "
                    + "row_order INTEGER NOT NULL, row_value TEXT NOT NULL, PRIMARY KEY(context_key, row_order))");
        } catch (SQLException exception) {
            connection.close(); throw exception;
        }
        return connection;
    }

    private static final class ConnectionFactory extends AbstractSqliteConnectionFactory {
        private ConnectionFactory() { super(resolveDatabasePath("game.db")); }
    }
}
