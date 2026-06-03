package src.domain.sessionplanner;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import src.domain.sessionplanner.model.session.SessionActivePartyMembersFact;
import src.domain.sessionplanner.model.session.SessionAdventuringDayBudgetFact;
import src.domain.sessionplanner.model.session.SessionEncounterPlanFact;
import src.domain.sessionplanner.model.session.SessionEncounterPlanListFact;
import src.domain.sessionplanner.model.session.SessionPlan;
import src.domain.sessionplanner.model.session.SessionRestPlacement;
import src.domain.sessionplanner.model.session.SessionSavedEncounterPlanFact;
import src.domain.sessionplanner.model.session.port.SessionEncounterFactsPort;
import src.domain.sessionplanner.model.session.port.SessionPartyFactsPort;
import src.domain.sessionplanner.model.session.repository.SessionEncounterFactsRepository;
import src.domain.sessionplanner.model.session.repository.SessionPartyFactsRepository;
import src.domain.sessionplanner.published.SessionPlannerParticipantsProjection;
import src.domain.sessionplanner.published.SessionPlannerSessionSnapshot;

final class SessionPlannerSessionProjectionServiceAssembly {

    private SessionPlannerSessionProjectionServiceAssembly() {
    }

    static SessionPlannerSessionSnapshot projectSession(
            SessionPlan session,
            SessionPartyFactsPort partyFacts,
            SessionPartyFactsRepository partyFactsRepository,
            SessionEncounterFactsPort encounterFacts,
            SessionEncounterFactsRepository encounterFactsRepository
    ) {
        SessionPlannerProjectionContextServiceAssembly.ProjectionContext context =
                SessionPlannerProjectionContextServiceAssembly.buildContext(
                        session,
                        partyFacts,
                        partyFactsRepository,
                        encounterFactsRepository);
        SessionEncounterPlanListFact encounterPlansFact = encounterFacts.encounterPlans();
        List<SessionPlannerSessionSnapshot.AvailableEncounterPlan> availablePlans =
                buildAvailablePlans(encounterPlansFact, context.loadedEncounters(), encounterFactsRepository);
        return new SessionPlannerSessionSnapshot(
                new SessionPlannerSessionSnapshot.SessionState(
                        session.sessionId(),
                        session.encounterDays().value(),
                        session.encounterDays().displayText(),
                        session.selectedEncounterId(),
                        session.selectedEncounterId() > 0L),
                buildXpBudgetState(session, context.budgetFact(), context.scaledBudgetXp(), context.loadedEncounters()),
                buildRestAdviceState(
                        context.budgetFact(),
                        countShortRests(session.restPlacements()),
                        countLongRests(session.restPlacements())),
                SessionPlannerSessionSnapshot.GoldBudgetState.placeholder(session.lootPlaceholders().size()),
                availablePlans,
                resolveStatus(context.participants(), context.partyMembersFact(), encounterPlansFact, session.statusText()));
    }

    private static SessionPlannerSessionSnapshot.XpBudgetState buildXpBudgetState(
            SessionPlan session,
            SessionAdventuringDayBudgetFact budgetFact,
            int scaledBudgetXp,
            Map<Long, SessionEncounterPlanFact> loadedEncounters
    ) {
        if (!budgetFact.available()) {
            return SessionPlannerSessionSnapshot.XpBudgetState.empty();
        }
        int plannedXp = SessionPlannerProjectionContextServiceAssembly.plannedEncounterXp(session, loadedEncounters);
        int remainingXp = Math.max(0, scaledBudgetXp - plannedXp);
        int overBudgetXp = Math.max(0, plannedXp - scaledBudgetXp);
        boolean overBudget = overBudgetXp > 0;
        return new SessionPlannerSessionSnapshot.XpBudgetState(
                true,
                scaledBudgetXp,
                plannedXp,
                remainingXp,
                overBudgetXp,
                session.encounterDays().scaleBudget(budgetFact.firstShortRestXp()),
                session.encounterDays().scaleBudget(budgetFact.secondShortRestXp()),
                scaledBudgetXp <= 0 ? 0.0 : plannedXp / (double) scaledBudgetXp,
                overBudget,
                overBudget ? overBudgetXp + " XP ueber Budget" : remainingXp + " XP verbleibend");
    }

