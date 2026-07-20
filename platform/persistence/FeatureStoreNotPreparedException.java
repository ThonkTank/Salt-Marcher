package platform.persistence;

import java.sql.SQLException;

/** Payload-free failure raised when a handle is used before coordinated preparation. */
public final class FeatureStoreNotPreparedException extends SQLException {

    public FeatureStoreNotPreparedException() {
        super("SQLite feature store has not been prepared.");
    }
}
