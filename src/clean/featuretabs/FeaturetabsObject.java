package clean.featuretabs;

import clean.featuretabs.encountertab.EncountertabObject;
import clean.featuretabs.encountertab.input.ComposeEncountertabInput;
import clean.featuretabs.input.ComposeFeaturetabsInput;
import clean.featuretabs.mapcatalog.MapcatalogObject;
import clean.featuretabs.mapcatalog.input.LoadMapsInput;
import clean.featuretabs.mapeditortab.MapeditortabObject;
import clean.featuretabs.mapeditortab.input.ComposeMapeditortabInput;
import clean.featuretabs.navigationicon.NavigationiconObject;
import clean.featuretabs.navigationicon.input.ComposeNavigationiconInput;
import clean.featuretabs.spellstab.SpellstabObject;
import clean.featuretabs.spellstab.input.ComposeSpellstabInput;
import clean.featuretabs.tablestab.TablestabObject;
import clean.featuretabs.tablestab.input.ComposeTablestabInput;
import clean.featuretabs.traveltab.TraveltabObject;
import clean.featuretabs.traveltab.input.ComposeTraveltabInput;
import clean.shell.input.ComposeShellInput;

/**
 * Top-level Clean sidebar roster owner.
 */
@SuppressWarnings("unused")
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
        }

        private ComposeFeaturetabsInput.FeaturetabsInput composeFeaturetabs() {
            ComposeNavigationiconInput navigationiconInput = new ComposeNavigationiconInput();
            ComposeNavigationiconInput.NavigationiconInput navigationIcons =
                    new NavigationiconObject(navigationiconInput).composeNavigationicon(navigationiconInput);

            LoadMapsInput loadMapsInput = new LoadMapsInput();
            java.util.List<LoadMapsInput.MapInput> maps =
                    new MapcatalogObject(loadMapsInput).loadMaps(loadMapsInput).maps();

            ComposeEncountertabInput encountertabInput = new ComposeEncountertabInput(navigationIcons.encounterGraphic());
            ComposeShellInput.SurfaceInput encounterSurface =
                    new EncountertabObject(encountertabInput).composeEncountertab(encountertabInput).surface();

            ComposeTraveltabInput traveltabInput = new ComposeTraveltabInput(
                    navigationIcons.travelGraphic(),
                    maps
            );
            ComposeShellInput.SurfaceInput travelSurface =
                    new TraveltabObject(traveltabInput).composeTraveltab(traveltabInput).surface();

            ComposeMapeditortabInput mapeditortabInput = new ComposeMapeditortabInput(
                    navigationIcons.mapEditorGraphic(),
                    maps
            );
            ComposeShellInput.SurfaceInput mapEditorSurface =
                    new MapeditortabObject(mapeditortabInput).composeMapeditortab(mapeditortabInput).surface();

            ComposeTablestabInput tablestabInput = new ComposeTablestabInput(navigationIcons.tablesGraphic());
            ComposeShellInput.SurfaceInput tablesSurface =
                    new TablestabObject(tablestabInput).composeTablestab(tablestabInput).surface();

            ComposeSpellstabInput spellstabInput = new ComposeSpellstabInput(navigationIcons.spellsGraphic());
            ComposeShellInput.SurfaceInput spellsSurface =
                    new SpellstabObject(spellstabInput).composeSpellstab(spellstabInput).surface();

            return new ComposeFeaturetabsInput.FeaturetabsInput(
                    java.util.List.of(
                            encounterSurface,
                            travelSurface,
                            mapEditorSurface,
                            tablesSurface,
                            spellsSurface
                    ),
                    "encounter"
            );
        }
    }
}
