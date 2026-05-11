package src.domain.sessionplanner.model.session.usecase;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.sessionplanner.model.session.helper.SessionPlanSeedHelper;
import src.domain.sessionplanner.model.session.model.SessionPlan;
import src.domain.sessionplanner.model.session.repository.SessionPartyFactsRepository;

public final class SeedSessionPlanUseCase {

    private final SessionPartyFactsRepository partyFactsRepository;

    public SeedSessionPlanUseCase(SessionPartyFactsRepository partyFactsRepository) {
        this.partyFactsRepository = Objects.requireNonNull(partyFactsRepository, "partyFactsRepository");
    }

    SessionPlan execute(long sessionId) {
        try {
            SessionPartyFactsRepository.ActivePartyMembersFact activeParty =
                    partyFactsRepository.loadActivePartyMembers();
            return SessionPlanSeedHelper.createSeeded(
                    sessionId,
                    activeParty.available(),
                    participantRefs(activeParty));
        } catch (IllegalStateException exception) {
            return SessionPlanSeedHelper.createSeeded(sessionId, List.of());
        }
    }

    private List<Long> participantRefs(SessionPartyFactsRepository.ActivePartyMembersFact activeParty) {
        List<Long> participantRefs = new ArrayList<>();
        for (SessionPartyFactsRepository.PartyMemberProfile member : activeParty.members()) {
            participantRefs.add(member.characterId());
        }
        return participantRefs;
    }
}
