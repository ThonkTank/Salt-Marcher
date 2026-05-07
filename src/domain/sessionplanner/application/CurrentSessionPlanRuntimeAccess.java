package src.domain.sessionplanner.application;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.sessionplanner.session.aggregate.SessionPlan;
import src.domain.sessionplanner.session.port.SessionPartyFactsLookup;
import src.domain.sessionplanner.session.port.SessionPlanRepository;

public final class CurrentSessionPlanRuntimeAccess {

    private static final long INITIAL_SESSION_ID = 1L;
    private static final String LOAD_FAILURE_STATUS = "Session konnte nicht geladen werden.";
    private static final String REFRESH_FAILURE_STATUS = "Session konnte nicht neu geladen werden.";
    private static final String SAVE_FAILURE_STATUS = "Session konnte nicht gespeichert werden.";

    private final SessionPlanRepositoryAccess repository;
    private final SessionPlanSeedFactory seedFactory;
    private @Nullable SessionPlan currentSession;

    public CurrentSessionPlanRuntimeAccess(
            SessionPlanRepository repository,
            SessionPartyFactsLookup partyFacts
    ) {
        this.repository = new SessionPlanRepositoryAccess(Objects.requireNonNull(repository, "repository"));
        this.seedFactory = new SessionPlanSeedFactory(Objects.requireNonNull(partyFacts, "partyFacts"));
    }

    public SessionPlan loadOrCreateCurrent() {
        if (currentSession == null) {
            currentSession = loadCurrentOrSeed();
        }
        return currentSession;
    }

    public SessionPlan createNewSession() {
        currentSession = persist(seedFactory.createSeeded(nextSessionId()).withStatus("Neue Session erstellt."), true);
        return currentSession;
    }

    public SessionPlan reloadCurrent() {
        currentSession = reloadCurrentSession();
        return currentSession;
    }

    public void replaceCurrent(SessionPlan session) {
        currentSession = persist(Objects.requireNonNull(session, "session"), false);
    }

    private SessionPlan loadCurrentOrSeed() {
        try {
            return repository.loadCurrent().orElseGet(() -> persist(seedFactory.createSeeded(nextSessionId()), true));
        } catch (IllegalStateException exception) {
            return fallbackSession(null, LOAD_FAILURE_STATUS);
        }
    }

    private SessionPlan reloadCurrentSession() {
        try {
            return repository.loadCurrent().orElseGet(() -> persist(seedFactory.createSeeded(nextSessionId()), true));
        } catch (IllegalStateException exception) {
            return fallbackSession(currentSession, REFRESH_FAILURE_STATUS);
        }
    }

    private SessionPlan persist(SessionPlan candidate, boolean persistAsCurrent) {
        try {
            return persistAsCurrent ? repository.saveAsCurrent(candidate) : repository.save(candidate);
        } catch (IllegalStateException exception) {
            return fallbackSession(candidate, SAVE_FAILURE_STATUS);
        }
    }

    private SessionPlan fallbackSession(@Nullable SessionPlan candidate, String statusText) {
        SessionPlan base = currentSession != null
                ? currentSession.clearStatus()
                : candidate == null
                        ? seedFactory.createSeeded(seedFactory.fallbackSessionId(currentSession))
                        : candidate.clearStatus();
        return base.withStatus(statusText);
    }

    private long nextSessionId() {
        try {
            return Math.max(INITIAL_SESSION_ID, repository.nextSessionId());
        } catch (IllegalStateException exception) {
            return seedFactory.fallbackSessionId(currentSession);
        }
    }
}
