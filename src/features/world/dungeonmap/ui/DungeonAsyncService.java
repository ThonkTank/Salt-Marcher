package features.world.dungeonmap.ui;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonRuntimeState;
import features.world.dungeonmap.model.Point2i;
import features.world.dungeonmap.service.DungeonMapService;
import javafx.concurrent.Task;
import ui.async.UiAsyncTasks;

import java.util.List;
import java.util.concurrent.Callable;
import java.util.function.Consumer;

public final class DungeonAsyncService {

    public void loadMaps(Consumer<List<DungeonMap>> onSuccess, Consumer<Throwable> onError) {
        submit(DungeonMapService::getAllMaps, onSuccess, onError);
    }

    public void loadLayout(Long mapId, Consumer<DungeonLayout> onSuccess, Consumer<Throwable> onError) {
        if (mapId == null) {
            onError.accept(new IllegalArgumentException("mapId darf nicht null sein"));
            return;
        }
        submit(() -> DungeonMapService.loadLayout(mapId), onSuccess, onError);
    }

    public void createMap(String name, Consumer<Long> onSuccess, Consumer<Throwable> onError) {
        submit(() -> DungeonMapService.createMap(name), onSuccess, onError);
    }

    public void renameMap(Long mapId, String name, Runnable onSuccess, Consumer<Throwable> onError) {
        if (mapId == null) {
            onError.accept(new IllegalArgumentException("mapId darf nicht null sein"));
            return;
        }
        submitVoid(() -> DungeonMapService.renameMap(mapId, name), onSuccess, onError);
    }

    public void addRoom(long mapId, Consumer<Long> onSuccess, Consumer<Throwable> onError) {
        submit(() -> DungeonMapService.addRoom(mapId), onSuccess, onError);
    }

    public void moveRoom(long roomId, String name, Point2i center, Runnable onSuccess, Consumer<Throwable> onError) {
        submitVoid(() -> DungeonMapService.moveRoom(roomId, name, center), onSuccess, onError);
    }

    public void deleteRoom(long roomId, Runnable onSuccess, Consumer<Throwable> onError) {
        submitVoid(() -> DungeonMapService.deleteRoom(roomId), onSuccess, onError);
    }

    public void connectRooms(long mapId, long fromRoomId, long toRoomId, Runnable onSuccess, Consumer<Throwable> onError) {
        submitVoid(() -> DungeonMapService.connectRooms(mapId, fromRoomId, toRoomId), onSuccess, onError);
    }

    public void deleteCorridor(long corridorId, Runnable onSuccess, Consumer<Throwable> onError) {
        submitVoid(() -> DungeonMapService.deleteCorridor(corridorId), onSuccess, onError);
    }

    public void loadPreferredRuntimeState(Consumer<DungeonRuntimeState> onSuccess, Consumer<Throwable> onError) {
        submit(() -> {
            DungeonMapService.ensureDefaultMapExists();
            return DungeonMapService.loadPreferredRuntimeState();
        }, onSuccess, onError);
    }

    public void loadRuntimeState(long mapId, Consumer<DungeonRuntimeState> onSuccess, Consumer<Throwable> onError) {
        submit(() -> DungeonMapService.loadRuntimeState(mapId), onSuccess, onError);
    }

    public void moveParty(long mapId, long roomId, Runnable onSuccess, Consumer<Throwable> onError) {
        submitVoid(() -> DungeonMapService.updateActiveRoom(mapId, roomId), onSuccess, onError);
    }

    private static <T> void submit(Callable<T> work, Consumer<T> onSuccess, Consumer<Throwable> onError) {
        Task<T> task = new Task<>() {
            @Override
            protected T call() throws Exception {
                return work.call();
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onError);
    }

    private static void submitVoid(ThrowingRunnable work, Runnable onSuccess, Consumer<Throwable> onError) {
        Task<Void> task = new Task<>() {
            @Override
            protected Void call() throws Exception {
                work.run();
                return null;
            }
        };
        UiAsyncTasks.submit(task, ignored -> onSuccess.run(), onError);
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }
}
