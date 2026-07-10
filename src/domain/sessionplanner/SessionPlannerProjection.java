package src.domain.sessionplanner;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import src.domain.sessionplanner.model.session.SessionActivePartyMembersFact;
import src.domain.sessionplanner.model.session.SessionAdventuringDayBudgetFact;
import src.domain.sessionplanner.model.session.SessionEncounter;
import src.domain.sessionplanner.model.session.SessionEncounterPlanFact;
import src.domain.sessionplanner.model.session.SessionEncounterPlanListFact;
import src.domain.sessionplanner.model.session.SessionLocationReference;
import src.domain.sessionplanner.model.session.SessionLootPlaceholder;
import src.domain.sessionplanner.model.session.SessionPartyMemberProfile;
import src.domain.sessionplanner.model.session.SessionPlan;
import src.domain.sessionplanner.model.session.SessionPlanSummary;
import src.domain.sessionplanner.model.session.SessionRestPlacement;
import src.domain.sessionplanner.model.session.SessionSavedEncounterPlanFact;
import src.domain.sessionplanner.published.SessionPlannerCatalogSnapshot;
import src.domain.sessionplanner.published.SessionPlannerParticipantsProjection;
import src.domain.sessionplanner.published.SessionPlannerRestKind;
import src.domain.sessionplanner.published.SessionPlannerSceneTimelineProjection;
import src.domain.sessionplanner.published.SessionPlannerSessionSnapshot;
import src.domain.sessionplanner.published.SessionPlannerStatePanelProjection;

@SuppressWarnings({"PMD.CouplingBetweenObjects", "PMD.GodClass", "PMD.TooManyMethods"})
final class SessionPlannerProjection {

    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final long NO_ENCOUNTER_PLAN_ID = 0L;

    SessionPlannerCatalogSnapshot catalog(
            List<SessionPlanSummary> sessions,
            long selectedSessionId,
            String statusText
    ) {
        return new SessionPlannerCatalogSnapshot(
                sessions.stream()
                        .map(summary -> new SessionPlannerCatalogSnapshot.SessionSummary(
                                summary.sessionId(),
                                summary.displayName()))
                        .toList(),
                selectedSessionId,
                statusText);
    }

