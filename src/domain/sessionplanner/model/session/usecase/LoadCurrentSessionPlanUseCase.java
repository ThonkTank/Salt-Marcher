package src.domain.sessionplanner.model.session.usecase;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.sessionplanner.model.session.model.EncounterDays;
import src.domain.sessionplanner.model.session.model.SessionPlan;
import src.domain.sessionplanner.model.session.repository.SessionPartyFactsRepository;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;

public final class LoadCurrentSessionPlanUseCase {

    private static final long INITIAL_SESSION_ID = 1L;
    private static final String LOAD_FAILURE_STATUS = "Session konnte nicht geladen werden.";

    private final SessionPlanRepository repository;
    private final SessionPartyFactsRepository partyFactsRepository;
    private @Nullable SessionPlan currentSession;

    public LoadCurrentSessionPlanUseCase(
            SessionPlanRepository repository,
            SessionPartyFactsRepository partyFactsRepository
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.partyFactsRepository = Objects.requireNonNull(partyFactsRepository, "partyFactsRepository");
    }

    public SessionPlan execute() {
        if (currentSession == null) {
            currentSession = loadCurrentOrSeed();
        }
        return currentSession;
    }

    void replaceCached(SessionPlan sessionPlan) {
        currentSession = Objects.requireNonNull(sessionPlan, "sessionPlan");
    }

    private SessionPlan loadCurrentOrSeed() {
        try {
            return loadCurrent().orElseGet(() -> createSeeded(INITIAL_SESSION_ID));
        } catch (IllegalStateException exception) {
            return fallbackSession(LOAD_FAILURE_STATUS);
        }
    }

    private Optional<SessionPlan> loadCurrent() {
        return repository.loadCurrent().map(SessionPlan::clearStatus);
    }

    private SessionPlan createSeeded(long sessionId) {
        List<Long> participantRefs = new ArrayList<>();
        try {
            SessionPartyFactsRepository.ActivePartyMembersFact activeParty = partyFactsRepository.loadActivePartyMembers();
            if (!activeParty.available()) {
                return SessionPlan.seeded(sessionId, List.of(), EncounterDays.one());
            }
            for (SessionPartyFactsRepository.PartyMemberProfile member : activeParty.members()) {
                participantRefs.add(member.characterId());
            }
        } catch (IllegalStateException exception) {
            return SessionPlan.seeded(sessionId, List.of(), EncounterDays.one());
        }
        return SessionPlan.seeded(sessionId, participantRefs, EncounterDays.one());
    }

    private SessionPlan fallbackSession(String statusText) {
        SessionPlan base = currentSession == null
                ? createSeeded(INITIAL_SESSION_ID)
                : currentSession.clearStatus();
        return base.withStatus(statusText);
    }
}
