package clean.creatures.input;

import clean.catalog.input.ComposeCatalogInput;

@SuppressWarnings("unused")
public record ComposeCatalogcontentInput(
        java.util.function.Consumer<RowActionInput> rowAction,
        String rowActionLabel
) {

    public record RowActionInput(
            long creatureId,
            String creatureName
    ) {
    }

    public record CatalogcontentInput(
            ComposeCatalogInput.CatalogcontentInput content
    ) {
    }
}
