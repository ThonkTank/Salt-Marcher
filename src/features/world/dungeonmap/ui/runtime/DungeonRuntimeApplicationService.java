package features.world.dungeonmap.ui.runtime;

import features.world.dungeonmap.model.DungeonRuntimeLocation;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.service.catalog.DungeonMapCatalogService;
import features.world.dungeonmap.service.runtime.DungeonRuntimeService;
import ui.async.UiAsyncTasks;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

/**
 * UI-naher Application-Service fuer Runtime-Workflows der Dungeon-Ansicht.
 */
public final class DungeonRuntimeApplicationService {

    private final DungeonMapCatalogService mapCatalogService;
    private final DungeonRuntimeService runtimeService;
    private final AtomicLong loadSequence = new AtomicLong();

    public DungeonRuntimeApplicationService(DungeonMapCatalogService mapCatalogService, DungeonRuntimeService runtimeService) {
        this.mapCatalogService = Objects.requireNonNull(mapCatalogService, "mapCatalogService");
        this.runtimeService = Objects.requireNonNull(runtimeService, "runtimeService");
    }

    public void loadPreferredState(Consumer<DungeonRuntimeLoadState> onSuccess, Consumer<Throwable> onError) {
        long request = loadSequence.incrementAndGet();
        UiAsyncTasks.submit(runtimeService::loadPreferredRuntimeState,
                state -> loadMapsForState(request, state.layout().map().mapId(), state, onSuccess, onError),
                throwable -> deliverFailure(request, throwable, onError));
    }

    public void loadState(long mapId, Consumer<DungeonRuntimeLoadState> onSuccess, Consumer<Throwable> onError) {
        long request = loadSequence.incrementAndGet();
        UiAsyncTasks.submit(() -> runtimeService.loadRuntimeState(mapId),
                state -> loadMapsForState(request, mapId, state, onSuccess, onError),
                throwable -> deliverFailure(request, throwable, onError));
    }

    public void moveParty(long mapId, DungeonRuntimeLocation location, Runnable onSuccess, Consumer<Throwable> onError) {
        UiAsyncTasks.submitVoid(() -> runtimeService.updateActiveLocation(mapId, location), onSuccess, onError);
    }

    private void loadMapsForState(
            long request,
            long selectedMapId,
            features.world.dungeonmap.model.DungeonRuntimeState state,
            Consumer<DungeonRuntimeLoadState> onSuccess,
            Consumer<Throwable> onError
    ) {
        UiAsyncTasks.submit(mapCatalogService::getAllMaps,
                maps -> {
                    if (request == loadSequence.get()) {
                        onSuccess.accept(new DungeonRuntimeLoadState(maps, selectedMapId, state));
                    }
                },
                throwable -> deliverFailure(request, throwable, onError));
    }

    private void deliverFailure(long request, Throwable throwable, Consumer<Throwable> onError) {
        if (request == loadSequence.get()) {
            onError.accept(throwable);
        }
    }
}
