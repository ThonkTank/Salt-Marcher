package features.world.dungeonmap.ui.runtime;

import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonRuntimeState;
import features.world.dungeonmap.service.DungeonMapService;
import javafx.concurrent.Task;
import ui.async.UiAsyncTasks;

import java.util.List;
import java.util.function.Consumer;

public final class DungeonApplicationService {

    public void loadMaps(Consumer<List<DungeonMap>> onSuccess, Consumer<Throwable> onError) {
        Task<List<DungeonMap>> task = new Task<>() {
            @Override
            protected List<DungeonMap> call() throws Exception {
                return DungeonMapService.getAllMaps();
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onError);
    }

    public void loadRuntimeState(Consumer<DungeonRuntimeState> onSuccess, Consumer<Throwable> onError) {
        Task<DungeonRuntimeState> task = new Task<>() {
            @Override
            protected DungeonRuntimeState call() throws Exception {
                DungeonMapService.ensureDefaultMapExists();
                DungeonRuntimeState state = DungeonMapService.loadPreferredRuntimeState();
                if (state.activeRoomId() != null) {
                    return state;
                }
                Long recoveredRoomId = DungeonMapService.recoverActiveRoom(state.layout().map().mapId());
                if (recoveredRoomId == null) {
                    return state;
                }
                return DungeonMapService.loadRuntimeState(state.layout().map().mapId());
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onError);
    }

    public void loadRuntimeState(long mapId, Consumer<DungeonRuntimeState> onSuccess, Consumer<Throwable> onError) {
        Task<DungeonRuntimeState> task = new Task<>() {
            @Override
            protected DungeonRuntimeState call() throws Exception {
                return DungeonMapService.loadRuntimeState(mapId);
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onError);
    }

    public void moveParty(long mapId, long roomId, Runnable onSuccess, Consumer<Throwable> onError) {
        Task<Void> task = new Task<>() {
            @Override
            protected Void call() throws Exception {
                DungeonMapService.updateActiveRoom(mapId, roomId);
                return null;
            }
        };
        UiAsyncTasks.submit(task, ignored -> onSuccess.run(), onError);
    }
}
