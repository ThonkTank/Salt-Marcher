package src.data.sessionplanner.mapper;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import src.domain.sessionplanner.published.SessionPlannerEncountersProjection;
import src.domain.sessionplanner.published.SessionPlannerParticipantsProjection;
import src.domain.sessionplanner.published.SessionPlannerRestKind;
import src.domain.sessionplanner.published.SessionPlannerSessionSnapshot;
import src.domain.sessionplanner.published.SessionPlannerStatePanelProjection;
import src.domain.sessionplanner.model.session.model.SessionEncounter;
import src.domain.sessionplanner.model.session.model.SessionPlan;
import src.domain.sessionplanner.model.session.model.SessionRestPlacement;
import src.domain.sessionplanner.model.session.port.SessionEncounterFactsPort;
import src.domain.sessionplanner.model.session.port.SessionPartyFactsPort;

@SuppressWarnings({
        "PMD.CouplingBetweenObjects",
        "PMD.GodClass",
        "PMD.TooManyMethods"
})
public final class SessionPlannerPublishedStateProjector {

    private static final BigDecimal HUNDRED = new BigDecimal("100");

    public SessionPlannerSessionSnapshot projectSession(
            SessionPlan session,
            SessionPartyFactsPort partyFacts,
            SessionEncounterFactsPort encounterFacts
    ) {
        ProjectionContext context = buildContext(session, partyFacts, encounterFacts);
        SessionEncounterFactsPort.EncounterPlanListFact encounterPlansFact = encounterFacts.listEncounterPlans();
        List<SessionPlannerSessionSnapshot.AvailableEncounterPlan> availablePlans =
                buildAvailablePlans(encounterPlansFact, context.loadedEncounters(), encounterFacts);
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

    public SessionPlannerParticipantsProjection projectParticipants(
            SessionPlan session,
            SessionPartyFactsPort partyFacts
    ) {
        ProjectionContext context = buildParticipantContext(session, partyFacts);
        return new SessionPlannerParticipantsProjection(
                buildPartyState(session, context.resolvedLevels(), context.participants(), context.partyMembersFact()),
                buildActivePartyMembers(context.partyMembersFact().members()),
                context.participants());
    }

    public SessionPlannerEncountersProjection projectEncounters(
            SessionPlan session,
            SessionPartyFactsPort partyFacts,
            SessionEncounterFactsPort encounterFacts
    ) {
        ProjectionContext context = buildContext(session, partyFacts, encounterFacts);
        return new SessionPlannerEncountersProjection(
                buildPlannedEncounters(session, context.scaledBudgetXp(), context.loadedEncounters(), encounterFacts),
                buildRestGaps(session),
                session.lootPlaceholders().stream()
                        .map(loot -> new SessionPlannerEncountersProjection.LootPlaceholder(loot.lootId(), loot.label()))
                        .toList());
    }

    public SessionPlannerStatePanelProjection projectStatePanel(
            SessionPlan session,
            SessionPartyFactsPort partyFacts,
            SessionEncounterFactsPort encounterFacts
    ) {
        ProjectionContext context = buildContext(session, partyFacts, encounterFacts);
        SessionPlannerSessionSnapshot sessionSnapshot = projectSession(session, partyFacts, encounterFacts);
        return buildStatePanel(
                sessionSnapshot,
                buildPlannedEncounters(session, context.scaledBudgetXp(), context.loadedEncounters(), encounterFacts));
    }

    private static ProjectionContext buildContext(
            SessionPlan session,
            SessionPartyFactsPort partyFacts,
            SessionEncounterFactsPort encounterFacts
    ) {
        ProjectionContext participantContext = buildParticipantContext(session, partyFacts);
        boolean sessionReady = !participantContext.participants().isEmpty()
                && participantContext.participants().stream()
                .allMatch(SessionPlannerParticipantsProjection.SessionParticipant::available);
        Map<Long, SessionEncounterFactsPort.EncounterPlanFact> loadedEncounters =
                loadSessionEncounterFacts(session, encounterFacts);
        SessionPartyFactsPort.AdventuringDayFact budgetFact = sessionReady
                ? partyFacts.calculateAdventuringDay(
                        participantContext.resolvedLevels(),
                        plannedEncounterXp(session, loadedEncounters))
                : SessionPartyFactsPort.AdventuringDayFact.unavailable();
        int scaledBudgetXp = budgetFact.available() ? session.encounterDays().scaleBudget(budgetFact.totalBudgetXp()) : 0;
        return new ProjectionContext(
                participantContext.partyMembersFact(),
                participantContext.participants(),
                participantContext.resolvedLevels(),
                loadedEncounters,
                budgetFact,
                scaledBudgetXp);
    }

    private static ProjectionContext buildParticipantContext(
            SessionPlan session,
            SessionPartyFactsPort partyFacts
    ) {
        SessionPartyFactsPort.ActivePartyMembersFact partyMembersFact = partyFacts.loadActivePartyMembers();
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
                SessionPartyFactsPort.AdventuringDayFact.unavailable(),
                0);
    }

