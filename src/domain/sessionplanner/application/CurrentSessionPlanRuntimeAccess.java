package src.domain.sessionplanner.application;

import java.util.Objects;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.sessionplanner.session.aggregate.SessionPlan;
import src.domain.sessionplanner.session.port.SessionPartyFactsLookup;
import src.domain.sessionplanner.session.port.SessionPlanRepository;
import src.domain.sessionplanner.session.value.EncounterDays;

public final class CurrentSessionPlanRuntimeAccess {

    private static final long INITIAL_SESSION_ID = 1L;
    private static final String LOAD_FAILURE_STATUS = "Session konnte nicht geladen werden.";
    private static final String REFRESH_FAILURE_STATUS = "Session konnte nicht neu geladen werden.";
    private static final String SAVE_FAILURE_STATUS = "Session konnte nicht gespeichert werden.";

    private final SessionPlanRepository repository;
    private final SessionPartyFactsLookup partyFacts;
    private @Nullable SessionPlan currentSession;

    public CurrentSessionPlanRuntimeAccess(
            SessionPlanRepository repository,
            SessionPartyFactsLookup partyFacts
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.partyFacts = Objects.requireNonNull(partyFacts, "partyFacts");
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
            return loadCurrent().orElseGet(() -> persist(createSeeded(nextSessionId()), true));
        } catch (IllegalStateException exception) {
            return fallbackSession(null, LOAD_FAILURE_STATUS);
        }
    }

    private SessionPlan reloadCurrentSession() {
        try {
            return loadCurrent().orElseGet(() -> persist(createSeeded(nextSessionId()), true));
        } catch (IllegalStateException exception) {
            return fallbackSession(currentSession, REFRESH_FAILURE_STATUS);
        }
    }

    private SessionPlan persist(SessionPlan candidate, boolean persistAsCurrent) {
        try {
            if (!persistAsCurrent) {
                return repository.save(candidate);
            }
            SessionPlan saved = repository.save(candidate);
            repository.setCurrentSessionId(saved.sessionId());
            return saved;
        } catch (IllegalStateException exception) {
            return fallbackSession(candidate, SAVE_FAILURE_STATUS);
        }
    }

    private SessionPlan fallbackSession(@Nullable SessionPlan candidate, String statusText) {
        SessionPlan base = currentSession != null
                ? currentSession.clearStatus()
                : candidate == null
                        ? createSeeded(fallbackSessionId(currentSession))
                        : candidate.clearStatus();
        return base.withStatus(statusText);
    }

    private long nextSessionId() {
        try {
            return Math.max(INITIAL_SESSION_ID, repository.nextSessionId());
        } catch (IllegalStateException exception) {
            return fallbackSessionId(currentSession);
        }
    }

    private Optional<SessionPlan> loadCurrent() {
        return repository.loadCurrent().map(SessionPlan::clearStatus);
    }

    private SessionPlan createSeeded(long sessionId) {
        java.util.List<Long> participantRefs = new java.util.ArrayList<>();
        try {
            SessionPartyFactsLookup.ActivePartyMembersFact activeParty = partyFacts.loadActivePartyMembers();
            if (!activeParty.available()) {
                return SessionPlan.seeded(sessionId, java.util.List.of(), EncounterDays.one());
            }
            for (SessionPartyFactsLookup.PartyMemberProfile member : activeParty.members()) {
                participantRefs.add(member.characterId());
            }
        } catch (IllegalStateException exception) {
            return SessionPlan.seeded(sessionId, java.util.List.of(), EncounterDays.one());
        }
        return SessionPlan.seeded(sessionId, participantRefs, EncounterDays.one());
    }

    private long fallbackSessionId(@Nullable SessionPlan session) {
        return session == null
                ? INITIAL_SESSION_ID
                : Math.max(INITIAL_SESSION_ID, session.sessionId() + 1L);
    }
}
