package src.domain.sessionplanner.application;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import src.domain.sessionplanner.session.aggregate.SessionPlan;
import src.domain.sessionplanner.session.port.SessionEncounterFactsLookup;
import src.domain.sessionplanner.session.port.SessionPartyFactsLookup;
import src.domain.sessionplanner.session.value.SessionEncounter;
import src.domain.sessionplanner.session.value.SessionParticipantRef;
import src.domain.sessionplanner.session.value.SessionRestKind;
import src.domain.sessionplanner.session.value.SessionRestPlacement;

public final class AssembleSessionPlannerSnapshotUseCase {

    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private final CurrentSessionPlanRuntimeAccess runtime;

    public AssembleSessionPlannerSnapshotUseCase(CurrentSessionPlanRuntimeAccess runtime) {
        this.runtime = runtime;
    }

    public SessionPlannerReadData execute() {
        SessionPlan session = runtime.loadOrCreateCurrent();
        SessionPartyFactsLookup.ActivePartyMembersFact partyMembersFact = runtime.partyFacts().loadActivePartyMembers();
        Map<Long, SessionPartyFactsLookup.PartyMemberFact> activeMembers = indexMembers(partyMembersFact.members());
        List<SessionPlannerReadData.ParticipantData> participants = buildParticipants(session, activeMembers);
        List<Integer> resolvedLevels = participants.stream()
                .filter(SessionPlannerReadData.ParticipantData::available)
                .map(SessionPlannerReadData.ParticipantData::level)
                .toList();
        boolean sessionReady = !participants.isEmpty() && participants.stream().allMatch(SessionPlannerReadData.ParticipantData::available);
        Map<Long, SessionEncounterFactsLookup.EncounterPlanFact> loadedEncounters = loadSessionEncounterFacts(session);
        SessionPartyFactsLookup.AdventuringDayFact budgetFact = sessionReady
                ? runtime.partyFacts().calculateAdventuringDay(resolvedLevels, plannedEncounterXp(session, loadedEncounters))
                : SessionPartyFactsLookup.AdventuringDayFact.unavailable();
        int scaledBudgetXp = budgetFact.available() ? session.encounterDays().scaleBudget(budgetFact.totalBudgetXp()) : 0;
        SessionEncounterFactsLookup.EncounterPlanListFact encounterPlansFact = runtime.encounterFacts().listEncounterPlans();
        List<SessionPlannerReadData.AvailableEncounterPlanData> availablePlans =
                buildAvailablePlans(encounterPlansFact, loadedEncounters);
        List<SessionPlannerReadData.PlannedEncounterData> plannedEncounters =
                buildPlannedEncounters(session, scaledBudgetXp, loadedEncounters);
        List<SessionPlannerReadData.RestGapData> restGaps = buildRestGaps(session);
        int placedShortRests = countRests(session.restPlacements(), SessionRestKind.SHORT_REST);
        int placedLongRests = countRests(session.restPlacements(), SessionRestKind.LONG_REST);
        return new SessionPlannerReadData(
                buildPartyState(session, resolvedLevels, participants, partyMembersFact),
                new SessionPlannerReadData.SessionStateData(
                        session.sessionId(),
                        session.encounterDays().value(),
                        session.encounterDays().displayText(),
                        session.selectedEncounterId(),
                        session.selectedEncounterId() > 0L),
                buildXpBudgetState(session, budgetFact, scaledBudgetXp, loadedEncounters),
                buildRestAdviceState(budgetFact, placedShortRests, placedLongRests),
                SessionPlannerReadData.GoldBudgetData.placeholder(session.lootPlaceholders().size()),
                availablePlans,
                participants,
                plannedEncounters,
                restGaps,
                session.lootPlaceholders().stream()
                        .map(loot -> new SessionPlannerReadData.LootPlaceholderData(loot.lootId(), loot.label()))
                        .toList(),
                resolveStatus(session, participants, partyMembersFact, encounterPlansFact));
    }

    private static SessionPlannerReadData.PartyData buildPartyState(
            SessionPlan session,
            List<Integer> resolvedLevels,
            List<SessionPlannerReadData.ParticipantData> participants,
            SessionPartyFactsLookup.ActivePartyMembersFact partyMembersFact
    ) {
        int sessionSize = session.participantRefs().size();
        int averageLevel = resolvedLevels.isEmpty()
                ? 0
                : (int) Math.round(resolvedLevels.stream().mapToInt(Integer::intValue).average().orElse(0.0));
        String headline = sessionSize <= 0
                ? "Keine Session-Teilnehmer"
                : sessionSize + " Session-Teilnehmer";
        String detail;
        if (sessionSize <= 0) {
            detail = "Session hat noch keine Teilnehmer.";
        } else if (!partyMembersFact.available()) {
            detail = partyMembersFact.statusText().isBlank()
                    ? "Aktive Party ist derzeit nicht lesbar."
                    : partyMembersFact.statusText();
        } else {
            long missing = participants.stream().filter(participant -> !participant.available()).count();
            if (missing > 0) {
                detail = resolvedLevels.size() + " aufgeloest · " + missing + " fehlend";
            } else {
                detail = "Durchschnittsstufe " + averageLevel + " · Level " + joinLevels(resolvedLevels);
            }
        }
        return new SessionPlannerReadData.PartyData(
                resolvedLevels,
                sessionSize,
                averageLevel,
                sessionSize > 0 && participants.stream().allMatch(SessionPlannerReadData.ParticipantData::available),
                headline,
                detail);
    }

