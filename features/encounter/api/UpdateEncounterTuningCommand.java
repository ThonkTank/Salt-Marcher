package features.encounter.api;

public record UpdateEncounterTuningCommand(EncounterTuningSettings settings) {

    public UpdateEncounterTuningCommand {
        settings = settings == null ? EncounterTuningSettings.defaults() : settings;
    }
}
