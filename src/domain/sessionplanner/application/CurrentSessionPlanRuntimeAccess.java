package src.domain.sessionplanner.application;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.sessionplanner.session.aggregate.SessionPlan;
import src.domain.sessionplanner.session.port.SessionEncounterFactsLookup;
import src.domain.sessionplanner.session.port.SessionPartyFactsLookup;
import src.domain.sessionplanner.session.value.EncounterDays;
import src.domain.sessionplanner.session.value.SessionParticipantRef;

public final class CurrentSessionPlanRuntimeAccess {

    private final SessionPartyFactsLookup partyFacts;
    private final SessionEncounterFactsLookup encounterFacts;
    private @Nullable SessionPlan currentSession;
    private long nextSessionId = 1L;

    public CurrentSessionPlanRuntimeAccess(
            SessionPartyFactsLookup partyFacts,
            SessionEncounterFactsLookup encounterFacts
    ) {
        this.partyFacts = Objects.requireNonNull(partyFacts, "partyFacts");
        this.encounterFacts = Objects.requireNonNull(encounterFacts, "encounterFacts");
    }

    public SessionPartyFactsLookup partyFacts() {
        return partyFacts;
    }

    public SessionEncounterFactsLookup encounterFacts() {
        return encounterFacts;
    }

    public SessionPlan loadOrCreateCurrent() {
        if (currentSession == null) {
            currentSession = createSeededSession();
        }
        return currentSession;
    }

    public SessionPlan createNewSession() {
        currentSession = createSeededSession();
        return currentSession;
    }

    public void replaceCurrent(SessionPlan session) {
        currentSession = Objects.requireNonNull(session, "session");
    }

    private SessionPlan createSeededSession() {
        List<SessionParticipantRef> participantRefs = new ArrayList<>();
        SessionPartyFactsLookup.ActivePartyMembersFact activeParty = partyFacts.loadActivePartyMembers();
        if (activeParty.available()) {
            for (SessionPartyFactsLookup.PartyMemberFact member : activeParty.members()) {
                participantRefs.add(new SessionParticipantRef(member.characterId()));
            }
        }
        return SessionPlan.seeded(nextSessionId++, participantRefs, EncounterDays.one());
    }
}
