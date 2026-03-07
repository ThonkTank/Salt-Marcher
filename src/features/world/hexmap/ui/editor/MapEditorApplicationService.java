package features.world.hexmap.ui.editor;

import features.world.hexmap.model.HexMap;
import features.world.hexmap.model.HexTerrainType;
import features.world.hexmap.model.HexTile;
import features.world.hexmap.service.HexMapService;
import javafx.concurrent.Task;
import ui.UiAsyncTasks;

import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * UI-naher Application-Service fuer Workflows im Karteneditor.
 * Kapselt Task-Setup und delegiert Persistenzlogik an den HexMapService.
 */
public final class MapEditorApplicationService {

    public void loadMapList(Consumer<List<HexMap>> onSuccess, Consumer<Throwable> onError) {
        Task<List<HexMap>> task = new Task<>() {
            @Override
            protected List<HexMap> call() throws Exception {
                return HexMapService.getAllMaps();
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
                return HexMapService.getTiles(mapId);
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onError);
    }

    public void createMap(String name, int radius, Consumer<Long> onSuccess, Consumer<Throwable> onError) {
        Task<Long> task = new Task<>() {
            @Override
            protected Long call() throws Exception {
                return HexMapService.createHexMap(name, radius);
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
                HexMapService.updateMap(mapId, name, oldRadius, newRadius);
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
                HexMapService.batchUpdateTerrain(terrainChanges);
                return null;
            }
        };
        UiAsyncTasks.submit(task, ignored -> onSuccess.run(), onError);
    }

    public int removedTilesForRadiusChange(int oldRadius, int newRadius) {
        return Math.max(0, HexMapService.hexTileCount(oldRadius) - HexMapService.hexTileCount(newRadius));
    }
}
