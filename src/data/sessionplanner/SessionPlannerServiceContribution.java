package src.data.sessionplanner;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.sessionplanner.repository.SqliteSessionPlanRepository;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;

public final class SessionPlannerServiceContribution implements ServiceContribution {

    @Override
    public void register(ServiceRegistry.Builder builder) {
        builder.register(SessionPlanRepository.class, new SqliteSessionPlanRepository());
    }
}
