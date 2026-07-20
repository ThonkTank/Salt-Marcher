package features.encounter.api;

import java.util.List;

public record PrepareGeneratedEncounterBatchCommand(
        GeneratedEncounterSource source,
        List<GeneratedEncounterIntent> intents
) {
    public PrepareGeneratedEncounterBatchCommand {
        if (source == null) {
            throw new IllegalArgumentException("source is required");
        }
        intents = intents == null ? List.of() : List.copyOf(intents);
        if (intents.isEmpty() || intents.stream().anyMatch(java.util.Objects::isNull)) {
            throw new IllegalArgumentException("intents must be non-empty");
        }
    }

    @Override
    public List<GeneratedEncounterIntent> intents() {
        return List.copyOf(intents);
    }
}
