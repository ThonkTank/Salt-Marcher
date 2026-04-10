package features.world.hexmap.ui.editor;

import features.world.hexmap.catalog.CatalogObject;
import features.world.hexmap.catalog.input.CreateMapInput;
import features.world.hexmap.catalog.input.FlushTerrainChangesInput;
import features.world.hexmap.catalog.input.LoadMapInput;
import features.world.hexmap.catalog.input.LoadMapListInput;
import features.world.hexmap.catalog.input.UpdateMapInput;
import features.world.hexmap.model.HexMap;
import features.world.hexmap.model.HexTerrainType;
import features.world.hexmap.model.HexTile;
import javafx.concurrent.Task;
import ui.async.UiAsyncTasks;

import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * UI-naher Application-Service fuer Workflows im Karteneditor.
 * Kapselt Task-Setup und delegiert Persistenzlogik an den HexMapService.
 */
@SuppressWarnings("unused")
public final class MapEditorApplicationService {
    private final CatalogObject catalogObject = new CatalogObject();

    public void loadMapList(Consumer<List<HexMap>> onSuccess, Consumer<Throwable> onError) {
        Task<List<HexMap>> task = new Task<>() {
            @Override
            protected List<HexMap> call() throws Exception {
                return catalogObject.loadMapList(new LoadMapListInput()).maps();
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onError);
    }

    public void loadMap(Long mapId, Consumer<List<HexTile>> onSuccess, Consumer<Throwable> onError) {
        if (mapId == null) {
            onError.accept(new IllegalArgumentException("mapId darf nicht null sein"));
            return;
        }
        Task<List<HexTile>> task = new Task<>() {
            @Override
            protected List<HexTile> call() throws Exception {
                return catalogObject.loadMap(new LoadMapInput(mapId)).tiles();
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onError);
    }

    public void createMap(String name, int radius, Consumer<Long> onSuccess, Consumer<Throwable> onError) {
        Task<Long> task = new Task<>() {
            @Override
            protected Long call() throws Exception {
                return catalogObject.createMap(new CreateMapInput(name, radius)).mapId();
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onError);
    }

    public void updateMap(Long mapId, String name, int oldRadius, int newRadius, Runnable onSuccess, Consumer<Throwable> onError) {
        if (mapId == null) {
            onError.accept(new IllegalArgumentException("mapId darf nicht null sein"));
            return;
        }
        Task<Void> task = new Task<>() {
            @Override
            protected Void call() throws Exception {
                catalogObject.updateMap(new UpdateMapInput(mapId, name, oldRadius, newRadius));
                return null;
            }
        };
        UiAsyncTasks.submit(task, ignored -> onSuccess.run(), onError);
    }

    public void flushTerrainChanges(Map<Long, HexTerrainType> terrainChanges, Runnable onSuccess, Consumer<Throwable> onError) {
        if (terrainChanges == null || terrainChanges.isEmpty()) {
            onSuccess.run();
            return;
        }
        Task<Void> task = new Task<>() {
            @Override
            protected Void call() throws Exception {
                catalogObject.flushTerrainChanges(new FlushTerrainChangesInput(terrainChanges));
                return null;
            }
        };
        UiAsyncTasks.submit(task, ignored -> onSuccess.run(), onError);
    }

    public int removedTilesForRadiusChange(int oldRadius, int newRadius) {
        return Math.max(0, hexTileCount(oldRadius) - hexTileCount(newRadius));
    }

    private static int hexTileCount(int radius) {
        return 3 * radius * (radius + 1) + 1;
    }
}
