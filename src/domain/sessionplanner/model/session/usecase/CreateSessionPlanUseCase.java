package src.domain.sessionplanner.model.session.usecase;

import java.util.ArrayList;
import java.util.List;
import src.domain.sessionplanner.model.session.model.EncounterDays;
import src.domain.sessionplanner.model.session.model.SessionPlan;
import src.domain.sessionplanner.model.session.repository.SessionPartyFactsRepository;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;

public final class CreateSessionPlanUseCase {

    private static final long INITIAL_SESSION_ID = 1L;

    private final SessionPlanRepository repository;
    private final SessionPartyFactsRepository partyFactsRepository;
    private final SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase;

    public CreateSessionPlanUseCase(
            SessionPlanRepository repository,
            SessionPartyFactsRepository partyFactsRepository,
            SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase
    ) {
        this.repository = repository;
        this.partyFactsRepository = partyFactsRepository;
        this.saveCurrentSessionPlanUseCase = saveCurrentSessionPlanUseCase;
    }

    public void execute() {
        saveCurrentSessionPlanUseCase.executeNewCurrent(
                createSeeded(nextSessionId()).withStatus("Neue Session erstellt."));
    }

    private long nextSessionId() {
        try {
            return Math.max(INITIAL_SESSION_ID, repository.nextSessionId());
        } catch (IllegalStateException exception) {
            return INITIAL_SESSION_ID;
        }
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
}
