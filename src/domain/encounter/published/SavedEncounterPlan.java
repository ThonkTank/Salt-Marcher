package src.domain.encounter.published;

import java.util.List;

public record SavedEncounterPlan(
        long id,
        String name,
        String generatedLabel,
        List<SavedEncounterPlanCreature> creatures
) {
    public SavedEncounterPlan {
        name = name == null ? "" : name.trim();
        generatedLabel = generatedLabel == null ? "" : generatedLabel.trim();
        creatures = creatures == null ? List.of() : List.copyOf(creatures);
    }
}
