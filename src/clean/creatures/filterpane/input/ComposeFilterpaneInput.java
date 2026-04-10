package clean.creatures.filterpane.input;

import clean.creatures.catalog.input.ComposeCatalogInput;
import javafx.scene.Node;

@SuppressWarnings("unused")
public record ComposeFilterpaneInput(
        ComposeCatalogInput.LoadedFilterOptionsInput filterOptions,
        java.util.function.Consumer<ComposeCatalogInput.CriteriaInput> onCriteriaChanged,
        java.util.function.Supplier<java.util.List<Node>> externalChipSource
) {

    public record FilterpaneInput(
            Node controlsContent
    ) {
    }
}
