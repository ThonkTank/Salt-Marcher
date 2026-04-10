package clean.creatures;

import clean.creatures.browser.BrowserObject;
import clean.creatures.browser.input.ComposeBrowserInput;
import clean.creatures.catalog.CatalogObject;
import clean.creatures.catalog.input.ComposeCatalogInput;
import clean.creatures.filterpane.FilterpaneObject;
import clean.creatures.filterpane.input.ComposeFilterpaneInput;
import clean.creatures.input.ComposeCatalogcontentInput;
import clean.creatures.statblock.StatblockObject;
import clean.creatures.statblock.input.ComposeStatblockInput;

/**
 * Public clean creature root seam for reusable creature catalog composition.
 */
public final class CreaturesObject {

    private final ComposeCatalogcontentInput.CatalogcontentInput catalogcontent;

    public CreaturesObject(ComposeCatalogcontentInput input) {
        ComposeCatalogcontentInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.catalogcontent = new CreaturesAssembly(resolvedInput).composeCatalogcontent();
    }

    public ComposeCatalogcontentInput.CatalogcontentInput composeCatalogcontent(ComposeCatalogcontentInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return catalogcontent;
    }

    private static final class CreaturesAssembly {

        private final ComposeCatalogcontentInput input;

        private CreaturesAssembly(ComposeCatalogcontentInput input) {
            this.input = input;
        }

        private ComposeCatalogcontentInput.CatalogcontentInput composeCatalogcontent() {
            ComposeCatalogInput composeCatalogInput = new ComposeCatalogInput();
            ComposeCatalogInput.CatalogInput catalog =
                    new CatalogObject(composeCatalogInput).composeCatalog(composeCatalogInput);

            ComposeCatalogInput.LoadedFilterOptionsInput filterOptions = catalog.loadFilterOptions().apply(
                    new ComposeCatalogInput.LoadFilterOptionsInput()
            );

            ComposeStatblockInput composeStatblockInput = new ComposeStatblockInput(catalog);
            ComposeStatblockInput.StatblockInput statblock =
                    new StatblockObject(composeStatblockInput).composeStatblock(composeStatblockInput);

            ComposeBrowserInput composeBrowserInput = new ComposeBrowserInput(
                    catalog,
                    statblock.showCreatureStatblock(),
                    this::handleRowAction,
                    input.rowActionLabel()
            );
            ComposeBrowserInput.BrowserInput browser =
                    new BrowserObject(composeBrowserInput).composeBrowser(composeBrowserInput);

            ComposeFilterpaneInput composeFilterpaneInput = new ComposeFilterpaneInput(
                    filterOptions,
                    browser.applyCriteria(),
                    null
            );
            ComposeFilterpaneInput.FilterpaneInput filterpane =
                    new FilterpaneObject(composeFilterpaneInput).composeFilterpane(composeFilterpaneInput);

            return new ComposeCatalogcontentInput.CatalogcontentInput(new clean.catalog.input.ComposeCatalogInput.CatalogcontentInput(
                    filterpane.controlsContent(),
                    browser.mainContent(),
                    statblock.onShellReady()
            ));
        }

        private void handleRowAction(ComposeBrowserInput.RowActionInput input) {
            if (input == null || this.input.rowAction() == null) {
                return;
            }
            this.input.rowAction().accept(new ComposeCatalogcontentInput.RowActionInput(
                    input.creatureId(),
                    input.creatureName()
            ));
        }
    }
}
