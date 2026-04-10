package clean.catalog;

import clean.catalog.input.ComposeCatalogInput;
import clean.shell.input.ComposeShellInput;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

/**
 * Top-level clean catalog workspace surface.
 */
@SuppressWarnings("unused")
public final class CatalogObject {

    private final ComposeCatalogInput.CatalogInput catalog;

    public CatalogObject(ComposeCatalogInput input) {
        ComposeCatalogInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.catalog = new CatalogAssembly(resolvedInput).composeCatalog();
    }

    public ComposeCatalogInput.CatalogInput composeCatalog(ComposeCatalogInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return catalog;
    }

    private static final class CatalogAssembly {

        private final ComposeCatalogInput input;

        private CatalogAssembly(ComposeCatalogInput input) {
            this.input = input;
        }

        private ComposeCatalogInput.CatalogInput composeCatalog() {
            ComposeCatalogInput.CatalogcontentInput content = input.catalogcontent();
            return new ComposeCatalogInput.CatalogInput(new ComposeShellInput.SurfaceInput(
                    "catalog",
                    "Catalog",
                    "session",
                    "Ca",
                    input.navigationGraphic(),
                    null,
                    content == null ? createMissingContent("Katalog") : content.controlsContent(),
                    content == null ? createMissingContent("Creature Catalog") : content.mainContent(),
                    null,
                    null,
                    null,
                    null,
                    content == null ? null : content.onShellReady()
            ));
        }

        private static Node createMissingContent(String titleText) {
            Label title = new Label(titleText);
            title.getStyleClass().add("heading");
            Label body = new Label("Der Clean-Catalog konnte nicht vorbereitet werden.");
            body.getStyleClass().add("text-muted");
            body.setWrapText(true);
            VBox box = new VBox(12, title, body);
            box.setPadding(new Insets(12));
            return box;
        }
    }
}
