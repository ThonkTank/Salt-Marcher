package platform.persistence;

import java.sql.SQLException;
import java.util.Objects;

/** Payload-free failure raised when a feature store did not reach READY. */
public final class FeatureStoreUnavailableException extends SQLException {

    private final FeatureStoreReadiness readiness;

    public FeatureStoreUnavailableException(FeatureStoreReadiness readiness) {
        super("SQLite feature store is unavailable: " + Objects.requireNonNull(readiness, "readiness"));
        this.readiness = readiness;
    }

    public FeatureStoreReadiness readiness() {
        return readiness;
    }
}