    SessionPlannerSessionSnapshot session(SessionPlan session, SessionPlannerForeignFacts facts) {
        ProjectionContext context = buildContext(session, facts);
        SessionEncounterPlanListFact encounterPlansFact = facts.encounterPlans();
        List<SessionPlannerSessionSnapshot.AvailableEncounterPlan> availablePlans =
                buildAvailablePlans(encounterPlansFact, context.loadedEncounters(), facts);
        return new SessionPlannerSessionSnapshot(
                new SessionPlannerSessionSnapshot.SessionState(
                        session.sessionId(),
                        session.displayName(),
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
                buildLocationReferences(facts.availableLocations()),
                resolveStatus(context.participants(), context.partyMembersFact(), encounterPlansFact, session.statusText()));
    }

    SessionPlannerParticipantsProjection participants(SessionPlan session, SessionPlannerForeignFacts facts) {
        ProjectionContext context = buildParticipantContext(session, facts);
        return new SessionPlannerParticipantsProjection(
                buildPartyState(session, context.resolvedLevels(), context.participants(), context.partyMembersFact()),
                buildActivePartyMembers(context.partyMembersFact().members()),
                context.participants());
    }

    SessionPlannerSceneTimelineProjection sceneTimeline(SessionPlan session, SessionPlannerForeignFacts facts) {
        ProjectionContext context = buildContext(session, facts);
        return new SessionPlannerSceneTimelineProjection(
                buildSessionScenes(session, context.scaledBudgetXp(), context.loadedEncounters(), facts),
                buildRestGaps(session));
    }

    SessionPlannerStatePanelProjection statePanel(SessionPlan session, SessionPlannerForeignFacts facts) {
        ProjectionContext context = buildContext(session, facts);
        return buildStatePanel(
                session.selectedEncounterId() > 0L,
                buildSessionScenes(session, context.scaledBudgetXp(), context.loadedEncounters(), facts));
    }

    private ProjectionContext buildContext(SessionPlan session, SessionPlannerForeignFacts facts) {
        ProjectionContext participantContext = buildParticipantContext(session, facts);
        boolean sessionReady = !participantContext.participants().isEmpty()
                && participantContext.participants().stream()
                .allMatch(SessionPlannerParticipantsProjection.SessionParticipant::available);
        Map<Long, SessionEncounterPlanFact> loadedEncounters = loadSessionEncounterFacts(session, facts);
        SessionAdventuringDayBudgetFact budgetFact = sessionReady
                ? facts.calculateAdventuringDay(
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

    private ProjectionContext buildParticipantContext(SessionPlan session, SessionPlannerForeignFacts facts) {
        SessionActivePartyMembersFact partyMembersFact = facts.activePartyMembers();
        List<SessionPlannerParticipantsProjection.SessionParticipant> participants =
                buildParticipants(session, partyMembersFact);
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

    private static List<SessionPlannerParticipantsProjection.SessionParticipant> buildParticipants(
            SessionPlan session,
            SessionActivePartyMembersFact activeMembers
    ) {
        List<SessionPlannerParticipantsProjection.SessionParticipant> participants = new ArrayList<>();
        for (Long participantRef : session.participantRefs()) {
            SessionPartyMemberProfile member = activeMembers.resolve(participantRef);
            if (member == null) {
                participants.add(new SessionPlannerParticipantsProjection.SessionParticipant(
                        participantRef,
                        "Charakter #" + participantRef,
                        0,
                        false,
                        "Nicht mehr in der aktiven Party verfuegbar."));
            } else {
                participants.add(new SessionPlannerParticipantsProjection.SessionParticipant(
                        member.characterId(),
                        member.displayName(),
                        member.currentLevel(),
                        true,
                        ""));
            }
        }
        return List.copyOf(participants);
    }

    private static SessionPlannerParticipantsProjection.PartyState buildPartyState(
            SessionPlan session,
            List<Integer> resolvedLevels,
            List<SessionPlannerParticipantsProjection.SessionParticipant> participants,
            SessionActivePartyMembersFact partyMembersFact
    ) {
        int sessionSize = session.participantRefs().size();
        int averageLevel = resolvedLevels.isEmpty()
                ? 0
                : (int) Math.round(resolvedLevels.stream().mapToInt(Integer::intValue).average().orElse(0.0));
        String headline = sessionSize <= 0
                ? "Keine Session-Teilnehmer"
                : sessionSize + " Session-Teilnehmer";
        return new SessionPlannerParticipantsProjection.PartyState(
                resolvedLevels,
                sessionSize,
                averageLevel,
                sessionSize > 0
                        && participants.stream()
                        .allMatch(SessionPlannerParticipantsProjection.SessionParticipant::available),
                headline,
                partyStateDetail(sessionSize, averageLevel, resolvedLevels, participants, partyMembersFact));
    }

    private static String partyStateDetail(
            int sessionSize,
            int averageLevel,
            List<Integer> resolvedLevels,
            List<SessionPlannerParticipantsProjection.SessionParticipant> participants,
            SessionActivePartyMembersFact partyMembersFact
    ) {
        if (sessionSize <= 0) {
            return "Session hat noch keine Teilnehmer.";
        }
        if (!partyMembersFact.available()) {
            return partyMembersFact.statusText().isBlank()
                    ? "Aktive Party ist derzeit nicht lesbar."
                    : partyMembersFact.statusText();
        }
        long missing = participants.stream().filter(participant -> !participant.available()).count();
        if (missing > 0) {
            return resolvedLevels.size() + " aufgeloest · " + missing + " fehlend";
        }
        return "Durchschnittsstufe " + averageLevel + " · Level " + joinLevels(resolvedLevels);
    }

    private static List<SessionPlannerParticipantsProjection.ActivePartyMember> buildActivePartyMembers(
            List<SessionPartyMemberProfile> members
    ) {
        List<SessionPlannerParticipantsProjection.ActivePartyMember> activePartyMembers = new ArrayList<>();
        for (SessionPartyMemberProfile member
                : members == null ? List.<SessionPartyMemberProfile>of() : members) {
            activePartyMembers.add(new SessionPlannerParticipantsProjection.ActivePartyMember(
                    member.characterId(),
                    member.displayName(),
                    member.currentLevel()));
        }
        return List.copyOf(activePartyMembers);
    }

    private static List<SessionPlannerSessionSnapshot.AvailableEncounterPlan> buildAvailablePlans(
            SessionEncounterPlanListFact encounterPlansFact,
            Map<Long, SessionEncounterPlanFact> loadedEncounters,
            SessionPlannerForeignFacts facts
    ) {
        if (!encounterPlansFact.available()) {
            return List.of();
        }
        List<SessionPlannerSessionSnapshot.AvailableEncounterPlan> availablePlans = new ArrayList<>();
        for (SessionSavedEncounterPlanFact plan : encounterPlansFact.plans()) {
            SessionEncounterPlanFact detail = facts.loadEncounterPlan(plan.planId());
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

    private static SessionPlannerSessionSnapshot.XpBudgetState buildXpBudgetState(
            SessionPlan session,
            SessionAdventuringDayBudgetFact budgetFact,
            int scaledBudgetXp,
            Map<Long, SessionEncounterPlanFact> loadedEncounters
    ) {
        if (!budgetFact.available()) {
            return SessionPlannerSessionSnapshot.XpBudgetState.empty();
        }
        int plannedXp = plannedEncounterXp(session, loadedEncounters);
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

    private static List<SessionPlannerSceneTimelineProjection.SessionScene> buildSessionScenes(
            SessionPlan session,
            int scaledBudgetXp,
            Map<Long, SessionEncounterPlanFact> loadedEncounters,
            SessionPlannerForeignFacts facts
    ) {
        List<SessionPlannerSceneTimelineProjection.SessionScene> sessionScenes = new ArrayList<>();
        for (SessionEncounter encounter : session.encounters()) {
            boolean hasLinkedEncounter = encounter.encounterPlanId() > NO_ENCOUNTER_PLAN_ID;
            SessionEncounterPlanFact detail = hasLinkedEncounter
                    ? loadedEncounters.computeIfAbsent(encounter.encounterPlanId(), facts::loadEncounterPlan)
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
                .map(SessionPlannerProjection::toRestKind)
                .orElse(SessionPlannerRestKind.NONE);
    }

    private static SessionPlannerRestKind toRestKind(SessionRestPlacement placement) {
        return placement.isLongRest() ? SessionPlannerRestKind.LONG_REST : SessionPlannerRestKind.SHORT_REST;
    }

    private static SessionPlannerStatePanelProjection buildStatePanel(
            boolean hasSelectedScene,
            List<SessionPlannerSceneTimelineProjection.SessionScene> sessionScenes
    ) {
        SessionPlannerSceneTimelineProjection.SessionScene selectedScene = sessionScenes.stream()
                .filter(SessionPlannerSceneTimelineProjection.SessionScene::selected)
                .findFirst()
                .orElse(null);
        if (selectedScene == null) {
            return new SessionPlannerStatePanelProjection(
                    false,
                    "Keine Session-Szene ausgewaehlt",
                    "Waehle im Planner eine Szene aus, um den vorbereitenden State-Kontext zu sehen.",
                    "",
                    hasSelectedScene
                            ? "Szene fuer State-Panel ausgewaehlt"
                            : "Noch keine Szene fuer State-Panel ausgewaehlt",
                    "Katalog-Vorbereitung",
                    "Planner-owned read-only Placeholder.");
        }
        String title = firstNonBlank(
                selectedScene.sceneTitle(),
                selectedScene.linkedEncounterName(),
                "Szene #" + selectedScene.sceneToken());
        String detail = selectedScene.linkedEncounterPlan()
                ? selectedScene.linkedEncounterCreatureCount() + " Kreaturen"
                        + (selectedScene.linkedEncounterGeneratedLabel().isBlank()
                                ? ""
                                : " · " + selectedScene.linkedEncounterGeneratedLabel())
                : "Keine verknuepfte Encounter-Planung";
        String xpSummary = selectedScene.budgetPercentage().stripTrailingZeros().toPlainString()
                + "% Budget · Ziel " + selectedScene.targetXp() + " XP · Ist "
                + selectedScene.linkedEncounterAdjustedXp() + " XP";
        return new SessionPlannerStatePanelProjection(
                true,
                title,
                detail,
                xpSummary,
                "Ausgewaehlte Szene #" + selectedScene.sceneToken(),
                "Katalog-Vorbereitung",
                "Planner-owned read-only Placeholder.");
    }

    private static List<SessionPlannerSessionSnapshot.LocationReference> buildLocationReferences(
            List<SessionLocationReference> locationReferences
    ) {
        return locationReferences.stream()
                .map(reference -> new SessionPlannerSessionSnapshot.LocationReference(
                        reference.locationId(),
                        reference.displayName()))
                .toList();
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

    private static int plannedEncounterXp(
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
            SessionPlannerForeignFacts facts
    ) {
        Map<Long, SessionEncounterPlanFact> loadedEncounters = new HashMap<>();
        for (SessionEncounter encounter : session.encounters()) {
            if (encounter.encounterPlanId() > NO_ENCOUNTER_PLAN_ID) {
                loadedEncounters.computeIfAbsent(encounter.encounterPlanId(), facts::loadEncounterPlan);
            }
        }
        return loadedEncounters;
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

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "";
    }

    private static String joinLevels(List<Integer> levels) {
        return levels.stream()
                .map(String::valueOf)
                .reduce((left, right) -> left + ", " + right)
                .orElse("-");
    }

    private record ProjectionContext(
            SessionActivePartyMembersFact partyMembersFact,
            List<SessionPlannerParticipantsProjection.SessionParticipant> participants,
            List<Integer> resolvedLevels,
            Map<Long, SessionEncounterPlanFact> loadedEncounters,
            SessionAdventuringDayBudgetFact budgetFact,
            int scaledBudgetXp
    ) {
    }
}
