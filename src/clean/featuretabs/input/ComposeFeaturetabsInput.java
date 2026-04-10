package clean.featuretabs.input;

import clean.creatures.input.ComposeEncounterhostInput;
import clean.shell.input.ComposeShellInput;

@SuppressWarnings("unused")
public record ComposeFeaturetabsInput(
        ComposeEncounterhostInput.EncounterhostInput encounterhost
) {

    public record FeaturetabsInput(
            java.util.List<ComposeShellInput.SurfaceInput> surfaces,
            String initialSurfaceId
    ) {
    }
}
