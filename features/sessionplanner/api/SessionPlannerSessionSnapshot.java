package features.sessionplanner.api;

import java.math.BigDecimal;

public record SessionPlannerSessionSnapshot(
        SessionState session,
        XpBudgetState xpBudget,
        RestAdviceState restAdvice,
        String status
) {

    public SessionPlannerSessionSnapshot {
        session = session == null ? SessionState.empty() : session;
        xpBudget = xpBudget == null ? XpBudgetState.empty() : xpBudget;
        restAdvice = restAdvice == null ? RestAdviceState.empty() : restAdvice;
        status = status == null ? "" : status;
    }

    public static SessionPlannerSessionSnapshot empty(String status) {
        return new SessionPlannerSessionSnapshot(
                SessionState.empty(),
                XpBudgetState.empty(),
                RestAdviceState.empty(),
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

}
