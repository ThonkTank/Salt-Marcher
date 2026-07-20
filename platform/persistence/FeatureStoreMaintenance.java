package platform.persistence;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

/** Owner-bound capability for an explicit feature maintenance operation. */
public interface FeatureStoreMaintenance {

  String owner();

  Connection openConnection() throws SQLException;

    FeatureStoreBackup createVerifiedBackup() throws SQLException;

    static FeatureStoreMaintenance requireOwner(
            FeatureStoreMaintenance maintenance, String expectedOwner) {
        FeatureStoreMaintenance safeMaintenance =
                Objects.requireNonNull(maintenance, "maintenance");
        String safeOwner = FeatureStoreDefinition.of(expectedOwner).owner();
        if (!safeOwner.equals(safeMaintenance.owner())) {
            throw new IllegalArgumentException(
                    "feature store owner mismatch: expected "
                            + safeOwner
                            + ", got "
                            + safeMaintenance.owner());
        }
        return safeMaintenance;
    }
}
