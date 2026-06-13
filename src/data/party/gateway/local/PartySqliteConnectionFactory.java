package src.data.party.gateway.local;

import java.nio.file.Path;
import src.data.party.model.PartyPersistenceSchema;
import src.data.persistencecore.sqlite.AbstractSqliteConnectionFactory;

final class PartySqliteConnectionFactory extends AbstractSqliteConnectionFactory {

    PartySqliteConnectionFactory() {
        super(
                resolveDatabasePath(PartyPersistenceSchema.DATABASE_FILE_NAME),
                // LEGACY_REMOVE_ON_TOUCH: Root DB copy; entfernen, sobald dieser Bereich bearbeitet wird.
                Path.of(PartyPersistenceSchema.DATABASE_FILE_NAME).toAbsolutePath().normalize());
    }
}
