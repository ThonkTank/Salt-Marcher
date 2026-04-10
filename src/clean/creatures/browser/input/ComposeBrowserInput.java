package clean.creatures.browser.input;

import clean.creatures.catalog.input.ComposeCatalogInput;
import clean.creatures.statblock.input.ComposeStatblockInput;
import javafx.scene.Node;

@SuppressWarnings("unused")
public record ComposeBrowserInput(
        ComposeCatalogInput.CatalogInput catalog,
        java.util.function.Consumer<ComposeStatblockInput.ShowCreatureStatblockInput> showCreatureStatblock,
        java.util.function.Consumer<RowActionInput> rowAction,
        String rowActionLabel
) {

    public record RowActionInput(
            long creatureId,
            String creatureName
    ) {
    }

    public record BrowserInput(
            Node controlsContent,
            Node mainContent
    ) {
    }
}
