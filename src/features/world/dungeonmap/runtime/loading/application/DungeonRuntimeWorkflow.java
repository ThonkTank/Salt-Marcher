package features.world.dungeonmap.runtime.loading.application;

import features.world.dungeonmap.corridors.model.CorridorTopology;
import features.world.dungeonmap.corridors.model.DungeonCorridorTopologyPlanner;
import features.world.dungeonmap.view.model.DungeonRuntimeLocation;
import features.world.dungeonmap.runtime.navigation.application.DungeonRuntimeService;
import features.world.dungeonmap.runtime.model.DungeonRuntimeState;
import features.world.dungeonmap.catalog.model.DungeonMap;
import features.world.dungeonmap.catalog.application.DungeonMapCatalogService;

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
    private final DungeonRuntimeAsyncRunner asyncRunner;
    private final AtomicLong loadSequence = new AtomicLong();

    public DungeonRuntimeWorkflow(DungeonMapCatalogService mapCatalogService, DungeonRuntimeService runtimeService, DungeonRuntimeAsyncRunner asyncRunner) {
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
        asyncRunner.runAsync(
                "sm-dungeon-runtime",
                () -> prepareLoad(loader.call()),
                loadState -> {
                    if (request == loadSequence.get()) {
                        onSuccess.accept(loadState);
                    }
                },
                throwable -> deliverFailure(request, throwable, onFailure));
    }

    public void moveParty(long mapId, DungeonRuntimeLocation location, Runnable onSuccess, Consumer<Throwable> onError) {
        asyncRunner.runAsync(
                "sm-dungeon-move",
                () -> { runtimeService.updateActiveLocation(mapId, location); return null; },
                ignored -> onSuccess.run(),
                onError);
    }

    private DungeonRuntimeLoadState prepareLoad(DungeonRuntimeState state) throws Exception {
        List<DungeonMap> maps = mapCatalogService.getAllMaps();
        long selectedMapId = state.layout().map().mapId();
        CorridorTopology corridorTopology = DungeonCorridorTopologyPlanner.planCorridorTopology(state.layout());
        return new DungeonRuntimeLoadState(
                maps,
                selectedMapId,
                state,
                corridorTopology);
    }

    private void deliverFailure(long request, Throwable throwable, Consumer<Throwable> onError) {
        if (request == loadSequence.get()) {
            onError.accept(throwable);
        }
    }
}
