package src.domain.sessionplanner;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import src.domain.sessionplanner.model.session.SessionActivePartyMembersFact;
import src.domain.sessionplanner.model.session.SessionAdventuringDayBudgetFact;
import src.domain.sessionplanner.model.session.SessionEncounter;
import src.domain.sessionplanner.model.session.SessionEncounterPlanFact;
import src.domain.sessionplanner.model.session.SessionPlan;
import src.domain.sessionplanner.model.session.port.SessionPartyFactsPort;
import src.domain.sessionplanner.model.session.repository.SessionEncounterFactsRepository;
import src.domain.sessionplanner.model.session.repository.SessionPartyFactsRepository;
import src.domain.sessionplanner.published.SessionPlannerParticipantsProjection;

final class SessionPlannerProjectionContextServiceAssembly {

    private static final long NO_ENCOUNTER_PLAN_ID = 0L;

    private SessionPlannerProjectionContextServiceAssembly() {
    }

    static ProjectionContext buildContext(
            SessionPlan session,
            SessionPartyFactsPort partyFacts,
            SessionPartyFactsRepository partyFactsRepository,
            SessionEncounterFactsRepository encounterFactsRepository
    ) {
        ProjectionContext participantContext = buildParticipantContext(session, partyFacts);
        boolean sessionReady = !participantContext.participants().isEmpty()
                && participantContext.participants().stream()
                .allMatch(SessionPlannerParticipantsProjection.SessionParticipant::available);
        Map<Long, SessionEncounterPlanFact> loadedEncounters =
                loadSessionEncounterFacts(session, encounterFactsRepository);
        SessionAdventuringDayBudgetFact budgetFact = sessionReady
                ? partyFactsRepository.calculateAdventuringDay(
                        participantContext.resolvedLevels(),
                        plannedEncounterXp(session, loadedEncounters))
                : SessionAdventuringDayBudgetFact.unavailable();
        int scaledBudgetXp = budgetFact.available() ? session.encounterDays().scaleBudget(budgetFact.totalBudgetXp()) : 0;
        return new ProjectionContext(
                participantContext.partyMembersFact(),
                participantContext.participants(),
                participantContext.resolvedLevels(),
                loadedEncounters,
                budgetFact,
                scaledBudgetXp);
    }

    static ProjectionContext buildParticipantContext(SessionPlan session, SessionPartyFactsPort partyFacts) {
        SessionActivePartyMembersFact partyMembersFact = partyFacts.activePartyMembers();
        List<SessionPlannerParticipantsProjection.SessionParticipant> participants =
                SessionPlannerParticipantsProjectionServiceAssembly.buildParticipants(session, partyMembersFact);
        List<Integer> resolvedLevels = participants.stream()
                .filter(SessionPlannerParticipantsProjection.SessionParticipant::available)
                .map(SessionPlannerParticipantsProjection.SessionParticipant::level)
                .toList();
        return new ProjectionContext(
                partyMembersFact,
                participants,
                resolvedLevels,
                new HashMap<>(),
                SessionAdventuringDayBudgetFact.unavailable(),
                0);
    }

    static int plannedEncounterXp(
            SessionPlan session,
            Map<Long, SessionEncounterPlanFact> loadedEncounters
    ) {
        return session.encounters().stream()
                .mapToInt(encounter -> loadedEncounters.getOrDefault(
                        encounter.encounterPlanId(),
                        SessionEncounterPlanFact.unavailable(
                                encounter.encounterPlanId(),
                                "Encounter-Plan fehlt.")).adjustedXp())
                .sum();
    }

    private static Map<Long, SessionEncounterPlanFact> loadSessionEncounterFacts(
            SessionPlan session,
            SessionEncounterFactsRepository encounterFactsRepository
    ) {
        Map<Long, SessionEncounterPlanFact> loadedEncounters = new HashMap<>();
        for (SessionEncounter encounter : session.encounters()) {
            if (encounter.encounterPlanId() > NO_ENCOUNTER_PLAN_ID) {
                loadedEncounters.computeIfAbsent(encounter.encounterPlanId(), encounterFactsRepository::loadEncounterPlan);
            }
        }
        return loadedEncounters;
    }

    record ProjectionContext(
            SessionActivePartyMembersFact partyMembersFact,
            List<SessionPlannerParticipantsProjection.SessionParticipant> participants,
            List<Integer> resolvedLevels,
            Map<Long, SessionEncounterPlanFact> loadedEncounters,
            SessionAdventuringDayBudgetFact budgetFact,
            int scaledBudgetXp
    ) {
    }
}
