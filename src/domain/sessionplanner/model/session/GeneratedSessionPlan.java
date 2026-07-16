package src.domain.sessionplanner.model.session;

import java.math.BigDecimal;
import java.util.List;

public record GeneratedSessionPlan(List<GeneratedScene> scenes) {
    public GeneratedSessionPlan {
        scenes = scenes == null ? List.of() : List.copyOf(scenes);
        if (scenes.isEmpty()) throw new IllegalArgumentException("Generated session plan needs scenes");
    }

    public record GeneratedScene(
            long encounterPlanId,
            BigDecimal budgetPercentage,
            String title,
            List<GeneratedLootReference> loot
    ) {
        public GeneratedScene {
            encounterPlanId = Math.max(0L, encounterPlanId);
            budgetPercentage = budgetPercentage == null ? BigDecimal.ZERO : budgetPercentage;
            title = title == null ? "" : title.trim();
            loot = loot == null ? List.of() : List.copyOf(loot);
        }
    }

    public record GeneratedLootReference(long generationId, long treasureId, String label) {
        public GeneratedLootReference {
            if (generationId <= 0 || treasureId <= 0) {
                throw new IllegalArgumentException("Generated loot reference IDs must be positive");
            }
            label = label == null ? "" : label.trim();
        }
    }
}
