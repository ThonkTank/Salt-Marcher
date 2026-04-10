package clean.world.mapcatalog;

import clean.world.mapcatalog.input.LoadMapsInput;
import clean.world.mapcatalog.repository.MapcatalogRepository;

import java.sql.SQLException;

/**
 * Clean-local SQLite-backed world map catalog seam.
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
            try {
                return new LoadMapsInput.LoadedMapsInput(
                        MapcatalogRepository.loadMaps(),
                        ""
                );
            } catch (SQLException exception) {
                return new LoadMapsInput.LoadedMapsInput(
                        java.util.List.of(),
                        buildErrorMessage(exception)
                );
            }
        }

        private static String buildErrorMessage(SQLException exception) {
            String detail = exception == null || exception.getMessage() == null
                    ? ""
                    : exception.getMessage().trim();
            if (detail.isEmpty()) {
                return "Kartenkatalog aus SQLite konnte nicht geladen werden.";
            }
            return "Kartenkatalog aus SQLite konnte nicht geladen werden: " + detail;
        }
    }
}
