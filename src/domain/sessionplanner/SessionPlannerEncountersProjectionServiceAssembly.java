package src.domain.sessionplanner;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import src.domain.sessionplanner.model.session.SessionEncounter;
import src.domain.sessionplanner.model.session.SessionEncounterPlanFact;
import src.domain.sessionplanner.model.session.SessionPlan;
import src.domain.sessionplanner.model.session.SessionRestPlacement;
import src.domain.sessionplanner.model.session.port.SessionPartyFactsPort;
import src.domain.sessionplanner.model.session.repository.SessionEncounterFactsRepository;
import src.domain.sessionplanner.model.session.repository.SessionPartyFactsRepository;
import src.domain.sessionplanner.published.SessionPlannerEncountersProjection;
import src.domain.sessionplanner.published.SessionPlannerRestKind;

final class SessionPlannerEncountersProjectionServiceAssembly {

    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private SessionPlannerEncountersProjectionServiceAssembly() {
    }

    static SessionPlannerEncountersProjection projectEncounters(
            SessionPlan session,
            SessionPartyFactsPort partyFacts,
            SessionPartyFactsRepository partyFactsRepository,
            SessionEncounterFactsRepository encounterFactsRepository
    ) {
        SessionPlannerProjectionContextServiceAssembly.ProjectionContext context =
                SessionPlannerProjectionContextServiceAssembly.buildContext(
                        session,
                        partyFacts,
                        partyFactsRepository,
                        encounterFactsRepository);
        return new SessionPlannerEncountersProjection(
                buildPlannedEncounters(
                        session,
                        context.scaledBudgetXp(),
                        context.loadedEncounters(),
                        encounterFactsRepository),
                buildRestGaps(session),
                session.lootPlaceholders().stream()
                        .map(loot -> new SessionPlannerEncountersProjection.LootPlaceholder(
                                loot.lootId(),
                                loot.label()))
                        .toList());
    }

    static List<SessionPlannerEncountersProjection.PlannedEncounter> buildPlannedEncounters(
            SessionPlan session,
            int scaledBudgetXp,
            Map<Long, SessionEncounterPlanFact> loadedEncounters,
            SessionEncounterFactsRepository encounterFactsRepository
    ) {
        List<SessionPlannerEncountersProjection.PlannedEncounter> plannedEncounters = new ArrayList<>();
        for (SessionEncounter encounter : session.encounters()) {
            SessionEncounterPlanFact detail = loadedEncounters.computeIfAbsent(
                    encounter.encounterPlanId(),
                    encounterFactsRepository::loadEncounterPlan);
            int targetXp = encounter.allocation().budgetPercentage()
                    .multiply(BigDecimal.valueOf(scaledBudgetXp))
                    .divide(HUNDRED, 0, RoundingMode.HALF_UP)
                    .intValue();
            plannedEncounters.add(new SessionPlannerEncountersProjection.PlannedEncounter(
                    encounter.encounterId(),
                    encounter.encounterPlanId(),
                    detail.name(),
                    detail.generatedLabel(),
                    detail.creatureCount(),
                    detail.totalBaseXp(),
                    detail.adjustedXp(),
                    detail.xpMultiplier(),
                    detail.difficultyLabel(),
                    encounter.allocation().budgetPercentage(),
                    targetXp,
                    session.selectedEncounterId() == encounter.encounterId()));
        }
        return List.copyOf(plannedEncounters);
    }

    private static List<SessionPlannerEncountersProjection.RestGap> buildRestGaps(SessionPlan session) {
        List<SessionPlannerEncountersProjection.RestGap> gaps = new ArrayList<>();
        List<SessionEncounter> encounters = session.encounters();
        for (int index = 0; index < encounters.size() - 1; index++) {
            SessionEncounter left = encounters.get(index);
            SessionEncounter right = encounters.get(index + 1);
            gaps.add(new SessionPlannerEncountersProjection.RestGap(
                    index,
                    left.encounterId(),
                    right.encounterId(),
                    restKindForGap(left.encounterId(), right.encounterId(), session.restPlacements())));
        }
        return List.copyOf(gaps);
    }

    private static SessionPlannerRestKind restKindForGap(
            long leftEncounterId,
            long rightEncounterId,
            List<SessionRestPlacement> placements
    ) {
        return placements.stream()
                .filter(placement -> placement.matchesGap(leftEncounterId, rightEncounterId))
                .findFirst()
                .map(SessionPlannerEncountersProjectionServiceAssembly::toRestKind)
                .orElse(SessionPlannerRestKind.NONE);
    }

    private static SessionPlannerRestKind toRestKind(SessionRestPlacement placement) {
        return placement.isLongRest() ? SessionPlannerRestKind.LONG_REST : SessionPlannerRestKind.SHORT_REST;
    }
}
