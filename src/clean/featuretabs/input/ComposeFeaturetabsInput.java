package clean.featuretabs.input;

import clean.creatures.input.ComposeCatalogcontentInput;
import clean.shell.input.ComposeShellInput;

@SuppressWarnings("unused")
public record ComposeFeaturetabsInput(
        ComposeCatalogcontentInput.CatalogcontentInput catalogcontent
) {

    public record FeaturetabsInput(
            java.util.List<ComposeShellInput.SurfaceInput> surfaces,
            String initialSurfaceId
    ) {
    }
}
