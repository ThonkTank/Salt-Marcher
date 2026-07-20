package features.encounter.domain.plan;

import java.util.List;
import java.util.Optional;
public record EncounterPlan(
        long id,
        String name,
        String generatedLabel,
        List<EncounterPlanCreature> creatures,
        Optional<GeneratedEncounterOrigin> origin
) {

    public EncounterPlan(long id, String name, String generatedLabel, List<EncounterPlanCreature> creatures) {
        this(id, name, generatedLabel, creatures, Optional.empty());
    }

    public EncounterPlan {
        if (id < 0) {
            throw new IllegalArgumentException("id must not be negative");
        }
        name = normalizeName(name);
        generatedLabel = generatedLabel == null ? "" : generatedLabel.trim();
        creatures = creatures == null ? List.of() : List.copyOf(creatures);
        origin = origin == null ? Optional.empty() : origin;
        if (creatures.isEmpty()) {
            throw new IllegalArgumentException("Encounter plan needs at least one creature");
        }
    }

    public int creatureCount() {
        int total = 0;
        for (EncounterPlanCreature creature : creatures) {
            total += creature.quantity();
        }
        return total;
    }

    private static String normalizeName(String value) {
        String normalized = value == null ? "" : value.trim();
        return normalized.isBlank() ? "Encounter" : normalized;
    }
}