    private static SessionPlannerReadData.XpBudgetData buildXpBudgetState(
            SessionPlan session,
            SessionPartyFactsLookup.AdventuringDayFact budgetFact,
            int scaledBudgetXp,
            Map<Long, SessionEncounterFactsLookup.EncounterPlanFact> loadedEncounters
    ) {
        if (!budgetFact.available()) {
            return SessionPlannerReadData.XpBudgetData.empty();
        }
        int plannedXp = plannedEncounterXp(session, loadedEncounters);
        int remainingXp = Math.max(0, scaledBudgetXp - plannedXp);
        int overBudgetXp = Math.max(0, plannedXp - scaledBudgetXp);
        boolean overBudget = overBudgetXp > 0;
        return new SessionPlannerReadData.XpBudgetData(
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

    private static SessionPlannerReadData.RestAdviceData buildRestAdviceState(
            SessionPartyFactsLookup.AdventuringDayFact budgetFact,
            int placedShortRests,
            int placedLongRests
    ) {
        if (!budgetFact.available()) {
            return SessionPlannerReadData.RestAdviceData.empty();
        }
        return new SessionPlannerReadData.RestAdviceData(
                true,
                budgetFact.recommendedShortRests(),
                budgetFact.recommendedLongRests(),
                placedShortRests,
                placedLongRests,
                "Empfohlen " + budgetFact.recommendedShortRests() + " SR / " + budgetFact.recommendedLongRests()
                        + " LR · platziert " + placedShortRests + " SR / " + placedLongRests + " LR");
    }

    private List<SessionPlannerReadData.AvailableEncounterPlanData> buildAvailablePlans(
            SessionEncounterFactsLookup.EncounterPlanListFact encounterPlansFact,
            Map<Long, SessionEncounterFactsLookup.EncounterPlanFact> loadedEncounters
    ) {
        if (!encounterPlansFact.available()) {
            return List.of();
        }
        List<SessionPlannerReadData.AvailableEncounterPlanData> availablePlans = new ArrayList<>();
        for (SessionEncounterFactsLookup.SavedEncounterPlanFact plan : encounterPlansFact.plans()) {
            SessionEncounterFactsLookup.EncounterPlanFact detail = runtime.encounterFacts().loadEncounterPlan(plan.planId());
            loadedEncounters.put(plan.planId(), detail);
            availablePlans.add(new SessionPlannerReadData.AvailableEncounterPlanData(
                    plan.planId(),
                    detail.name().isBlank() ? plan.name() : detail.name(),
                    detail.generatedLabel().isBlank() ? plan.generatedLabel() : detail.generatedLabel(),
                    detail.creatureCount() <= 0 ? plan.creatureCount() : detail.creatureCount(),
                    detail.adjustedXp(),
                    detail.difficultyLabel(),
                    detail.statusText(),
                    detail.available()));
        }
        return List.copyOf(availablePlans);
    }

    private Map<Long, SessionEncounterFactsLookup.EncounterPlanFact> loadSessionEncounterFacts(SessionPlan session) {
        Map<Long, SessionEncounterFactsLookup.EncounterPlanFact> loadedEncounters = new HashMap<>();
        for (SessionEncounter encounter : session.encounters()) {
            loadedEncounters.computeIfAbsent(encounter.encounterPlanId(), runtime.encounterFacts()::loadEncounterPlan);
        }
        return loadedEncounters;
    }

    private List<SessionPlannerReadData.ParticipantData> buildParticipants(
            SessionPlan session,
            Map<Long, SessionPartyFactsLookup.PartyMemberFact> activeMembers
    ) {
        List<SessionPlannerReadData.ParticipantData> participants = new ArrayList<>();
        for (SessionParticipantRef participantRef : session.participantRefs()) {
            SessionPartyFactsLookup.PartyMemberFact member = activeMembers.get(participantRef.characterId());
            if (member == null) {
                participants.add(new SessionPlannerReadData.ParticipantData(
                        participantRef.characterId(),
                        "Charakter #" + participantRef.characterId(),
                        0,
                        false,
                        "Nicht mehr in der aktiven Party verfuegbar."));
            } else {
                participants.add(new SessionPlannerReadData.ParticipantData(
                        member.characterId(),
                        member.name(),
                        member.level(),
                        true,
                        ""));
            }
        }
        return List.copyOf(participants);
    }

    private List<SessionPlannerReadData.PlannedEncounterData> buildPlannedEncounters(
            SessionPlan session,
            int scaledBudgetXp,
            Map<Long, SessionEncounterFactsLookup.EncounterPlanFact> loadedEncounters
    ) {
        List<SessionPlannerReadData.PlannedEncounterData> plannedEncounters = new ArrayList<>();
        for (SessionEncounter encounter : session.encounters()) {
            SessionEncounterFactsLookup.EncounterPlanFact detail = loadedEncounters.computeIfAbsent(
                    encounter.encounterPlanId(),
                    runtime.encounterFacts()::loadEncounterPlan);
            int targetXp = encounter.allocation().budgetPercentage()
                    .multiply(BigDecimal.valueOf(scaledBudgetXp))
                    .divide(HUNDRED, 0, RoundingMode.HALF_UP)
                    .intValue();
            plannedEncounters.add(new SessionPlannerReadData.PlannedEncounterData(
                    encounter.encounterId().value(),
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
                    session.selectedEncounterId() == encounter.encounterId().value()));
        }
        return List.copyOf(plannedEncounters);
    }

    private static List<SessionPlannerReadData.RestGapData> buildRestGaps(SessionPlan session) {
        List<SessionPlannerReadData.RestGapData> gaps = new ArrayList<>();
        List<SessionEncounter> encounters = session.encounters();
        for (int index = 0; index < encounters.size() - 1; index++) {
            SessionEncounter left = encounters.get(index);
            SessionEncounter right = encounters.get(index + 1);
            SessionRestKind restKind = SessionRestKind.NONE;
            for (SessionRestPlacement placement : session.restPlacements()) {
                if (placement.leftEncounterId().value() == left.encounterId().value()
                        && placement.rightEncounterId().value() == right.encounterId().value()) {
                    restKind = placement.restKind();
                    break;
                }
            }
            gaps.add(new SessionPlannerReadData.RestGapData(
                    index,
                    left.encounterId().value(),
                    right.encounterId().value(),
                    restKind));
        }
        return List.copyOf(gaps);
    }

    private static String resolveStatus(
            SessionPlan session,
            List<SessionPlannerReadData.ParticipantData> participants,
            SessionPartyFactsLookup.ActivePartyMembersFact partyMembersFact,
            SessionEncounterFactsLookup.EncounterPlanListFact encounterPlansFact
    ) {
        if (!session.statusText().isBlank()) {
            return session.statusText();
        }
        if (participants.isEmpty()) {
            return "Session hat noch keine Teilnehmer.";
        }
        boolean missingParticipants = participants.stream().anyMatch(participant -> !participant.available());
        if (missingParticipants) {
            return "Session enthaelt nicht mehr aufloesbare Teilnehmer-Referenzen.";
        }
        if (!partyMembersFact.available()) {
            return partyMembersFact.statusText().isBlank()
                    ? "Aktive Party konnte nicht geladen werden."
                    : partyMembersFact.statusText();
        }
        if (!encounterPlansFact.available()) {
            return encounterPlansFact.statusText().isBlank()
                    ? "Encounter-Plaene konnten nicht geladen werden."
                    : encounterPlansFact.statusText();
        }
        if (encounterPlansFact.plans().isEmpty()) {
            return "Keine gespeicherten Encounter-Plaene gefunden.";
        }
        return "";
    }

    private static Map<Long, SessionPartyFactsLookup.PartyMemberFact> indexMembers(
            List<SessionPartyFactsLookup.PartyMemberFact> members
    ) {
        Map<Long, SessionPartyFactsLookup.PartyMemberFact> indexed = new HashMap<>();
        for (SessionPartyFactsLookup.PartyMemberFact member : members) {
            indexed.put(member.characterId(), member);
        }
        return indexed;
    }

    private static int plannedEncounterXp(
            SessionPlan session,
            Map<Long, SessionEncounterFactsLookup.EncounterPlanFact> loadedEncounters
    ) {
        return session.encounters().stream()
                .mapToInt(encounter -> loadedEncounters.getOrDefault(
                        encounter.encounterPlanId(),
                        SessionEncounterFactsLookup.EncounterPlanFact.unavailable(
                                encounter.encounterPlanId(),
                                "Encounter-Plan fehlt.")).adjustedXp())
                .sum();
    }

    private static int countRests(List<SessionRestPlacement> placements, SessionRestKind expectedKind) {
        return (int) placements.stream()
                .filter(placement -> placement.restKind() == expectedKind)
                .count();
    }

    private static String joinLevels(List<Integer> levels) {
        return levels.stream()
                .map(String::valueOf)
                .reduce((left, right) -> left + ", " + right)
                .orElse("-");
    }
}
