package src.domain.sessionplanner.published;

import java.math.BigDecimal;
import java.util.List;

public record SessionPlannerSnapshot(
        PartyState party,
        SessionState session,
        XpBudgetState xpBudget,
        RestAdviceState restAdvice,
        GoldBudgetState goldBudget,
        List<AvailableEncounterPlan> availableEncounterPlans,
        List<ActivePartyMember> activePartyMembers,
        List<SessionParticipant> participants,
        List<PlannedEncounter> plannedEncounters,
        List<RestGap> restGaps,
        List<LootPlaceholder> lootPlaceholders,
        String status
) {

    public SessionPlannerSnapshot {
        party = party == null ? PartyState.empty() : party;
        session = session == null ? SessionState.empty() : session;
        xpBudget = xpBudget == null ? XpBudgetState.empty() : xpBudget;
        restAdvice = restAdvice == null ? RestAdviceState.empty() : restAdvice;
        goldBudget = goldBudget == null ? GoldBudgetState.placeholder(0) : goldBudget;
        availableEncounterPlans = copy(availableEncounterPlans);
        activePartyMembers = copy(activePartyMembers);
        participants = copy(participants);
        plannedEncounters = copy(plannedEncounters);
        restGaps = copy(restGaps);
        lootPlaceholders = copy(lootPlaceholders);
        status = status == null ? "" : status;
    }

    public static SessionPlannerSnapshot empty(String status) {
        return new SessionPlannerSnapshot(
                PartyState.empty(),
                SessionState.empty(),
                XpBudgetState.empty(),
                RestAdviceState.empty(),
                GoldBudgetState.placeholder(0),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                status);
    }

    public record PartyState(
            List<Integer> activePartyLevels,
            int activePartySize,
            int averageLevel,
            boolean ready,
            String headline,
            String detail
    ) {

        public PartyState {
            activePartyLevels = copy(activePartyLevels);
            headline = headline == null ? "" : headline;
            detail = detail == null ? "" : detail;
            activePartySize = Math.max(0, activePartySize);
            averageLevel = Math.max(0, averageLevel);
        }

        public static PartyState empty() {
            return new PartyState(List.of(), 0, 0, false, "Keine Session-Teilnehmer", "Session hat noch keine Teilnehmer.");
        }
    }

    public record SessionState(
            long sessionId,
            BigDecimal encounterDays,
            String encounterDaysText,
            long selectedEncounterId,
            boolean hasSelectedEncounter
    ) {

        public SessionState {
            sessionId = Math.max(0L, sessionId);
            encounterDays = encounterDays == null ? BigDecimal.ONE : encounterDays;
            encounterDaysText = encounterDaysText == null ? encounterDays.stripTrailingZeros().toPlainString() : encounterDaysText;
            selectedEncounterId = Math.max(0L, selectedEncounterId);
        }

        public static SessionState empty() {
            return new SessionState(0L, BigDecimal.ONE, "1", 0L, false);
        }
    }

    public record XpBudgetState(
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

        public XpBudgetState {
            totalBudgetXp = Math.max(0, totalBudgetXp);
            plannedEncounterXp = Math.max(0, plannedEncounterXp);
            remainingXp = Math.max(0, remainingXp);
            overBudgetXp = Math.max(0, overBudgetXp);
            firstShortRestXp = Math.max(0, firstShortRestXp);
            secondShortRestXp = Math.max(0, secondShortRestXp);
            progressFraction = Math.max(0.0, progressFraction);
            summary = summary == null ? "" : summary;
        }

        public static XpBudgetState empty() {
            return new XpBudgetState(false, 0, 0, 0, 0, 0, 0, 0.0, false, "Kein XP-Budget verfuegbar.");
        }
    }

    public record RestAdviceState(
            boolean available,
            int recommendedShortRests,
            int recommendedLongRests,
            int placedShortRests,
            int placedLongRests,
            String summary
    ) {

        public RestAdviceState {
            recommendedShortRests = Math.max(0, recommendedShortRests);
            recommendedLongRests = Math.max(0, recommendedLongRests);
            placedShortRests = Math.max(0, placedShortRests);
            placedLongRests = Math.max(0, placedLongRests);
            summary = summary == null ? "" : summary;
        }

        public static RestAdviceState empty() {
            return new RestAdviceState(false, 0, 0, 0, 0, "Keine Rastempfehlung verfuegbar.");
        }
    }

    public record GoldBudgetState(
            boolean available,
            String headline,
            String detail
    ) {

        public GoldBudgetState {
            headline = headline == null ? "" : headline;
            detail = detail == null ? "" : detail;
        }

        public static GoldBudgetState placeholder(int lootPlaceholderCount) {
            return new GoldBudgetState(
                    false,
                    "Goldbudget offen",
                    lootPlaceholderCount <= 0
                            ? "Loot-Platzhalter sind vorbereitet, aber Gold wird noch nicht berechnet."
                            : lootPlaceholderCount + " Loot-Platzhalter sichtbar, Goldbudget weiterhin offen.");
        }
    }

    public record AvailableEncounterPlan(
            long planId,
            String name,
            String generatedLabel,
            int creatureCount,
            int adjustedXp,
            String difficultyLabel,
            String statusText,
            boolean importEnabled
    ) {

        public AvailableEncounterPlan {
            name = name == null ? "" : name.trim();
            generatedLabel = generatedLabel == null ? "" : generatedLabel.trim();
            creatureCount = Math.max(0, creatureCount);
            adjustedXp = Math.max(0, adjustedXp);
            difficultyLabel = difficultyLabel == null ? "" : difficultyLabel.trim();
            statusText = statusText == null ? "" : statusText.trim();
        }
    }

    public record ActivePartyMember(
            long characterId,
            String name,
            int level
    ) {

        public ActivePartyMember {
            characterId = Math.max(0L, characterId);
            name = name == null ? "" : name.trim();
            level = Math.max(0, level);
        }
    }

    public record SessionParticipant(
            long characterId,
            String name,
            int level,
            boolean available,
            String statusText
    ) {

        public SessionParticipant {
            characterId = Math.max(0L, characterId);
            name = name == null ? "" : name.trim();
            level = Math.max(0, level);
            statusText = statusText == null ? "" : statusText.trim();
        }
    }

    public record PlannedEncounter(
            long token,
            long planId,
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

        public PlannedEncounter {
            token = Math.max(0L, token);
            planId = Math.max(0L, planId);
            name = name == null ? "" : name.trim();
            generatedLabel = generatedLabel == null ? "" : generatedLabel.trim();
            creatureCount = Math.max(0, creatureCount);
            totalBaseXp = Math.max(0, totalBaseXp);
            adjustedXp = Math.max(0, adjustedXp);
            xpMultiplier = xpMultiplier <= 0.0 ? 1.0 : xpMultiplier;
            difficultyLabel = difficultyLabel == null ? "" : difficultyLabel.trim();
            budgetPercentage = budgetPercentage == null ? BigDecimal.ZERO : budgetPercentage;
            targetXp = Math.max(0, targetXp);
        }
    }

    public record RestGap(
            int gapIndex,
            long leftEncounterId,
            long rightEncounterId,
            SessionPlannerRestKind restKind
    ) {

        public RestGap {
            gapIndex = Math.max(0, gapIndex);
            leftEncounterId = Math.max(0L, leftEncounterId);
            rightEncounterId = Math.max(0L, rightEncounterId);
            restKind = restKind == null ? SessionPlannerRestKind.NONE : restKind;
        }
    }

    public record LootPlaceholder(
            long token,
            String label
    ) {

        public LootPlaceholder {
            token = Math.max(0L, token);
            label = label == null ? "" : label.trim();
        }
    }

    private static <T> List<T> copy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
