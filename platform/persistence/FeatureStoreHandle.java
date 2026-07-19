package platform.persistence;

import java.util.Optional;

/** Owner-bound connection capability for one prepared feature store. */
public interface FeatureStoreHandle extends SqliteConnectionSource {

    String owner();

    Optional<FeatureStoreReadiness> readiness();
}
