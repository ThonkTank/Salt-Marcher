package src.data.sessionplanner;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.sessionplanner.repository.SqliteSessionPlanRepository;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;

public final class SessionPlannerServiceContribution implements ServiceContribution {

    @SuppressWarnings("PMD.UnnecessaryConstructor")
    public SessionPlannerServiceContribution() {
        // Required by passive service contribution discovery.
    }

    @Override
    public void register(ServiceRegistry.Builder builder) {
        SessionPlanRepository repository = new SqliteSessionPlanRepository();
        new SessionPlannerServiceAssembly(repository).register(builder);
    }
}
