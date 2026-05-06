package src.domain.sessionplanner.published;

import java.math.BigDecimal;
import java.util.List;

public record SessionPlannerEncountersProjection(
        List<PlannedEncounter> plannedEncounters,
        List<RestGap> restGaps,
        List<LootPlaceholder> lootPlaceholders
) {

    public SessionPlannerEncountersProjection {
        plannedEncounters = copy(plannedEncounters);
        restGaps = copy(restGaps);
        lootPlaceholders = copy(lootPlaceholders);
    }

    public static SessionPlannerEncountersProjection empty() {
        return new SessionPlannerEncountersProjection(List.of(), List.of(), List.of());
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
