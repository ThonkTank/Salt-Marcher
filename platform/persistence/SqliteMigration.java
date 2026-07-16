package platform.persistence;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

public record SqliteMigration(int version, Action action) {

    public SqliteMigration {
        if (version <= 0) {
            throw new IllegalArgumentException("migration version must be positive");
        }
        action = Objects.requireNonNull(action, "action");
    }

    @FunctionalInterface
    public interface Action {
        void apply(Connection connection) throws SQLException;
    }
}
