package src.domain.sessionplanner.published;

import java.math.BigDecimal;
import java.util.List;

public record SessionPlannerSessionSnapshot(
        SessionState session,
        XpBudgetState xpBudget,
        RestAdviceState restAdvice,
        GoldBudgetState goldBudget,
        List<AvailableEncounterPlan> availableEncounterPlans,
        String status
) {

    public SessionPlannerSessionSnapshot {
        session = session == null ? SessionState.empty() : session;
        xpBudget = xpBudget == null ? XpBudgetState.empty() : xpBudget;
        restAdvice = restAdvice == null ? RestAdviceState.empty() : restAdvice;
        goldBudget = goldBudget == null ? GoldBudgetState.placeholder(0) : goldBudget;
        availableEncounterPlans = copy(availableEncounterPlans);
        status = status == null ? "" : status;
    }

    @Override
    public List<AvailableEncounterPlan> availableEncounterPlans() {
        return List.copyOf(availableEncounterPlans);
    }

    public static SessionPlannerSessionSnapshot empty(String status) {
        return new SessionPlannerSessionSnapshot(
                SessionState.empty(),
                XpBudgetState.empty(),
                RestAdviceState.empty(),
                GoldBudgetState.placeholder(0),
                List.of(),
                status);
    }

    public record SessionState(
            long sessionId,
            String displayName,
            BigDecimal encounterDays,
            String encounterDaysText,
            long selectedEncounterId,
            boolean hasSelectedEncounter
    ) {

        public SessionState {
            sessionId = Math.max(0L, sessionId);
            displayName = displayName == null || displayName.isBlank()
                    ? "Session #" + sessionId
                    : displayName.trim();
            encounterDays = encounterDays == null ? BigDecimal.ONE : encounterDays;
            encounterDaysText = encounterDaysText == null ? encounterDays.stripTrailingZeros().toPlainString() : encounterDaysText;
            selectedEncounterId = Math.max(0L, selectedEncounterId);
        }

        public static SessionState empty() {
            return new SessionState(0L, "Session #0", BigDecimal.ONE, "1", 0L, false);
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
            String summaryText,
            int adjustedXp,
            String difficultyLabel,
            String statusText,
            boolean importEnabled
    ) {

        public AvailableEncounterPlan {
            planId = Math.max(0L, planId);
            name = name == null ? "" : name.trim();
            summaryText = summaryText == null ? "" : summaryText.trim();
            adjustedXp = Math.max(0, adjustedXp);
            difficultyLabel = difficultyLabel == null ? "" : difficultyLabel.trim();
            statusText = statusText == null ? "" : statusText.trim();
        }
    }

    private static <T> List<T> copy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
