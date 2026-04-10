package clean.featuretabs;

import clean.catalog.CatalogObject;
import clean.catalog.input.ComposeCatalogInput;
import clean.featuretabs.input.ComposeFeaturetabsInput;
import clean.featuretabs.navigationicon.NavigationiconObject;
import clean.featuretabs.navigationicon.input.ComposeNavigationiconInput;
import clean.featuretabs.tablestab.TablestabObject;
import clean.featuretabs.tablestab.input.ComposeTablestabInput;
import clean.shell.input.ComposeShellInput;
import clean.world.WorldObject;
import clean.world.input.ComposeWorldInput;

/**
 * Top-level Clean sidebar roster owner.
 */
public final class FeaturetabsObject {

    private final ComposeFeaturetabsInput.FeaturetabsInput featuretabs;

    public FeaturetabsObject(ComposeFeaturetabsInput input) {
        ComposeFeaturetabsInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.featuretabs = new FeaturetabsAssembly(resolvedInput).composeFeaturetabs();
    }

    public ComposeFeaturetabsInput.FeaturetabsInput composeFeaturetabs(ComposeFeaturetabsInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return featuretabs;
    }

    private static final class FeaturetabsAssembly {

        private FeaturetabsAssembly(ComposeFeaturetabsInput input) {
            this.input = input;
        }

        private final ComposeFeaturetabsInput input;

        private ComposeFeaturetabsInput.FeaturetabsInput composeFeaturetabs() {
            ComposeNavigationiconInput navigationiconInput = new ComposeNavigationiconInput();
            ComposeNavigationiconInput.NavigationiconInput navigationIcons =
                    new NavigationiconObject(navigationiconInput).composeNavigationicon(navigationiconInput);

            ComposeCatalogInput composeCatalogInput = new ComposeCatalogInput(
                    navigationIcons.catalogGraphic(),
                    input.catalogcontent() == null ? null : input.catalogcontent().content()
            );
            ComposeShellInput.SurfaceInput catalogSurface =
                    new CatalogObject(composeCatalogInput).composeCatalog(composeCatalogInput).surface();

            ComposeWorldInput composeWorldInput = new ComposeWorldInput(
                    navigationIcons.travelGraphic(),
                    navigationIcons.mapEditorGraphic()
            );
            ComposeWorldInput.WorldInput world =
                    new WorldObject(composeWorldInput).composeWorld(composeWorldInput);

            ComposeTablestabInput tablestabInput = new ComposeTablestabInput(navigationIcons.tablesGraphic());
            ComposeShellInput.SurfaceInput tablesSurface =
                    new TablestabObject(tablestabInput).composeTablestab(tablestabInput).surface();

            return new ComposeFeaturetabsInput.FeaturetabsInput(
                    java.util.List.of(
                            catalogSurface,
                            world.travelSurface(),
                            world.mapEditorSurface(),
                            tablesSurface
                    ),
                    "catalog"
            );
        }
    }
}
