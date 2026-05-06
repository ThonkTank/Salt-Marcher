package src.domain.sessionplanner.application;

import java.math.BigDecimal;
import java.util.List;
import src.domain.sessionplanner.session.value.SessionRestKind;

public record SessionPlannerReadData(
        PartyData party,
        SessionStateData session,
        XpBudgetData xpBudget,
        RestAdviceData restAdvice,
        GoldBudgetData goldBudget,
        List<AvailableEncounterPlanData> availableEncounterPlans,
        List<ParticipantData> participants,
        List<PlannedEncounterData> plannedEncounters,
        List<RestGapData> restGaps,
        List<LootPlaceholderData> lootPlaceholders,
        String status
) {

    public SessionPlannerReadData {
        party = party == null ? PartyData.empty() : party;
        session = session == null ? SessionStateData.empty() : session;
        xpBudget = xpBudget == null ? XpBudgetData.empty() : xpBudget;
        restAdvice = restAdvice == null ? RestAdviceData.empty() : restAdvice;
        goldBudget = goldBudget == null ? GoldBudgetData.placeholder(0) : goldBudget;
        availableEncounterPlans = copy(availableEncounterPlans);
        participants = copy(participants);
        plannedEncounters = copy(plannedEncounters);
        restGaps = copy(restGaps);
        lootPlaceholders = copy(lootPlaceholders);
        status = status == null ? "" : status;
    }

    public record PartyData(
            List<Integer> resolvedLevels,
            int participantCount,
            int averageLevel,
            boolean ready,
            String headline,
            String detail
    ) {

        public PartyData {
            resolvedLevels = copy(resolvedLevels);
            participantCount = Math.max(0, participantCount);
            averageLevel = Math.max(0, averageLevel);
            headline = headline == null ? "" : headline;
            detail = detail == null ? "" : detail;
        }

        static PartyData empty() {
            return new PartyData(List.of(), 0, 0, false, "Keine Session-Teilnehmer", "Session hat noch keine Teilnehmer.");
        }
    }

    public record SessionStateData(
            long sessionId,
            BigDecimal encounterDays,
            String encounterDaysText,
            long selectedEncounterId,
            boolean hasSelectedEncounter
    ) {

        public SessionStateData {
            sessionId = Math.max(0L, sessionId);
            encounterDays = encounterDays == null ? BigDecimal.ONE : encounterDays;
            encounterDaysText = encounterDaysText == null ? encounterDays.stripTrailingZeros().toPlainString() : encounterDaysText;
            selectedEncounterId = Math.max(0L, selectedEncounterId);
        }

        static SessionStateData empty() {
            return new SessionStateData(0L, BigDecimal.ONE, "1", 0L, false);
        }
    }

    public record XpBudgetData(
            boolean available,
            int totalBudgetXp,
            int plannedEncounterXp,
            int remainingXp,
            int overBudgetXp,
            int firstShortRestXp,
            int secondShortRestXp,
            double progressFraction,
            boolean overBudget,
            String summary
    ) {

        public XpBudgetData {
            totalBudgetXp = Math.max(0, totalBudgetXp);
            plannedEncounterXp = Math.max(0, plannedEncounterXp);
            remainingXp = Math.max(0, remainingXp);
            overBudgetXp = Math.max(0, overBudgetXp);
            firstShortRestXp = Math.max(0, firstShortRestXp);
            secondShortRestXp = Math.max(0, secondShortRestXp);
            progressFraction = Math.max(0.0, progressFraction);
            summary = summary == null ? "" : summary;
        }

        static XpBudgetData empty() {
            return new XpBudgetData(false, 0, 0, 0, 0, 0, 0, 0.0, false, "Kein XP-Budget verfuegbar.");
        }
    }

    public record RestAdviceData(
            boolean available,
            int recommendedShortRests,
            int recommendedLongRests,
            int placedShortRests,
            int placedLongRests,
            String summary
    ) {

        public RestAdviceData {
            recommendedShortRests = Math.max(0, recommendedShortRests);
            recommendedLongRests = Math.max(0, recommendedLongRests);
            placedShortRests = Math.max(0, placedShortRests);
            placedLongRests = Math.max(0, placedLongRests);
            summary = summary == null ? "" : summary;
        }

        static RestAdviceData empty() {
            return new RestAdviceData(false, 0, 0, 0, 0, "Keine Rastempfehlung verfuegbar.");
        }
    }

    public record GoldBudgetData(
            boolean available,
            String headline,
            String detail
    ) {

        public GoldBudgetData {
            headline = headline == null ? "" : headline;
            detail = detail == null ? "" : detail;
        }

        static GoldBudgetData placeholder(int lootPlaceholderCount) {
            return new GoldBudgetData(
                    false,
                    "Goldbudget offen",
                    lootPlaceholderCount <= 0
                            ? "Loot-Platzhalter sind vorbereitet, aber Gold wird noch nicht berechnet."
                            : lootPlaceholderCount + " Loot-Platzhalter sichtbar, Goldbudget weiterhin offen.");
        }
    }

    public record AvailableEncounterPlanData(
            long planId,
            String name,
            String generatedLabel,
            int creatureCount,
            int adjustedXp,
            String difficultyLabel,
            String statusText,
            boolean importEnabled
    ) {
    }

    public record ParticipantData(
            long characterId,
            String name,
            int level,
            boolean available,
            String statusText
    ) {
    }

    public record PlannedEncounterData(
            long encounterId,
            long encounterPlanId,
            String name,
            String generatedLabel,
            int creatureCount,
            int totalBaseXp,
            int adjustedXp,
            double xpMultiplier,
            String difficultyLabel,
            BigDecimal budgetPercentage,
            int targetXp,
            boolean selected
    ) {
    }

    public record RestGapData(
            int gapIndex,
            long leftEncounterId,
            long rightEncounterId,
            SessionRestKind restKind
    ) {
    }

    public record LootPlaceholderData(
            long token,
            String label
    ) {
    }

    private static <T> List<T> copy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
