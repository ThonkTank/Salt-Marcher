package features.encounter.api;

import java.util.List;

public record GeneratedEncounterPlanImportCommand(
        GeneratedEncounterPlanSource source,
        List<GeneratedEncounterPlanSpec> encounters
) {

    public GeneratedEncounterPlanImportCommand {
        source = java.util.Objects.requireNonNull(source, "source");
        encounters = encounters == null ? List.of() : List.copyOf(encounters);
    }

    @Override
    public List<GeneratedEncounterPlanSpec> encounters() {
        return List.copyOf(encounters);
    }
}
