package src.domain.encounter.published;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record SaveEncounterPlanCommand(
        @Nullable Long planId,
        String name,
        String generatedLabel,
        List<SavedEncounterPlanCreature> creatures
) {
    public SaveEncounterPlanCommand {
        name = name == null ? "" : name.trim();
        generatedLabel = generatedLabel == null ? "" : generatedLabel.trim();
        creatures = creatures == null ? List.of() : List.copyOf(creatures);
    }
}
