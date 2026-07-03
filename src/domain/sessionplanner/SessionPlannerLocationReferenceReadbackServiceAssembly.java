package src.domain.sessionplanner;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.sessionplanner.model.session.SessionLocationReference;
import src.domain.sessionplanner.model.session.port.SessionLocationReferencePort;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;

final class SessionPlannerLocationReferenceReadbackServiceAssembly implements SessionLocationReferencePort {

    private static final long NO_LOCATION_ID = 0L;

    private final @Nullable WorldPlannerSnapshotModel snapshots;

    SessionPlannerLocationReferenceReadbackServiceAssembly(@Nullable WorldPlannerSnapshotModel snapshots) {
        this.snapshots = snapshots;
    }

    @Override
    public List<SessionLocationReference> availableLocations() {
        if (snapshots == null) {
            return List.of();
        }
        return snapshots.current().locations().stream()
                .map(location -> new SessionLocationReference(location.locationId(), location.displayName()))
                .toList();
    }

    @Override
    public boolean locationExists(long locationId) {
        return locationId <= NO_LOCATION_ID || availableLocations().stream()
                .anyMatch(location -> location.locationId() == locationId);
    }

}
