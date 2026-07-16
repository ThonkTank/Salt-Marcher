package src.data.sessiongeneration;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Objects;
import java.util.Optional;
import src.domain.sessiongeneration.GenerationResult;
import src.domain.sessiongeneration.SessionGenerationRepository;

public final class SqliteSessionGenerationRepository implements SessionGenerationRepository {

    private static final String TABLE = "session_generation_runs";
    private static final String CREATE_SQL = "CREATE TABLE IF NOT EXISTS " + TABLE + " ("
            + "generation_id INTEGER PRIMARY KEY, "
            + "payload_version INTEGER NOT NULL, "
            + "data_content_hash TEXT NOT NULL, "
            + "payload BLOB NOT NULL, "
            + "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)";
    private final SessionGenerationSqliteConnectionFactory connectionFactory;
    private final GenerationResultBinaryCodec codec;

    public SqliteSessionGenerationRepository() {
        this(new SessionGenerationSqliteConnectionFactory(), new GenerationResultBinaryCodec());
    }

    SqliteSessionGenerationRepository(
            SessionGenerationSqliteConnectionFactory connectionFactory,
            GenerationResultBinaryCodec codec
    ) {
        this.connectionFactory = Objects.requireNonNull(connectionFactory, "connectionFactory");
        this.codec = Objects.requireNonNull(codec, "codec");
    }

    @Override
    public long nextGenerationId() {
        try (Connection connection = openReadyConnection();
                Statement statement = connection.createStatement();
                ResultSet result = statement.executeQuery(
                        "SELECT COALESCE(MAX(generation_id), 0) + 1 AS next_id FROM " + TABLE)) {
            return result.next() ? result.getLong("next_id") : 1L;
        } catch (SQLException exception) {
            throw new IllegalStateException("Could not allocate a session generation ID.", exception);
        }
    }

    @Override
    public GenerationResult save(GenerationResult result) {
        Objects.requireNonNull(result, "result");
        String sql = "INSERT INTO " + TABLE
                + " (generation_id, payload_version, data_content_hash, payload) VALUES (?, 2, ?, ?)";
        try (Connection connection = openReadyConnection();
                PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setLong(1, result.generationId());
            statement.setString(2, result.dataContentHash());
            statement.setBytes(3, codec.encode(result));
            statement.executeUpdate();
            return result;
        } catch (SQLException exception) {
            throw new IllegalStateException("Could not persist session generation result.", exception);
        }
    }

    @Override
    public Optional<GenerationResult> load(long generationId) {
        if (generationId <= 0L) return Optional.empty();
        try (Connection connection = openReadyConnection();
                PreparedStatement statement = connection.prepareStatement(
                        "SELECT payload FROM " + TABLE + " WHERE generation_id = ?")) {
            statement.setLong(1, generationId);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() ? Optional.of(codec.decode(result.getBytes("payload"))) : Optional.empty();
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Could not load session generation result.", exception);
        }
    }

    private Connection openReadyConnection() throws SQLException {
        Connection connection = connectionFactory.openConnection();
        try (Statement statement = connection.createStatement()) {
            statement.execute(CREATE_SQL);
            return connection;
        } catch (SQLException exception) {
            connection.close();
            throw exception;
        }
    }
}
