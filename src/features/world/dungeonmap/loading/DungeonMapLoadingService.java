package features.world.dungeonmap.loading;

import features.world.dungeonmap.state.DungeonMapState;
import javafx.application.Platform;
import ui.async.UiAsyncTasks;

import java.sql.SQLException;
import java.util.concurrent.Callable;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.logging.Level;
import java.util.logging.Logger;

public final class DungeonMapLoadingService {

    private static final Logger LOGGER = Logger.getLogger(DungeonMapLoadingService.class.getName());

    private final DungeonMapLoader loader;
    private final DungeonMapState state;
    private final AtomicLong requestSequence = new AtomicLong();

    private final Object initialLoadLock = new Object();
    private volatile boolean initialized;
    private volatile boolean initialLoadInFlight;

    public DungeonMapLoadingService(DungeonMapLoader loader, DungeonMapState state) {
        this.loader = loader;
        this.state = state;
    }

    public void ensureLoaded() {
        if (beginInitialLoad()) {
            startRequest(true, this::loadInitialResult);
        }
    }

    public void loadMap(long mapId) {
        startRequest(false, () -> loadSpecificMapResult(mapId));
    }

    public void reload(Long preferredMapId) {
        if (preferredMapId == null) {
            startRequest(false, this::loadInitialResult);
            return;
        }
        loadMap(preferredMapId);
    }

    public void submitReloadingWrite(
            UiAsyncTasks.ThrowingRunnable work,
            Long preferredMapId,
            Runnable onPersisted,
            Consumer<Throwable> onFailure
    ) {
        state.showMutationPending();
        UiAsyncTasks.submitVoid(
                work,
                () -> {
                    if (onPersisted != null) {
                        onPersisted.run();
                    }
                    reload(preferredMapId);
                },
                failure -> {
                    state.clearMutationPending();
                    if (onFailure != null) {
                        onFailure.accept(failure);
                    }
                });
    }

    public <T> void submitReloadingTask(
            Callable<T> work,
            Function<T, Long> preferredMapIdResolver,
            Consumer<T> onPersisted,
            Consumer<Throwable> onFailure
    ) {
        state.showMutationPending();
        UiAsyncTasks.submit(
                work,
                value -> {
                    if (onPersisted != null) {
                        onPersisted.accept(value);
                    }
                    reload(preferredMapIdResolver == null ? null : preferredMapIdResolver.apply(value));
                },
                failure -> {
                    state.clearMutationPending();
                    if (onFailure != null) {
                        onFailure.accept(failure);
                    }
                });
    }

    private void startRequest(boolean initialRequest, Supplier<DungeonMapLoadResult> task) {
        long requestId = requestSequence.incrementAndGet();
        state.showLoading();
        CompletableFuture
                .supplyAsync(task)
                .whenComplete((result, failure) -> Platform.runLater(() -> applyResult(requestId, initialRequest, result, failure)));
    }

    private boolean beginInitialLoad() {
        synchronized (initialLoadLock) {
            if (initialized || initialLoadInFlight) {
                return false;
            }
            initialLoadInFlight = true;
            return true;
        }
    }

    private void finishInitialLoad(boolean successful) {
        synchronized (initialLoadLock) {
            initialLoadInFlight = false;
            if (successful) {
                initialized = true;
            }
        }
    }

    private DungeonMapLoadResult loadInitialResult() {
        try {
            return loader.loadInitial();
        } catch (SQLException exception) {
            LOGGER.log(Level.WARNING, "Dungeon-Katalog konnte nicht geladen werden", exception);
            return new DungeonMapLoadResult(List.of(), null, "Dungeon konnte nicht geladen werden");
        }
    }

    private DungeonMapLoadResult loadSpecificMapResult(long mapId) {
        try {
            return loader.loadMap(mapId, state.maps());
        } catch (SQLException exception) {
            LOGGER.log(Level.WARNING, "Dungeon konnte nicht geladen werden", exception);
            return new DungeonMapLoadResult(state.maps(), null, "Dungeon konnte nicht geladen werden");
        }
    }

    private void applyResult(long requestId, boolean initialRequest, DungeonMapLoadResult result, Throwable failure) {
        if (initialRequest) {
            finishInitialLoad(initialRequestSucceeded(requestId, result, failure));
        }
        if (requestId != requestSequence.get()) {
            return;
        }
        if (failure != null) {
            LOGGER.log(Level.WARNING, "Dungeon konnte nicht geladen werden", failure);
            state.showLoadFailure(state.maps(), "Dungeon konnte nicht geladen werden");
            return;
        }
        if (result == null || result.activeMap() == null) {
            if (result != null && result.errorMessage() != null) {
                state.showLoadFailure(result.maps(), result.errorMessage());
                return;
            }
            state.showLoaded(result == null ? List.of() : result.maps(), null, null);
            return;
        }
        state.showLoaded(result.maps(), result.activeMap(), result.errorMessage());
    }

    private boolean initialRequestSucceeded(long requestId, DungeonMapLoadResult result, Throwable failure) {
        return requestId == requestSequence.get()
                && failure == null
                && result != null
                && result.errorMessage() == null;
    }
}
