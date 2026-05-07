package src.domain.sessionplanner.application;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.sessionplanner.session.aggregate.SessionPlan;
import src.domain.sessionplanner.session.port.SessionPartyFactsLookup;
import src.domain.sessionplanner.session.value.EncounterDays;

final class SessionPlanSeedFactory {

    private static final long INITIAL_SESSION_ID = 1L;

    private final SessionPartyFactsLookup partyFacts;

    SessionPlanSeedFactory(SessionPartyFactsLookup partyFacts) {
        this.partyFacts = Objects.requireNonNull(partyFacts, "partyFacts");
    }

    SessionPlan createSeeded(long sessionId) {
        List<Long> participantRefs = new ArrayList<>();
        try {
            SessionPartyFactsLookup.ActivePartyMembersFact activeParty = partyFacts.loadActivePartyMembers();
            if (activeParty.available()) {
                for (SessionPartyFactsLookup.PartyMemberProfile member : activeParty.members()) {
                    participantRefs.add(member.characterId());
                }
            }
        } catch (IllegalStateException exception) {
            return SessionPlan.seeded(sessionId, List.of(), EncounterDays.one());
        }
        return SessionPlan.seeded(sessionId, participantRefs, EncounterDays.one());
    }

    long fallbackSessionId(@Nullable SessionPlan currentSession) {
        return currentSession == null
                ? INITIAL_SESSION_ID
                : Math.max(INITIAL_SESSION_ID, currentSession.sessionId() + 1L);
    }
}
