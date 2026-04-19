package src.domain.encounter.generation;

import java.util.List;

final class EncounterDraftTitle {

    private EncounterDraftTitle() {
    }

    static String from(List<EncounterDraftEntry> entries) {
        return entries.stream()
                .map(entry -> entry.quantity() + "x " + entry.creatureName())
                .reduce((left, right) -> left + " + " + right)
                .orElse("Encounter");
    }
}
