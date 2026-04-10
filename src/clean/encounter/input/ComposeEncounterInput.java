package clean.encounter.input;

import clean.shell.input.ComposeShellInput;

@SuppressWarnings("unused")
public record ComposeEncounterInput() {

    public record AddCreatureInput(
            long creatureId,
            String creatureName
    ) {
    }

    public record EncounterInput(
            java.util.function.Consumer<ComposeShellInput.ShellHooksInput> onShellReady,
            java.util.function.Consumer<AddCreatureInput> addCreature
    ) {
    }
}
