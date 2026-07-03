package src.domain.sessionplanner;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import src.domain.sessionplanner.model.session.SessionEncounter;
import src.domain.sessionplanner.model.session.SessionEncounterPlanFact;
import src.domain.sessionplanner.model.session.SessionLootPlaceholder;
import src.domain.sessionplanner.model.session.SessionPlan;
import src.domain.sessionplanner.model.session.SessionRestPlacement;
import src.domain.sessionplanner.model.session.port.SessionPartyFactsPort;
import src.domain.sessionplanner.model.session.repository.SessionEncounterFactsRepository;
import src.domain.sessionplanner.model.session.repository.SessionPartyFactsRepository;
import src.domain.sessionplanner.published.SessionPlannerSceneTimelineProjection;
import src.domain.sessionplanner.published.SessionPlannerRestKind;

final class SessionPlannerSceneTimelineProjectionServiceAssembly {

    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final long NO_ENCOUNTER_PLAN_ID = 0L;

    private SessionPlannerSceneTimelineProjectionServiceAssembly() {
    }

    static SessionPlannerSceneTimelineProjection projectSceneTimeline(
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
        return new SessionPlannerSceneTimelineProjection(
                buildSessionScenes(
                        session,
                        context.scaledBudgetXp(),
                        context.loadedEncounters(),
                        encounterFactsRepository),
                buildRestGaps(session));
    }

    static List<SessionPlannerSceneTimelineProjection.SessionScene> buildSessionScenes(
            SessionPlan session,
            int scaledBudgetXp,
            Map<Long, SessionEncounterPlanFact> loadedEncounters,
            SessionEncounterFactsRepository encounterFactsRepository
    ) {
        List<SessionPlannerSceneTimelineProjection.SessionScene> sessionScenes = new ArrayList<>();
        for (SessionEncounter encounter : session.encounters()) {
            boolean hasLinkedEncounter = encounter.encounterPlanId() > NO_ENCOUNTER_PLAN_ID;
            SessionEncounterPlanFact detail = hasLinkedEncounter
                    ? loadedEncounters.computeIfAbsent(encounter.encounterPlanId(), encounterFactsRepository::loadEncounterPlan)
                    : SessionEncounterPlanFact.unavailable(NO_ENCOUNTER_PLAN_ID, "");
            int targetXp = encounter.allocation().budgetPercentage()
                    .multiply(BigDecimal.valueOf(scaledBudgetXp))
                    .divide(HUNDRED, 0, RoundingMode.HALF_UP)
                    .intValue();
            sessionScenes.add(new SessionPlannerSceneTimelineProjection.SessionScene(
                    encounter.encounterId(),
                    encounter.encounterPlanId(),
                    hasLinkedEncounter,
                    detail.name(),
                    detail.generatedLabel(),
                    detail.creatureCount(),
                    detail.totalBaseXp(),
                    detail.adjustedXp(),
                    detail.xpMultiplier(),
                    detail.difficultyLabel(),
                    encounter.allocation().budgetPercentage(),
                    targetXp,
                    session.selectedEncounterId() == encounter.encounterId(),
                    encounter.sceneTitle(),
                    encounter.sceneNotes(),
                    encounter.locationId(),
                    lootForEncounter(session.lootPlaceholders(), encounter.encounterId())));
        }
        return List.copyOf(sessionScenes);
    }

    private static List<SessionPlannerSceneTimelineProjection.LootPlaceholder> lootForEncounter(
            List<SessionLootPlaceholder> lootPlaceholders,
            long encounterId
    ) {
        return lootPlaceholders.stream()
                .filter(loot -> loot.encounterId() == encounterId)
                .map(loot -> new SessionPlannerSceneTimelineProjection.LootPlaceholder(
                        loot.lootId(),
                        loot.label()))
                .toList();
    }

    private static List<SessionPlannerSceneTimelineProjection.RestGap> buildRestGaps(SessionPlan session) {
        List<SessionPlannerSceneTimelineProjection.RestGap> gaps = new ArrayList<>();
        List<SessionEncounter> encounters = session.encounters();
        for (int index = 0; index < encounters.size() - 1; index++) {
            SessionEncounter left = encounters.get(index);
            SessionEncounter right = encounters.get(index + 1);
            gaps.add(new SessionPlannerSceneTimelineProjection.RestGap(
                    index,
                    left.encounterId(),
                    right.encounterId(),
                    restKindForGap(left.encounterId(), right.encounterId(), session.restPlacements())));
        }
        return List.copyOf(gaps);
    }

    private static SessionPlannerRestKind restKindForGap(
            long leftSceneToken,
            long rightSceneToken,
            List<SessionRestPlacement> placements
    ) {
        return placements.stream()
                .filter(placement -> placement.matchesGap(leftSceneToken, rightSceneToken))
                .findFirst()
                .map(SessionPlannerSceneTimelineProjectionServiceAssembly::toRestKind)
                .orElse(SessionPlannerRestKind.NONE);
    }

    private static SessionPlannerRestKind toRestKind(SessionRestPlacement placement) {
        return placement.isLongRest() ? SessionPlannerRestKind.LONG_REST : SessionPlannerRestKind.SHORT_REST;
    }
}
