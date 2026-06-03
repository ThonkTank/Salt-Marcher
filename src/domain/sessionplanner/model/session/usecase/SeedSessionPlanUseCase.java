package src.domain.sessionplanner.model.session.usecase;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.sessionplanner.model.session.helper.SessionPlanSeedHelper;
import src.domain.sessionplanner.model.session.SessionActivePartyMembersFact;
import src.domain.sessionplanner.model.session.SessionPartyMemberProfile;
import src.domain.sessionplanner.model.session.SessionPlan;
import src.domain.sessionplanner.model.session.port.SessionPartyFactsPort;

public final class SeedSessionPlanUseCase {

    private final SessionPartyFactsPort partyFactsPort;

    public SeedSessionPlanUseCase(SessionPartyFactsPort partyFactsPort) {
        this.partyFactsPort = Objects.requireNonNull(partyFactsPort, "partyFactsPort");
    }

    SessionPlan execute(long sessionId) {
        try {
            SessionActivePartyMembersFact activeParty =
                    partyFactsPort.activePartyMembers();
            return SessionPlanSeedHelper.createSeeded(
                    sessionId,
                    activeParty.available(),
                    participantRefs(activeParty));
        } catch (IllegalStateException exception) {
            return SessionPlanSeedHelper.createSeeded(sessionId, List.of());
        }
    }

    private List<Long> participantRefs(SessionActivePartyMembersFact activeParty) {
        List<Long> participantRefs = new ArrayList<>();
        for (SessionPartyMemberProfile member : activeParty.members()) {
            participantRefs.add(member.characterId());
        }
        return participantRefs;
    }
}
