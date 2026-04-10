package clean.featuretabs.mapcatalog;

import clean.featuretabs.mapcatalog.input.LoadMapsInput;

/**
 * Clean-local seed map catalog for aggregated top-level tabs.
 */
public final class MapcatalogObject {

    private final LoadMapsInput.LoadedMapsInput loadedMaps;

    public MapcatalogObject(LoadMapsInput input) {
        LoadMapsInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.loadedMaps = new MapcatalogAssembly(resolvedInput).loadMaps();
    }

    public LoadMapsInput.LoadedMapsInput loadMaps(LoadMapsInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return loadedMaps;
    }

    private static final class MapcatalogAssembly {

        private MapcatalogAssembly(LoadMapsInput input) {
        }

        private LoadMapsInput.LoadedMapsInput loadMaps() {
            return new LoadMapsInput.LoadedMapsInput(java.util.List.of(
                    new LoadMapsInput.MapInput(
                            "hex:salt-marches",
                            "HEXMAP",
                            "Salzmarschen",
                            "Hexmap fuer offene Reise und uebergreifende Regionen."
                    ),
                    new LoadMapsInput.MapInput(
                            "dungeon:ruined-watch",
                            "DUNGEON",
                            "Zerfallene Warte",
                            "Dungeon-Map fuer verschachtelte Innenraeume und Korridore."
                    )
            ));
        }
    }
}
