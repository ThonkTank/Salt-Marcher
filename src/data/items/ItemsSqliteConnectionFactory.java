package src.data.items;

import java.nio.file.Path;
import src.data.persistencecore.sqlite.AbstractSqliteConnectionFactory;

final class ItemsSqliteConnectionFactory extends AbstractSqliteConnectionFactory {

    ItemsSqliteConnectionFactory() {
        this(ItemsDatabase.resolvePath());
    }

    ItemsSqliteConnectionFactory(Path databasePath) {
        super(databasePath);
    }
}
