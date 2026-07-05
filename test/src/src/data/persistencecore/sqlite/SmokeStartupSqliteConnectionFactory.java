package src.data.persistencecore.sqlite;

import java.nio.file.Path;

public final class SmokeStartupSqliteConnectionFactory extends AbstractSqliteConnectionFactory {

    public SmokeStartupSqliteConnectionFactory(Path databasePath) {
        super(databasePath);
    }
}
