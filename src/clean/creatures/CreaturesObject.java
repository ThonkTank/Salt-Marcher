package clean.creatures;

import clean.creatures.browser.BrowserObject;
import clean.creatures.browser.input.ComposeBrowserInput;
import clean.creatures.catalog.CatalogObject;
import clean.creatures.catalog.input.ComposeCatalogInput;
import clean.creatures.input.ComposeEncounterhostInput;
import clean.creatures.statblock.StatblockObject;
import clean.creatures.statblock.input.ComposeStatblockInput;

/**
 * Public clean creature root seam for reusable creature-host composition.
 */
@SuppressWarnings("unused")
public final class CreaturesObject {

    private final ComposeEncounterhostInput.EncounterhostInput encounterhost;

    public CreaturesObject(ComposeEncounterhostInput input) {
        ComposeEncounterhostInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.encounterhost = new CreaturesAssembly(resolvedInput).composeEncounterhost();
    }

    public ComposeEncounterhostInput.EncounterhostInput composeEncounterhost(ComposeEncounterhostInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return encounterhost;
    }

    private static final class CreaturesAssembly {

        private CreaturesAssembly(ComposeEncounterhostInput input) {
        }

        private ComposeEncounterhostInput.EncounterhostInput composeEncounterhost() {
            ComposeCatalogInput composeCatalogInput = new ComposeCatalogInput();
            ComposeCatalogInput.CatalogInput catalog =
                    new CatalogObject(composeCatalogInput).composeCatalog(composeCatalogInput);

            ComposeStatblockInput composeStatblockInput = new ComposeStatblockInput(catalog);
            ComposeStatblockInput.StatblockInput statblock =
                    new StatblockObject(composeStatblockInput).composeStatblock(composeStatblockInput);

            ComposeBrowserInput composeBrowserInput = new ComposeBrowserInput(
                    catalog,
                    statblock.showCreatureStatblock(),
                    null,
                    null
            );
            ComposeBrowserInput.BrowserInput browser =
                    new BrowserObject(composeBrowserInput).composeBrowser(composeBrowserInput);

            return new ComposeEncounterhostInput.EncounterhostInput(
                    browser.controlsContent(),
                    browser.mainContent(),
                    statblock.onShellReady()
            );
        }
    }
}
