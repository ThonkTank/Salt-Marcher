package src.data.sessionplanner.mapper;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import src.data.sessionplanner.model.SessionPlannerPublishedState;
import src.domain.sessionplanner.published.SessionPlannerEncountersProjection;
import src.domain.sessionplanner.published.SessionPlannerParticipantsProjection;
import src.domain.sessionplanner.published.SessionPlannerRestKind;
import src.domain.sessionplanner.published.SessionPlannerSessionSnapshot;
import src.domain.sessionplanner.published.SessionPlannerStatePanelProjection;
import src.domain.sessionplanner.session.aggregate.SessionPlan;
import src.domain.sessionplanner.session.port.SessionEncounterFactsLookup;
import src.domain.sessionplanner.session.port.SessionPartyFactsLookup;
import src.domain.sessionplanner.session.value.SessionEncounter;
import src.domain.sessionplanner.session.value.SessionRestPlacement;

public final class SessionPlannerPublishedStateProjector {

    private static final BigDecimal HUNDRED = new BigDecimal("100");

    public SessionPlannerPublishedState project(
            SessionPlan session,
            SessionPartyFactsLookup partyFacts,
            SessionEncounterFactsLookup encounterFacts
    ) {
        SessionPartyFactsLookup.ActivePartyMembersFact partyMembersFact = partyFacts.loadActivePartyMembers();
        List<SessionPlannerParticipantsProjection.SessionParticipant> participants =
                buildParticipants(session, partyMembersFact);
        List<Integer> resolvedLevels = participants.stream()
                .filter(SessionPlannerParticipantsProjection.SessionParticipant::available)
                .map(SessionPlannerParticipantsProjection.SessionParticipant::level)
                .toList();
        boolean sessionReady = !participants.isEmpty()
                && participants.stream().allMatch(SessionPlannerParticipantsProjection.SessionParticipant::available);
        Map<Long, SessionEncounterFactsLookup.EncounterPlanFact> loadedEncounters =
                loadSessionEncounterFacts(session, encounterFacts);
        SessionPartyFactsLookup.AdventuringDayFact budgetFact = sessionReady
                ? partyFacts.calculateAdventuringDay(resolvedLevels, plannedEncounterXp(session, loadedEncounters))
                : SessionPartyFactsLookup.AdventuringDayFact.unavailable();
        int scaledBudgetXp = budgetFact.available() ? session.encounterDays().scaleBudget(budgetFact.totalBudgetXp()) : 0;
        SessionEncounterFactsLookup.EncounterPlanListFact encounterPlansFact = encounterFacts.listEncounterPlans();
        List<SessionPlannerSessionSnapshot.AvailableEncounterPlan> availablePlans =
                buildAvailablePlans(encounterPlansFact, loadedEncounters, encounterFacts);
        List<SessionPlannerEncountersProjection.PlannedEncounter> plannedEncounters =
                buildPlannedEncounters(session, scaledBudgetXp, loadedEncounters, encounterFacts);
        int placedShortRests = countShortRests(session.restPlacements());
        int placedLongRests = countLongRests(session.restPlacements());
        SessionPlannerSessionSnapshot sessionSnapshot = new SessionPlannerSessionSnapshot(
                new SessionPlannerSessionSnapshot.SessionState(
                        session.sessionId(),
                        session.encounterDays().value(),
                        session.encounterDays().displayText(),
                        session.selectedEncounterId(),
                        session.selectedEncounterId() > 0L),
                buildXpBudgetState(session, budgetFact, scaledBudgetXp, loadedEncounters),
                buildRestAdviceState(budgetFact, placedShortRests, placedLongRests),
                SessionPlannerSessionSnapshot.GoldBudgetState.placeholder(session.lootPlaceholders().size()),
                availablePlans,
                resolveStatus(participants, partyMembersFact, encounterPlansFact, session.statusText()));
        SessionPlannerParticipantsProjection participantsProjection = new SessionPlannerParticipantsProjection(
                buildPartyState(session, resolvedLevels, participants, partyMembersFact),
                buildActivePartyMembers(partyMembersFact.members()),
                participants);
        SessionPlannerEncountersProjection encountersProjection = new SessionPlannerEncountersProjection(
                plannedEncounters,
                buildRestGaps(session),
                session.lootPlaceholders().stream()
                        .map(loot -> new SessionPlannerEncountersProjection.LootPlaceholder(loot.lootId(), loot.label()))
                        .toList());
        return new SessionPlannerPublishedState(
                sessionSnapshot,
                participantsProjection,
                encountersProjection,
                buildStatePanel(sessionSnapshot, plannedEncounters));
    }

