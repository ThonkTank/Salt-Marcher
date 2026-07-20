package platform.persistence;

import java.time.Instant;
import java.util.Objects;

/** Opaque feature-named receipt for a restore-tested backup of the complete physical database. */
public record FeatureStoreBackup(String owner, Instant createdAt) {

    public FeatureStoreBackup {
        owner = FeatureStoreDefinition.of(owner).owner();
        createdAt = Objects.requireNonNull(createdAt, "createdAt");
    }
}
