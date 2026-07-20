package platform.persistence;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

import java.util.Optional;

/** Owner-bound connection capability for one prepared feature store. */
public interface FeatureStoreHandle {

    String owner();

    Optional<FeatureStoreReadiness> readiness();

    Connection openConnection() throws SQLException;

    static FeatureStoreHandle requireOwner(FeatureStoreHandle handle, String expectedOwner) {
        FeatureStoreHandle safeHandle = Objects.requireNonNull(handle, "handle");
        String safeOwner = FeatureStoreDefinition.of(expectedOwner).owner();
        if (!safeOwner.equals(safeHandle.owner())) {
            throw new IllegalArgumentException(
                    "feature store owner mismatch: expected "
                            + safeOwner
                            + ", got "
                            + safeHandle.owner());
        }
        return safeHandle;
    }
}
