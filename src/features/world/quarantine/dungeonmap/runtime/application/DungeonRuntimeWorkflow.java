package features.world.quarantine.dungeonmap.runtime.application;

import features.world.quarantine.dungeonmap.foundation.async.DungeonAsyncRunner;
import features.world.quarantine.dungeonmap.runtime.model.DungeonRuntimeLocation;
import features.world.quarantine.dungeonmap.catalog.model.DungeonMap;
import features.world.quarantine.dungeonmap.catalog.application.DungeonMapCatalogService;
import features.world.quarantine.dungeonmap.loading.DungeonLoadingState;
import features.world.quarantine.dungeonmap.runtime.model.DungeonRuntimeLoadState;
import features.world.quarantine.dungeonmap.runtime.model.DungeonRuntimeState;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.Callable;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

/**
 * UI-naher Application-Service fuer Runtime-Workflows der Dungeon-Ansicht.
 */
public final class DungeonRuntimeWorkflow {

    private final DungeonMapCatalogService mapCatalogService;
    private final DungeonRuntimeService runtimeService;
    private final DungeonAsyncRunner asyncRunner;
    private final AtomicLong loadSequence = new AtomicLong();

    public DungeonRuntimeWorkflow(DungeonMapCatalogService mapCatalogService, DungeonRuntimeService runtimeService, DungeonAsyncRunner asyncRunner) {
        this.mapCatalogService = Objects.requireNonNull(mapCatalogService, "mapCatalogService");
        this.runtimeService = Objects.requireNonNull(runtimeService, "runtimeService");
        this.asyncRunner = Objects.requireNonNull(asyncRunner, "asyncRunner");
    }

    public void loadPreferredState(Consumer<DungeonRuntimeLoadState> onSuccess, Consumer<Throwable> onError) {
        loadStateInternal(runtimeService::loadPreferredRuntimeState, onSuccess, onError);
    }

    public void loadState(long mapId, Consumer<DungeonRuntimeLoadState> onSuccess, Consumer<Throwable> onError) {
        loadStateInternal(() -> runtimeService.loadRuntimeState(mapId), onSuccess, onError);
    }

    private void loadStateInternal(Callable<DungeonRuntimeState> loader, Consumer<DungeonRuntimeLoadState> onSuccess, Consumer<Throwable> onFailure) {
        long request = loadSequence.incrementAndGet();
        asyncRunner.submit(
                () -> prepareLoad(loader.call()),
                loadState -> {
                    if (request == loadSequence.get()) {
                        onSuccess.accept(loadState);
                    }
                },
                throwable -> deliverFailure(request, throwable, onFailure));
    }

    public void moveParty(long mapId, DungeonRuntimeLocation location, Runnable onSuccess, Consumer<Throwable> onError) {
        asyncRunner.submit(
                () -> { runtimeService.updateActiveLocation(mapId, location); return null; },
                ignored -> onSuccess.run(),
                onError);
    }

    private DungeonRuntimeLoadState prepareLoad(DungeonRuntimeState state) throws Exception {
        List<DungeonMap> maps = mapCatalogService.getAllMaps();
        long selectedMapId = state.layout().map().mapId();
        return new DungeonRuntimeLoadState(
                state,
                DungeonLoadingState.prepared(maps, selectedMapId, state.layout()));
    }

    private void deliverFailure(long request, Throwable throwable, Consumer<Throwable> onError) {
        if (request == loadSequence.get()) {
            onError.accept(throwable);
        }
    }
}
