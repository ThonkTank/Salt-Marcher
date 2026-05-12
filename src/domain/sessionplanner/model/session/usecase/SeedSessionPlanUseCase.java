package src.domain.sessionplanner.model.session.usecase;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.sessionplanner.model.session.helper.SessionPlanSeedHelper;
import src.domain.sessionplanner.model.session.model.SessionPlan;
import src.domain.sessionplanner.model.session.port.SessionPartyFactsPort;

public final class SeedSessionPlanUseCase {

    private final SessionPartyFactsPort partyFactsRepository;

    public SeedSessionPlanUseCase(SessionPartyFactsPort partyFactsRepository) {
        this.partyFactsRepository = Objects.requireNonNull(partyFactsRepository, "partyFactsRepository");
    }

    SessionPlan execute(long sessionId) {
        try {
            SessionPartyFactsPort.ActivePartyMembersFact activeParty =
                    partyFactsRepository.loadActivePartyMembers();
            return SessionPlanSeedHelper.createSeeded(
                    sessionId,
                    activeParty.available(),
                    participantRefs(activeParty));
        } catch (IllegalStateException exception) {
            return SessionPlanSeedHelper.createSeeded(sessionId, List.of());
        }
    }

    private List<Long> participantRefs(SessionPartyFactsPort.ActivePartyMembersFact activeParty) {
        List<Long> participantRefs = new ArrayList<>();
        for (SessionPartyFactsPort.PartyMemberProfile member : activeParty.members()) {
            participantRefs.add(member.characterId());
        }
        return participantRefs;
    }
}
