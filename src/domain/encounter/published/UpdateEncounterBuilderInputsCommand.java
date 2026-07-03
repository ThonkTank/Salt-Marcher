package src.domain.encounter.published;

import java.util.List;

public record UpdateEncounterBuilderInputsCommand(EncounterBuilderInputs inputs) {

    public UpdateEncounterBuilderInputsCommand {
        inputs = inputs == null ? EncounterBuilderInputs.empty() : inputs;
    }

    public List<String> creatureTypes() {
        return inputs.creatureTypes();
    }

    public List<String> creatureSubtypes() {
        return inputs.creatureSubtypes();
    }

    public List<String> biomes() {
        return inputs.biomes();
    }

    public boolean autoDifficulty() {
        return inputs.autoDifficulty();
    }

    public int difficultyLevel() {
        return inputs.difficultyLevel();
    }

    public boolean autoBalance() {
        return inputs.autoBalance();
    }

    public int balanceLevel() {
        return inputs.balanceLevel();
    }

    public boolean autoAmount() {
        return inputs.autoAmount();
    }

    public double amountValue() {
        return inputs.amountValue();
    }

    public boolean autoDiversity() {
        return inputs.autoDiversity();
    }

    public int diversityLevel() {
        return inputs.diversityLevel();
    }

    public List<Long> encounterTableIds() {
        return inputs.encounterTableIds();
    }

    public List<Long> worldFactionIds() {
        return inputs.worldFactionIds();
    }

    public long worldLocationId() {
        return inputs.worldLocationId();
    }
}