    private static SessionPlannerSessionSnapshot.RestAdviceState buildRestAdviceState(
            SessionAdventuringDayBudgetFact budgetFact,
            int placedShortRests,
            int placedLongRests
    ) {
        if (!budgetFact.available()) {
            return SessionPlannerSessionSnapshot.RestAdviceState.empty();
        }
        return new SessionPlannerSessionSnapshot.RestAdviceState(
                true,
                budgetFact.recommendedShortRests(),
                budgetFact.recommendedLongRests(),
                placedShortRests,
                placedLongRests,
                "Empfohlen " + budgetFact.recommendedShortRests() + " SR / " + budgetFact.recommendedLongRests()
                        + " LR · platziert " + placedShortRests + " SR / " + placedLongRests + " LR");
    }

    private static List<SessionPlannerSessionSnapshot.AvailableEncounterPlan> buildAvailablePlans(
            SessionEncounterPlanListFact encounterPlansFact,
            Map<Long, SessionEncounterPlanFact> loadedEncounters,
            SessionEncounterFactsRepository encounterFactsRepository
    ) {
        if (!encounterPlansFact.available()) {
            return List.of();
        }
        List<SessionPlannerSessionSnapshot.AvailableEncounterPlan> availablePlans = new ArrayList<>();
        for (SessionSavedEncounterPlanFact plan : encounterPlansFact.plans()) {
            SessionEncounterPlanFact detail = encounterFactsRepository.loadEncounterPlan(plan.planId());
            loadedEncounters.put(plan.planId(), detail);
            availablePlans.add(new SessionPlannerSessionSnapshot.AvailableEncounterPlan(
                    plan.planId(),
                    detail.name().isBlank() ? plan.name() : detail.name(),
                    plan.summaryText(),
                    detail.adjustedXp(),
                    detail.difficultyLabel(),
                    detail.statusText(),
                    detail.available()));
        }
        return List.copyOf(availablePlans);
    }

    private static String resolveStatus(
            List<SessionPlannerParticipantsProjection.SessionParticipant> participants,
            SessionActivePartyMembersFact partyMembersFact,
            SessionEncounterPlanListFact encounterPlansFact,
            String sessionStatusText
    ) {
        if (sessionStatusText != null && !sessionStatusText.isBlank()) {
            return sessionStatusText;
        }
        if (participants.isEmpty()) {
            return "Session hat noch keine Teilnehmer.";
        }
        if (participants.stream().anyMatch(participant -> !participant.available())) {
            return "Session enthaelt nicht mehr aufloesbare Teilnehmer-Referenzen.";
        }
        String partyStatus = unavailableStatus(
                partyMembersFact.available(),
                partyMembersFact.statusText(),
                "Aktive Party konnte nicht geladen werden.");
        if (!partyStatus.isBlank()) {
            return partyStatus;
        }
        String encounterStatus = unavailableStatus(
                encounterPlansFact.available(),
                encounterPlansFact.statusText(),
                "Encounter-Plaene konnten nicht geladen werden.");
        if (!encounterStatus.isBlank()) {
            return encounterStatus;
        }
        return encounterPlansFact.plans().isEmpty()
                ? "Keine gespeicherten Encounter-Plaene gefunden."
                : "";
    }

    private static int countShortRests(List<SessionRestPlacement> placements) {
        return (int) placements.stream()
                .filter(SessionRestPlacement::isShortRest)
                .count();
    }

    private static int countLongRests(List<SessionRestPlacement> placements) {
        return (int) placements.stream()
                .filter(SessionRestPlacement::isLongRest)
                .count();
    }

    private static String unavailableStatus(boolean available, String statusText, String fallbackMessage) {
        if (available) {
            return "";
        }
        return statusText == null || statusText.isBlank() ? fallbackMessage : statusText;
    }
}
