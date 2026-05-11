package src.domain.encounter.model.generation.model;

import java.util.List;

public final class EncounterDraftTitle {

    private EncounterDraftTitle() {
    }

    public static String from(List<EncounterDraftEntry> entries) {
        return entries.stream()
                .map(entry -> entry.quantity() + "x " + entry.creatureName())
                .reduce((left, right) -> left + " + " + right)
                .orElse("Encounter");
    }
}
