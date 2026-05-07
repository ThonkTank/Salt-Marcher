package src.domain.sessionplanner;

import java.util.Objects;
import src.domain.sessionplanner.application.CurrentSessionPlanRuntimeAccess;
import src.domain.sessionplanner.application.RefreshSessionPlanUseCase;
import src.domain.sessionplanner.application.ApplySessionPlannerUseCase;
import src.domain.sessionplanner.published.ApplySessionPlannerCommand;
import src.domain.sessionplanner.session.port.SessionEncounterFactsLookup;
import src.domain.sessionplanner.session.port.SessionPartyFactsLookup;
import src.domain.sessionplanner.session.port.SessionPlanRepository;
import src.domain.sessionplanner.session.port.SessionPlannerPublishedStateRepository;

public final class SessionPlannerApplicationService {

    private final CurrentSessionPlanRuntimeAccess runtime;
    private final SessionPlannerPublishedStateRepository publishedStateRepository;
    private final ApplySessionPlannerUseCase mutationExecutor;
    private final RefreshSessionPlanUseCase refreshSessionUseCase;

    public SessionPlannerApplicationService(
            SessionPlanRepository repository,
            SessionPartyFactsLookup partyFacts,
            SessionEncounterFactsLookup encounterFacts,
            SessionPlannerPublishedStateRepository publishedStateRepository
    ) {
        Objects.requireNonNull(repository, "repository");
        Objects.requireNonNull(partyFacts, "partyFacts");
        Objects.requireNonNull(encounterFacts, "encounterFacts");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.runtime = new CurrentSessionPlanRuntimeAccess(repository, partyFacts);
        this.mutationExecutor = new ApplySessionPlannerUseCase(runtime);
        this.refreshSessionUseCase = new RefreshSessionPlanUseCase(runtime);
    }

    public void apply(ApplySessionPlannerCommand command) {
        mutationExecutor.execute(Objects.requireNonNull(command, "command"));
        publishCurrentState();
    }

    public void refreshSession() {
        refreshSessionUseCase.execute();
        publishCurrentState();
    }

    private void publishCurrentState() {
        publishedStateRepository.publishCurrentSession(runtime.loadOrCreateCurrent());
    }
}
