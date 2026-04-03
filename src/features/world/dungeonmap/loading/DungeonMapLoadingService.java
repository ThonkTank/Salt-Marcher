package features.world.dungeonmap.loading;

import database.DatabaseManager;
import features.world.dungeonmap.state.DungeonMapState;
import ui.async.UiAsyncTasks;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.logging.Level;
import java.util.logging.Logger;

public final class DungeonMapLoadingService {

    private static final Logger LOGGER = Logger.getLogger(DungeonMapLoadingService.class.getName());

    private final DungeonMapLoadResolver loadResolver;
    private final DungeonMapState state;
    private final AtomicLong requestSequence = new AtomicLong();

    private final Object initialLoadLock = new Object();
    private volatile boolean initialized;
    private volatile boolean initialLoadInFlight;

    public DungeonMapLoadingService(DungeonMapLoadResolver loadResolver, DungeonMapState state) {
        this.loadResolver = loadResolver;
        this.state = state;
    }

    public void ensureLoaded() {
        if (beginInitialLoad()) {
            startRequest(true, this::loadInitialResult);
        }
    }

    public void selectMap(long mapId) {
        startRequest(false, () -> loadSelectedMapResult(mapId));
    }

    public <T> void submitMutation(
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

    private void reload(Long preferredMapId) {
        if (preferredMapId == null) {
            startRequest(false, this::loadInitialResult);
            return;
        }
        selectMap(preferredMapId);
    }

    private void startRequest(boolean initialRequest, Callable<DungeonMapLoadResolution> task) {
        long requestId = requestSequence.incrementAndGet();
        state.showLoading();
        UiAsyncTasks.submit(
                task,
                result -> applyResult(requestId, initialRequest, result, null),
                failure -> applyResult(requestId, initialRequest, null, failure));
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

    private DungeonMapLoadResolution loadInitialResult() {
        try (Connection conn = DatabaseManager.getConnection()) {
            return loadResolver.resolveInitial(conn);
        } catch (SQLException exception) {
            LOGGER.log(Level.WARNING, "Dungeon-Katalog konnte nicht geladen werden", exception);
            return new DungeonMapLoadResolution(List.of(), null, "Dungeon konnte nicht geladen werden");
        }
    }

    private DungeonMapLoadResolution loadSelectedMapResult(long mapId) {
        try (Connection conn = DatabaseManager.getConnection()) {
            return loadResolver.resolveSelection(conn, mapId, state.maps());
        } catch (SQLException exception) {
            LOGGER.log(Level.WARNING, "Dungeon konnte nicht geladen werden", exception);
            return new DungeonMapLoadResolution(state.maps(), null, "Dungeon konnte nicht geladen werden");
        }
    }

    private void applyResult(long requestId, boolean initialRequest, DungeonMapLoadResolution result, Throwable failure) {
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

    private boolean initialRequestSucceeded(long requestId, DungeonMapLoadResolution result, Throwable failure) {
        return requestId == requestSequence.get()
                && failure == null
                && result != null
                && (result.activeMap() != null || result.maps().isEmpty());
    }
}
