package src.domain.sessionplanner.model.session.model;

public record SessionEncounterPlanFact(
        boolean available,
        long planId,
        String name,
        String generatedLabel,
        int creatureCount,
        int totalBaseXp,
        int adjustedXp,
        double xpMultiplier,
        String difficultyLabel,
        String statusText
) {

    private static final double DEFAULT_XP_MULTIPLIER = 1;

    public SessionEncounterPlanFact {
        planId = Math.max(0L, planId);
        name = name == null ? "" : name.trim();
        generatedLabel = generatedLabel == null ? "" : generatedLabel.trim();
        creatureCount = Math.max(0, creatureCount);
        totalBaseXp = Math.max(0, totalBaseXp);
        adjustedXp = Math.max(0, adjustedXp);
        xpMultiplier = xpMultiplier > 0 ? xpMultiplier : DEFAULT_XP_MULTIPLIER;
        difficultyLabel = difficultyLabel == null ? "" : difficultyLabel.trim();
        statusText = statusText == null ? "" : statusText.trim();
    }

    public static SessionEncounterPlanFact unavailable(long encounterPlanId, String statusText) {
        return new SessionEncounterPlanFact(
                false,
                encounterPlanId,
                "",
                "",
                0,
                0,
                0,
                DEFAULT_XP_MULTIPLIER,
                "",
                statusText);
    }
}
