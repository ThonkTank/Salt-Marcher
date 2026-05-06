package src.domain.encounter.published;

public record UpdateEncounterBuilderInputsCommand(EncounterBuilderInputs inputs) {

    public UpdateEncounterBuilderInputsCommand {
        inputs = inputs == null ? EncounterBuilderInputs.empty() : inputs;
    }
}
