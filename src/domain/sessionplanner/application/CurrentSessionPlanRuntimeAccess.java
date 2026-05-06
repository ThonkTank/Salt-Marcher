package src.domain.sessionplanner.application;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
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
        currentSession = persistAsCurrent(createSeededSession(nextSessionId()).withStatus("Neue Session erstellt."));
        return currentSession;
    }

    public SessionPlan reloadCurrent() {
        currentSession = reloadCurrentSession();
        return currentSession;
    }

    public void replaceCurrent(SessionPlan session) {
        currentSession = persistExisting(Objects.requireNonNull(session, "session"));
    }

    private SessionPlan loadCurrentOrSeed() {
        try {
            return repository.loadCurrent()
                    .map(SessionPlan::clearStatus)
                    .orElseGet(() -> persistAsCurrent(createSeededSession(nextSessionId())));
        } catch (RuntimeException exception) {
            return fallbackSession(null, LOAD_FAILURE_STATUS);
        }
    }

    private SessionPlan reloadCurrentSession() {
        try {
            return repository.loadCurrent()
                    .map(SessionPlan::clearStatus)
                    .orElseGet(() -> persistAsCurrent(createSeededSession(nextSessionId())));
        } catch (RuntimeException exception) {
            return fallbackSession(currentSession, REFRESH_FAILURE_STATUS);
        }
    }

    private SessionPlan persistExisting(SessionPlan candidate) {
        try {
            return repository.save(candidate);
        } catch (RuntimeException exception) {
            return fallbackSession(candidate, SAVE_FAILURE_STATUS);
        }
    }

    private SessionPlan persistAsCurrent(SessionPlan candidate) {
        try {
            SessionPlan saved = repository.save(candidate);
            repository.setCurrentSessionId(saved.sessionId());
            return saved;
        } catch (RuntimeException exception) {
            return fallbackSession(candidate, SAVE_FAILURE_STATUS);
        }
    }

    private SessionPlan fallbackSession(@Nullable SessionPlan candidate, String statusText) {
        SessionPlan base = currentSession != null
                ? currentSession.clearStatus()
                : (candidate == null ? createSeededSession(fallbackSessionId()) : candidate.clearStatus());
        return base.withStatus(statusText);
    }

    private SessionPlan createSeededSession(long sessionId) {
        List<Long> participantRefs = new ArrayList<>();
        try {
            SessionPartyFactsLookup.ActivePartyMembersFact activeParty = partyFacts.loadActivePartyMembers();
            if (activeParty.available()) {
                for (SessionPartyFactsLookup.PartyMemberProfile member : activeParty.members()) {
                    participantRefs.add(member.characterId());
                }
            }
        } catch (RuntimeException exception) {
            return SessionPlan.seeded(sessionId, List.of(), EncounterDays.one());
        }
        return SessionPlan.seeded(sessionId, participantRefs, EncounterDays.one());
    }

    private long nextSessionId() {
        try {
            return Math.max(INITIAL_SESSION_ID, repository.nextSessionId());
        } catch (RuntimeException exception) {
            return fallbackSessionId();
        }
    }

    private long fallbackSessionId() {
        return currentSession == null ? INITIAL_SESSION_ID : Math.max(INITIAL_SESSION_ID, currentSession.sessionId() + 1L);
    }
}