    private static SessionPlannerParticipantsProjection.PartyState buildPartyState(
            SessionPlan session,
            List<Integer> resolvedLevels,
            List<SessionPlannerParticipantsProjection.SessionParticipant> participants,
            SessionPartyFactsPort.ActivePartyMembersFact partyMembersFact
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
            SessionPartyFactsPort.AdventuringDayFact budgetFact,
            int scaledBudgetXp,
            Map<Long, SessionEncounterFactsPort.EncounterPlanFact> loadedEncounters
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
            SessionPartyFactsPort.AdventuringDayFact budgetFact,
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
            SessionEncounterFactsPort.EncounterPlanListFact encounterPlansFact,
            Map<Long, SessionEncounterFactsPort.EncounterPlanFact> loadedEncounters,
            SessionEncounterFactsPort encounterFacts
    ) {
        if (!encounterPlansFact.available()) {
            return List.of();
        }
        List<SessionPlannerSessionSnapshot.AvailableEncounterPlan> availablePlans = new ArrayList<>();
        for (SessionEncounterFactsPort.SavedEncounterPlanFact plan : encounterPlansFact.plans()) {
            SessionEncounterFactsPort.EncounterPlanFact detail = encounterFacts.loadEncounterPlan(plan.planId());
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

    private static Map<Long, SessionEncounterFactsPort.EncounterPlanFact> loadSessionEncounterFacts(
            SessionPlan session,
            SessionEncounterFactsPort encounterFacts
    ) {
        Map<Long, SessionEncounterFactsPort.EncounterPlanFact> loadedEncounters = new HashMap<>();
        for (SessionEncounter encounter : session.encounters()) {
            loadedEncounters.computeIfAbsent(encounter.encounterPlanId(), encounterFacts::loadEncounterPlan);
        }
        return loadedEncounters;
    }

    private static List<SessionPlannerParticipantsProjection.SessionParticipant> buildParticipants(
            SessionPlan session,
            SessionPartyFactsPort.ActivePartyMembersFact activeMembers
    ) {
        List<SessionPlannerParticipantsProjection.SessionParticipant> participants = new ArrayList<>();
        for (Long participantRef : session.participantRefs()) {
            SessionPartyFactsPort.PartyMemberProfile member = activeMembers.resolve(participantRef);
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
            List<SessionPartyFactsPort.PartyMemberProfile> members
    ) {
        List<SessionPlannerParticipantsProjection.ActivePartyMember> activePartyMembers = new ArrayList<>();
        for (SessionPartyFactsPort.PartyMemberProfile member
                : members == null ? List.<SessionPartyFactsPort.PartyMemberProfile>of() : members) {
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
            Map<Long, SessionEncounterFactsPort.EncounterPlanFact> loadedEncounters,
            SessionEncounterFactsPort encounterFacts
    ) {
        List<SessionPlannerEncountersProjection.PlannedEncounter> plannedEncounters = new ArrayList<>();
        for (SessionEncounter encounter : session.encounters()) {
            SessionEncounterFactsPort.EncounterPlanFact detail = loadedEncounters.computeIfAbsent(
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
            SessionPartyFactsPort.ActivePartyMembersFact partyMembersFact,
            SessionEncounterFactsPort.EncounterPlanListFact encounterPlansFact,
            String sessionStatusText
    ) {
        if (sessionStatusText != null && !sessionStatusText.isBlank()) {
            return sessionStatusText;
        }
        if (participants.isEmpty()) {
            return "Session hat noch keine Teilnehmer.";
        }
        if (hasMissingParticipants(participants)) {
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
        if (encounterPlansFact.plans().isEmpty()) {
            return "Keine gespeicherten Encounter-Plaene gefunden.";
        }
        return "";
    }

    private static int plannedEncounterXp(
            SessionPlan session,
            Map<Long, SessionEncounterFactsPort.EncounterPlanFact> loadedEncounters
    ) {
        return session.encounters().stream()
                .mapToInt(encounter -> loadedEncounters.getOrDefault(
                        encounter.encounterPlanId(),
                        SessionEncounterFactsPort.EncounterPlanFact.unavailable(
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
        return placements.stream()
                .filter(placement -> placement.matchesGap(leftEncounterId, rightEncounterId))
                .findFirst()
                .map(SessionPlannerPublishedStateProjector::toRestKind)
                .orElse(SessionPlannerRestKind.NONE);
    }

    private static String joinLevels(List<Integer> levels) {
        return levels.stream()
                .map(String::valueOf)
                .reduce((left, right) -> left + ", " + right)
                .orElse("-");
    }

    private static boolean hasMissingParticipants(
            List<SessionPlannerParticipantsProjection.SessionParticipant> participants
    ) {
        return participants.stream().anyMatch(participant -> !participant.available());
    }

    private static String unavailableStatus(boolean available, String statusText, String fallbackMessage) {
        if (available) {
            return "";
        }
        return statusText == null || statusText.isBlank() ? fallbackMessage : statusText;
    }

    private static SessionPlannerRestKind toRestKind(SessionRestPlacement placement) {
        return placement.isLongRest() ? SessionPlannerRestKind.LONG_REST : SessionPlannerRestKind.SHORT_REST;
    }

    private record ProjectionContext(
            SessionPartyFactsPort.ActivePartyMembersFact partyMembersFact,
            List<SessionPlannerParticipantsProjection.SessionParticipant> participants,
            List<Integer> resolvedLevels,
            Map<Long, SessionEncounterFactsPort.EncounterPlanFact> loadedEncounters,
            SessionPartyFactsPort.AdventuringDayFact budgetFact,
            int scaledBudgetXp
    ) {
    }
}
