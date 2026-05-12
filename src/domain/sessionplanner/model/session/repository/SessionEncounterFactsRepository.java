package src.domain.sessionplanner.model.session.repository;

public interface SessionEncounterFactsRepository {

    EncounterPlanDetailFact loadEncounterPlan(long encounterPlanId);

    record EncounterPlanDetailFact(
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

        public EncounterPlanDetailFact {
            planId = Math.max(0L, planId);
            name = name == null ? "" : name.trim();
            generatedLabel = generatedLabel == null ? "" : generatedLabel.trim();
            creatureCount = Math.max(0, creatureCount);
            totalBaseXp = Math.max(0, totalBaseXp);
            adjustedXp = Math.max(0, adjustedXp);
            xpMultiplier = xpMultiplier <= 0.0 ? 1.0 : xpMultiplier;
            difficultyLabel = difficultyLabel == null ? "" : difficultyLabel.trim();
            statusText = statusText == null ? "" : statusText.trim();
        }

        public static EncounterPlanDetailFact unavailable(long encounterPlanId, String statusText) {
            return new EncounterPlanDetailFact(
                    false,
                    encounterPlanId,
                    "",
                    "",
                    0,
                    0,
                    0,
                    1.0,
                    "",
                    statusText);
        }
    }
}
