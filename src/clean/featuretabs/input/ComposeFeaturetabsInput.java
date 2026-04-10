package clean.featuretabs.input;

import clean.shell.input.ComposeShellInput;

@SuppressWarnings("unused")
public record ComposeFeaturetabsInput() {

    public record FeaturetabsInput(
            java.util.List<ComposeShellInput.SurfaceInput> surfaces,
            String initialSurfaceId
    ) {
    }
}
