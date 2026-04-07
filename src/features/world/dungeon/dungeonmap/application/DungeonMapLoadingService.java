package features.world.dungeon.dungeonmap.application;

import database.DatabaseManager;
import features.world.dungeon.catalog.application.DungeonMapCatalogEntry;
import features.world.dungeon.dungeonmap.state.DungeonMapState;
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

/**
 * Async loading and reload-after-write coordinator for dungeon maps.
 *
 * <p>This service owns initial-load deduplication, stale-request suppression, and the handoff from transactional writes
 * back to authoritative reloads. Map-selection policy itself stays in {@link DungeonMapLoadResolver}.</p>
 */
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

    private void startRequest(boolean initialRequest, Callable<DungeonMapLoadResolver.LoadResolution> task) {
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

    private DungeonMapLoadResolver.LoadResolution loadInitialResult() throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            return loadResolver.resolveInitial(conn);
        }
    }

    private DungeonMapLoadResolver.LoadResolution loadSelectedMapResult(long mapId) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            return loadResolver.resolveSelection(conn, mapId, preferredMapIds());
        }
    }

    private void applyResult(
            long requestId,
            boolean initialRequest,
            DungeonMapLoadResolver.LoadResolution result,
            Throwable failure
    ) {
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
        if (result == null) {
            state.showLoadFailure(state.maps(), "Dungeon konnte nicht geladen werden");
            return;
        }
        if (result.activeMap() != null) {
            state.showLoaded(result.maps(), result.activeMap(), result.errorMessage());
            return;
        }
        if (initialRequest) {
            state.showLoaded(result.maps(), null, result.errorMessage());
            return;
        }
        if (result.errorMessage() != null) {
            if (!activeMapStillExists(result.maps())) {
                state.showLoaded(result.maps(), null, result.errorMessage());
                return;
            }
            state.showLoadFailure(result.maps(), result.errorMessage());
            return;
        }
        state.showLoaded(result.maps(), null, null);
    }

    private boolean initialRequestSucceeded(
            long requestId,
            DungeonMapLoadResolver.LoadResolution result,
            Throwable failure
    ) {
        return requestId == requestSequence.get()
                && failure == null
                && result != null;
    }

    private List<Long> preferredMapIds() {
        return state.maps().stream()
                .map(map -> map.mapId())
                .filter(mapId -> mapId > 0)
                .toList();
    }

    private boolean activeMapStillExists(List<DungeonMapCatalogEntry> maps) {
        Long activeMapId = state.activeMapId();
        if (activeMapId == null) {
            return false;
        }
        return maps.stream().anyMatch(map -> map.mapId() == activeMapId);
    }
}
