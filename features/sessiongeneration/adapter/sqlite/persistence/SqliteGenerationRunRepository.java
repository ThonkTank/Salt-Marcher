package features.sessiongeneration.adapter.sqlite.persistence;

import features.sessiongeneration.domain.generation.GeneratedRun;
import features.sessiongeneration.domain.generation.GenerationRunRepository;
import features.sessiongeneration.domain.generation.GeneratedRunValidator;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;
import java.util.Optional;
import platform.persistence.SqliteConnectionSource;
import platform.persistence.SqliteDatabase;
import platform.persistence.SqliteMigration;

public final class SqliteGenerationRunRepository implements GenerationRunRepository {

    public static final String OWNER = "session-generation";
    public static final int SCHEMA_VERSION = 1;

    private final SqliteConnectionSource connections;
    private final GenerationRunSqliteReader reader = new GenerationRunSqliteReader();
    private final GenerationRunSqliteWriter writer = new GenerationRunSqliteWriter();
    private final GeneratedRunValidator validator = new GeneratedRunValidator();

    public SqliteGenerationRunRepository(SqliteDatabase database) {
        SessionGenerationSchema schema = new SessionGenerationSchema();
        connections = Objects.requireNonNull(database, "database").connections(
                OWNER,
                new SqliteMigration(SCHEMA_VERSION, schema::migrate));
    }

    @Override
    public GeneratedRun save(GeneratedRun run) {
        Objects.requireNonNull(run, "run");
        validator.validate(run);
        try (Connection connection = connections.openConnection()) {
            return saveTransaction(connection, run);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to persist session-generation run.", exception);
        }
    }

    @Override
    public Optional<GeneratedRun> load(String runId) {
        Objects.requireNonNull(runId, "runId");
        try (Connection connection = connections.openConnection()) {
            Optional<GeneratedRun> loaded = reader.load(connection, runId);
            loaded.ifPresent(validator::validate);
            return loaded;
        } catch (SQLException | IllegalArgumentException exception) {
            throw new IllegalStateException("Failed to load session-generation run.", exception);
        }
    }

    private GeneratedRun saveTransaction(Connection connection, GeneratedRun run) throws SQLException {
        boolean autoCommit = connection.getAutoCommit();
        connection.setAutoCommit(false);
        try {
            Optional<GeneratedRun> existing = reader.load(connection, run.runId());
            if (existing.isPresent()) {
                validator.validate(existing.get());
                connection.rollback();
                if (!existing.get().equals(run)) {
                    throw new IllegalStateException("immutable generation run id collision");
                }
                return existing.get();
            }
            writer.insert(connection, run);
            connection.commit();
            GeneratedRun stored = reader.load(connection, run.runId()).orElseThrow();
            validator.validate(stored);
            return stored;
        } catch (SQLException | RuntimeException exception) {
            connection.rollback();
            throw exception;
        } finally {
            connection.setAutoCommit(autoCommit);
        }
    }
}
