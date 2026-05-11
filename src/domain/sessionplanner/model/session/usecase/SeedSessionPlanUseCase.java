package src.domain.sessionplanner.model.session.usecase;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.sessionplanner.model.session.helper.SessionPlanSeedHelper;
import src.domain.sessionplanner.model.session.model.SessionPlan;
import src.domain.sessionplanner.model.session.port.SessionPartyFactsLookup;

public final class SeedSessionPlanUseCase {

    private final SessionPartyFactsLookup partyFactsRepository;

    public SeedSessionPlanUseCase(SessionPartyFactsLookup partyFactsRepository) {
        this.partyFactsRepository = Objects.requireNonNull(partyFactsRepository, "partyFactsRepository");
    }

    SessionPlan execute(long sessionId) {
        try {
            SessionPartyFactsLookup.ActivePartyMembersFact activeParty =
                    partyFactsRepository.loadActivePartyMembers();
            return SessionPlanSeedHelper.createSeeded(
                    sessionId,
                    activeParty.available(),
                    participantRefs(activeParty));
        } catch (IllegalStateException exception) {
            return SessionPlanSeedHelper.createSeeded(sessionId, List.of());
        }
    }

    private List<Long> participantRefs(SessionPartyFactsLookup.ActivePartyMembersFact activeParty) {
        List<Long> participantRefs = new ArrayList<>();
        for (SessionPartyFactsLookup.PartyMemberProfile member : activeParty.members()) {
            participantRefs.add(member.characterId());
        }
        return participantRefs;
    }
}
