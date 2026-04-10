package clean.catalog.input;

import clean.shell.input.ComposeShellInput;
import javafx.scene.Node;

public record ComposeCatalogInput(
        Node navigationGraphic,
        CatalogcontentInput catalogcontent
) {

    public record CatalogcontentInput(
            Node controlsContent,
            Node mainContent,
            java.util.function.Consumer<ComposeShellInput.ShellHooksInput> onShellReady
    ) {
    }

    public record CatalogInput(
            ComposeShellInput.SurfaceInput surface
    ) {
    }
}
