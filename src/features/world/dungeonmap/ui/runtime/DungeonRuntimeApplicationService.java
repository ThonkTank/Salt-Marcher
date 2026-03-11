package features.world.dungeonmap.ui.runtime;

import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonRuntimeState;
import features.world.dungeonmap.service.DungeonMapQueryService;
import features.world.dungeonmap.service.DungeonRuntimeService;
import javafx.concurrent.Task;
import ui.async.UiAsyncTasks;

import java.util.List;
import java.util.function.Consumer;

public final class DungeonRuntimeApplicationService {

    public void loadMapList(Consumer<List<DungeonMap>> onSuccess, Consumer<Throwable> onError) {
        Task<List<DungeonMap>> task = new Task<>() {
            @Override
            protected List<DungeonMap> call() throws Exception {
                return DungeonMapQueryService.getAllMaps();
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onError);
    }

    public void loadRuntimeState(Long requestedMapId, Consumer<DungeonRuntimeState> onSuccess, Consumer<Throwable> onError) {
        Task<DungeonRuntimeState> task = new Task<>() {
            @Override
            protected DungeonRuntimeState call() throws Exception {
                return DungeonRuntimeService.loadRuntimeState(requestedMapId);
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onError);
    }

    public void movePartyToEndpoint(long mapId, long endpointId, Consumer<DungeonRuntimeService.MoveResult> onSuccess, Consumer<Throwable> onError) {
        Task<DungeonRuntimeService.MoveResult> task = new Task<>() {
            @Override
            protected DungeonRuntimeService.MoveResult call() throws Exception {
                return DungeonRuntimeService.movePartyToEndpoint(mapId, endpointId);
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onError);
    }
}
