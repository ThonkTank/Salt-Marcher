package src.domain.sessionplanner.model.session.port;

import java.util.List;

public interface SessionEncounterFactsLookup {

    EncounterPlanListFact listEncounterPlans();

    EncounterPlanFact loadEncounterPlan(long encounterPlanId);

    record EncounterPlanListFact(
            boolean available,
            List<SavedEncounterPlanFact> plans,
            String statusText
    ) {

        public EncounterPlanListFact {
            plans = plans == null ? List.of() : List.copyOf(plans);
            statusText = statusText == null ? "" : statusText.trim();
        }
    }

    record SavedEncounterPlanFact(
            long planId,
            String name,
            String summaryText
    ) {

        public SavedEncounterPlanFact {
            planId = Math.max(0L, planId);
            name = name == null ? "" : name.trim();
            summaryText = summaryText == null ? "" : summaryText.trim();
        }
    }

    record EncounterPlanFact(
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

        public EncounterPlanFact {
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

        public static EncounterPlanFact unavailable(long encounterPlanId, String statusText) {
            return new EncounterPlanFact(
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