    private static SessionPlannerParticipantsProjection.PartyState buildPartyState(
            SessionPlan session,
            List<Integer> resolvedLevels,
            List<SessionPlannerParticipantsProjection.SessionParticipant> participants,
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
        return new SessionPlannerParticipantsProjection.PartyState(
                resolvedLevels,
                sessionSize,
                averageLevel,
                sessionSize > 0 && participants.stream().allMatch(SessionPlannerParticipantsProjection.SessionParticipant::available),
                headline,
                detail);
    }

    private static SessionPlannerSessionSnapshot.XpBudgetState buildXpBudgetState(
            SessionPlan session,
            SessionPartyFactsLookup.AdventuringDayFact budgetFact,
            int scaledBudgetXp,
            Map<Long, SessionEncounterFactsLookup.EncounterPlanFact> loadedEncounters
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
            SessionPartyFactsLookup.AdventuringDayFact budgetFact,
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
            SessionEncounterFactsLookup.EncounterPlanListFact encounterPlansFact,
            Map<Long, SessionEncounterFactsLookup.EncounterPlanFact> loadedEncounters,
            SessionEncounterFactsLookup encounterFacts
    ) {
        if (!encounterPlansFact.available()) {
            return List.of();
        }
        List<SessionPlannerSessionSnapshot.AvailableEncounterPlan> availablePlans = new ArrayList<>();
        for (SessionEncounterFactsLookup.SavedEncounterPlanFact plan : encounterPlansFact.plans()) {
            SessionEncounterFactsLookup.EncounterPlanFact detail = encounterFacts.loadEncounterPlan(plan.planId());
            loadedEncounters.put(plan.planId(), detail);
            availablePlans.add(new SessionPlannerSessionSnapshot.AvailableEncounterPlan(
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

    private static Map<Long, SessionEncounterFactsLookup.EncounterPlanFact> loadSessionEncounterFacts(
            SessionPlan session,
            SessionEncounterFactsLookup encounterFacts
    ) {
        Map<Long, SessionEncounterFactsLookup.EncounterPlanFact> loadedEncounters = new HashMap<>();
        for (SessionEncounter encounter : session.encounters()) {
            loadedEncounters.computeIfAbsent(encounter.encounterPlanId(), encounterFacts::loadEncounterPlan);
        }
        return loadedEncounters;
    }

    private static List<SessionPlannerParticipantsProjection.SessionParticipant> buildParticipants(
            SessionPlan session,
            SessionPartyFactsLookup.ActivePartyMembersFact activeMembers
    ) {
        List<SessionPlannerParticipantsProjection.SessionParticipant> participants = new ArrayList<>();
        for (Long participantRef : session.participantRefs()) {
            SessionPartyFactsLookup.PartyMemberProfile member = activeMembers.resolve(participantRef);
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

    private static List<SessionPlannerParticipantsProjection.ActivePartyMember> buildActivePartyMembers(
            List<SessionPartyFactsLookup.PartyMemberProfile> members
    ) {
        List<SessionPlannerParticipantsProjection.ActivePartyMember> activePartyMembers = new ArrayList<>();
        for (SessionPartyFactsLookup.PartyMemberProfile member
                : members == null ? List.<SessionPartyFactsLookup.PartyMemberProfile>of() : members) {
            activePartyMembers.add(new SessionPlannerParticipantsProjection.ActivePartyMember(
                    member.characterId(),
                    member.displayName(),
                    member.currentLevel()));
        }
        return List.copyOf(activePartyMembers);
    }

    private static List<SessionPlannerEncountersProjection.PlannedEncounter> buildPlannedEncounters(
            SessionPlan session,
            int scaledBudgetXp,
            Map<Long, SessionEncounterFactsLookup.EncounterPlanFact> loadedEncounters,
            SessionEncounterFactsLookup encounterFacts
    ) {
        List<SessionPlannerEncountersProjection.PlannedEncounter> plannedEncounters = new ArrayList<>();
        for (SessionEncounter encounter : session.encounters()) {
            SessionEncounterFactsLookup.EncounterPlanFact detail = loadedEncounters.computeIfAbsent(
                    encounter.encounterPlanId(),
                    encounterFacts::loadEncounterPlan);
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

    private static SessionPlannerStatePanelProjection buildStatePanel(
            SessionPlannerSessionSnapshot session,
            List<SessionPlannerEncountersProjection.PlannedEncounter> encounters
    ) {
        SessionPlannerEncountersProjection.PlannedEncounter selectedEncounter = encounters.stream()
                .filter(SessionPlannerEncountersProjection.PlannedEncounter::selected)
                .findFirst()
                .orElse(null);
        if (selectedEncounter == null) {
            return new SessionPlannerStatePanelProjection(
                    false,
                    "Kein Session-Encounter ausgewaehlt",
                    "Waehle im Planner einen Encounter aus, um den vorbereitenden State-Kontext zu sehen.",
                    "",
                    session.session().hasSelectedEncounter()
                            ? "Encounter fuer State-Panel ausgewaehlt"
                            : "Noch kein Encounter fuer State-Panel ausgewaehlt",
                    "Katalog-Vorbereitung",
                    "Der generische Katalog folgt spaeter. Dieser Slice reserviert nur die planner-eigene read-only Flaeche.");
        }
        String detail = selectedEncounter.creatureCount() + " Kreaturen"
                + (selectedEncounter.generatedLabel().isBlank() ? "" : " · " + selectedEncounter.generatedLabel());
        String xpSummary = selectedEncounter.budgetPercentage().stripTrailingZeros().toPlainString() + "% Budget · Ziel "
                + selectedEncounter.targetXp() + " XP · Ist " + selectedEncounter.adjustedXp() + " XP";
        return new SessionPlannerStatePanelProjection(
                true,
                selectedEncounter.name(),
                detail,
                xpSummary,
                "Ausgewaehlter Encounter #" + selectedEncounter.token(),
                "Katalog-Vorbereitung",
                "Read-only Placeholder fuer spaetere Monster-, Spell- und Loot-Aktionen. Noch keine echte Catalog-Boundary und keine Mutation.");
    }

    private static String resolveStatus(
            List<SessionPlannerParticipantsProjection.SessionParticipant> participants,
            SessionPartyFactsLookup.ActivePartyMembersFact partyMembersFact,
            SessionEncounterFactsLookup.EncounterPlanListFact encounterPlansFact,
            String sessionStatusText
    ) {
        if (sessionStatusText != null && !sessionStatusText.isBlank()) {
            return sessionStatusText;
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

    private static SessionPlannerRestKind restKindForGap(
            long leftEncounterId,
            long rightEncounterId,
            List<SessionRestPlacement> placements
    ) {
        for (SessionRestPlacement placement : placements) {
            if (!placement.matchesGap(leftEncounterId, rightEncounterId)) {
                continue;
            }
            return placement.isLongRest()
                    ? SessionPlannerRestKind.LONG_REST
                    : SessionPlannerRestKind.SHORT_REST;
        }
        return SessionPlannerRestKind.NONE;
    }

    private static String joinLevels(List<Integer> levels) {
        return levels.stream()
                .map(String::valueOf)
                .reduce((left, right) -> left + ", " + right)
                .orElse("-");
    }
}
