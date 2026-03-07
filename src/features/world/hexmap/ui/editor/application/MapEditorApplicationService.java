package features.world.hexmap.ui.editor.application;

import database.DatabaseManager;
import features.world.hexmap.model.HexMap;
import features.world.hexmap.model.HexTile;
import features.world.hexmap.service.HexMapService;
import javafx.concurrent.Task;
import ui.UiAsyncExecutor;

import java.sql.Connection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Consumer;

/**
 * UI-naher Application-Service fuer Workflows im Karteneditor.
 * Kapselt Task-Setup und delegiert Persistenzlogik an den HexMapService.
 */
public final class MapEditorApplicationService {

    private static <T> void submitTask(Task<T> task, Consumer<T> onSuccess, Consumer<Throwable> onError) {
        task.setOnSucceeded(e -> onSuccess.accept(task.getValue()));
        task.setOnFailed(e -> onError.accept(task.getException()));
        UiAsyncExecutor.submit(task);
    }

    public void loadMapList(Consumer<List<HexMap>> onSuccess, Consumer<Throwable> onError) {
        Task<List<HexMap>> task = new Task<>() {
            @Override
            protected List<HexMap> call() throws Exception {
                return HexMapService.getAllMaps();
            }
        };
        submitTask(task, onSuccess, onError);
    }

    public void loadFirstMap(Consumer<List<HexTile>> onSuccess, Consumer<Throwable> onError) {
        Task<List<HexTile>> task = new Task<>() {
            @Override
            protected List<HexTile> call() throws Exception {
                try (Connection conn = DatabaseManager.getConnection()) {
                    Optional<Long> mapId = HexMapService.getFirstMapId(conn);
                    if (mapId.isEmpty()) {
                        return List.of();
                    }
                    return HexMapService.getTiles(conn, mapId.get());
                }
            }
        };
        submitTask(task, onSuccess, onError);
    }

    public void loadMap(Long mapId, Consumer<List<HexTile>> onSuccess, Consumer<Throwable> onError) {
        if (mapId == null) {
            onError.accept(new IllegalArgumentException("mapId darf nicht null sein"));
            return;
        }
        Task<List<HexTile>> task = new Task<>() {
            @Override
            protected List<HexTile> call() throws Exception {
                try (Connection conn = DatabaseManager.getConnection()) {
                    return HexMapService.getTiles(conn, mapId);
                }
            }
        };
        submitTask(task, onSuccess, onError);
    }

    public void createMap(String name, int radius, Consumer<Long> onSuccess, Consumer<Throwable> onError) {
        Task<Long> task = new Task<>() {
            @Override
            protected Long call() throws Exception {
                return HexMapService.createHexMap(name, radius);
            }
        };
        submitTask(task, onSuccess, onError);
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
        submitTask(task, ignored -> onSuccess.run(), onError);
    }

    public void flushTerrainChanges(Map<Long, String> terrainChanges, Runnable onSuccess, Consumer<Throwable> onError) {
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
        submitTask(task, ignored -> onSuccess.run(), onError);
    }
}
