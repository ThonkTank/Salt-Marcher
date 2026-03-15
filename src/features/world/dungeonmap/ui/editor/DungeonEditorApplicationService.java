package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.Point2i;
import features.world.dungeonmap.service.DungeonMapService;
import javafx.concurrent.Task;
import ui.async.UiAsyncTasks;

import java.util.List;
import java.util.function.Consumer;

public final class DungeonEditorApplicationService {

    public void loadMaps(Consumer<List<DungeonMap>> onSuccess, Consumer<Throwable> onError) {
        Task<List<DungeonMap>> task = new Task<>() {
            @Override
            protected List<DungeonMap> call() throws Exception {
                return DungeonMapService.getAllMaps();
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onError);
    }

    public void loadLayout(long mapId, Consumer<DungeonLayout> onSuccess, Consumer<Throwable> onError) {
        Task<DungeonLayout> task = new Task<>() {
            @Override
            protected DungeonLayout call() throws Exception {
                return DungeonMapService.loadLayout(mapId);
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onError);
    }

    public void createMap(String name, Consumer<Long> onSuccess, Consumer<Throwable> onError) {
        Task<Long> task = new Task<>() {
            @Override
            protected Long call() throws Exception {
                return DungeonMapService.createMap(name);
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onError);
    }

    public void renameMap(long mapId, String name, Runnable onSuccess, Consumer<Throwable> onError) {
        Task<Void> task = new Task<>() {
            @Override
            protected Void call() throws Exception {
                DungeonMapService.renameMap(mapId, name);
                return null;
            }
        };
        UiAsyncTasks.submit(task, ignored -> onSuccess.run(), onError);
    }

    public void addRoom(long mapId, Consumer<Long> onSuccess, Consumer<Throwable> onError) {
        Task<Long> task = new Task<>() {
            @Override
            protected Long call() throws Exception {
                return DungeonMapService.addRoom(mapId);
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onError);
    }

    public void moveRoom(long roomId, String name, Point2i center, Runnable onSuccess, Consumer<Throwable> onError) {
        Task<Void> task = new Task<>() {
            @Override
            protected Void call() throws Exception {
                DungeonMapService.moveRoom(roomId, name, center);
                return null;
            }
        };
        UiAsyncTasks.submit(task, ignored -> onSuccess.run(), onError);
    }

    public void deleteRoom(long roomId, Runnable onSuccess, Consumer<Throwable> onError) {
        Task<Void> task = new Task<>() {
            @Override
            protected Void call() throws Exception {
                DungeonMapService.deleteRoom(roomId);
                return null;
            }
        };
        UiAsyncTasks.submit(task, ignored -> onSuccess.run(), onError);
    }

    public void connectRooms(long mapId, long fromRoomId, long toRoomId, Runnable onSuccess, Consumer<Throwable> onError) {
        Task<Void> task = new Task<>() {
            @Override
            protected Void call() throws Exception {
                DungeonMapService.connectRooms(mapId, fromRoomId, toRoomId);
                return null;
            }
        };
        UiAsyncTasks.submit(task, ignored -> onSuccess.run(), onError);
    }

    public void deleteCorridor(long corridorId, Runnable onSuccess, Consumer<Throwable> onError) {
        Task<Void> task = new Task<>() {
            @Override
            protected Void call() throws Exception {
                DungeonMapService.deleteCorridor(corridorId);
                return null;
            }
        };
        UiAsyncTasks.submit(task, ignored -> onSuccess.run(), onError);
    }
}
