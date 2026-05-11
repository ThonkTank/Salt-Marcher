package src.domain.encounter.model.plan.model;

import java.util.List;
public record EncounterPlan(long id, String name, String generatedLabel, List<EncounterPlanCreature> creatures) {

    public EncounterPlan {
        if (id < 0) {
            throw new IllegalArgumentException("id must not be negative");
        }
        name = normalizeName(name);
        generatedLabel = generatedLabel == null ? "" : generatedLabel.trim();
        creatures = creatures == null ? List.of() : List.copyOf(creatures);
        if (creatures.isEmpty()) {
            throw new IllegalArgumentException("Encounter plan needs at least one creature");
        }
    }

    public EncounterPlan withId(long nextId) {
        return new EncounterPlan(nextId, name, generatedLabel, creatures);
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
