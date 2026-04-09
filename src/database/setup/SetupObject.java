package database.setup;

import database.setup.input.SetupDatabaseInput;
import database.setup.repository.SetupDatabaseRepository;
import database.setup.state.SetupDatabaseState;

/**
 * Shared startup database preparation seam for schema creation, default seeding, and startup-safe compatibility.
 */
@SuppressWarnings("unused")
public final class SetupObject {

    public void setupDatabase(SetupDatabaseInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        SetupDatabaseState state = SetupDatabaseState.setupDatabase(input);
        SetupDatabaseRepository.setupDatabase(state);
    }
}
