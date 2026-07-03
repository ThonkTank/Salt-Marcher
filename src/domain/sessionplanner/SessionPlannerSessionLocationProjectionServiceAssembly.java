package src.domain.sessionplanner;

import java.util.List;
import src.domain.sessionplanner.model.session.SessionLocationReference;
import src.domain.sessionplanner.model.session.port.SessionLocationReferencePort;
import src.domain.sessionplanner.published.SessionPlannerSessionSnapshot;

final class SessionPlannerSessionLocationProjectionServiceAssembly {

    private SessionPlannerSessionLocationProjectionServiceAssembly() {
    }

    static List<SessionPlannerSessionSnapshot.LocationReference> buildLocationReferences(
            SessionLocationReferencePort locationReferences
    ) {
        return locationReferences == null
                ? List.of()
                : locationReferences.availableLocations().stream()
                        .map(SessionPlannerSessionLocationProjectionServiceAssembly::reference)
                        .toList();
    }

    private static SessionPlannerSessionSnapshot.LocationReference reference(
            SessionLocationReference reference
    ) {
        return new SessionPlannerSessionSnapshot.LocationReference(
                reference.locationId(),
                reference.displayName());
    }
}
