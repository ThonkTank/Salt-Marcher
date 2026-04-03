package features.world.dungeonmap.loading;

import database.DatabaseManager;
import features.world.dungeonmap.catalog.application.DungeonMapCatalogEntry;
import features.world.dungeonmap.catalog.persistence.DungeonMapCatalogRepository;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.repository.DungeonLayoutRepository;
import features.world.dungeonmap.state.DungeonMapState;
import ui.async.UiAsyncTasks;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.logging.Level;
import java.util.logging.Logger;

public final class DungeonMapLoadingService {

    private static final Logger LOGGER = Logger.getLogger(DungeonMapLoadingService.class.getName());

    private final DungeonLayoutRepository layoutRepository;
    private final DungeonMapState state;
    private final AtomicLong requestSequence = new AtomicLong();

    private final Object initialLoadLock = new Object();
    private volatile boolean initialized;
    private volatile boolean initialLoadInFlight;

    public DungeonMapLoadingService(DungeonLayoutRepository layoutRepository, DungeonMapState state) {
        this.layoutRepository = layoutRepository;
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

    private void startRequest(boolean initialRequest, Callable<DungeonMapLoadResult> task) {
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

    private DungeonMapLoadResult loadInitialResult() {
        try (Connection conn = DatabaseManager.getConnection()) {
            List<DungeonMapCatalogEntry> maps = DungeonMapCatalogRepository.listMaps(conn);
            if (maps.isEmpty()) {
                return new DungeonMapLoadResult(List.of(), null, null);
            }
            LoadedCatalog loadedCatalog = loadUsableCatalog(conn, maps);
            if (loadedCatalog.usableMaps().isEmpty()) {
                return new DungeonMapLoadResult(List.of(), null, loadedCatalog.failureMessage());
            }
            DungeonMapCatalogEntry firstUsableMap = loadedCatalog.usableMaps().getFirst();
            return new DungeonMapLoadResult(
                    loadedCatalog.allMaps(),
                    loadedCatalog.layoutsById().get(firstUsableMap.mapId()),
                    loadedCatalog.failureMessage());
        } catch (SQLException exception) {
            LOGGER.log(Level.WARNING, "Dungeon-Katalog konnte nicht geladen werden", exception);
            return new DungeonMapLoadResult(List.of(), null, "Dungeon konnte nicht geladen werden");
        }
    }

    private DungeonMapLoadResult loadSelectedMapResult(long mapId) {
        try (Connection conn = DatabaseManager.getConnection()) {
            List<DungeonMapCatalogEntry> maps = DungeonMapCatalogRepository.listMaps(conn);
            DungeonMapCatalogEntry requestedMap = findMap(maps, mapId);
            if (requestedMap == null) {
                return fallbackResult(
                        conn,
                        maps,
                        state.maps(),
                        Set.of(),
                        "Dungeon " + mapId + " existiert nicht mehr");
            }
            try {
                return new DungeonMapLoadResult(maps, layoutRepository.loadLayout(conn, requestedMap), null);
            } catch (RuntimeException exception) {
                return fallbackResult(
                        conn,
                        maps,
                        state.maps(),
                        Set.of(requestedMap.mapId()),
                        combineMessages(
                                "Dungeon " + requestedMap.name() + " konnte nicht geladen werden",
                                requestedMap.name() + " (" + loadFailureMessage(exception) + ")"));
            }
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
                && (result.activeMap() != null || result.maps().isEmpty());
    }

    // Initial load is the only place that scans the full catalog for usable layouts so the UI can open the first
    // working dungeon while still surfacing broken-map warnings as one aggregated loading result.
    private LoadedCatalog loadUsableCatalog(Connection conn, List<DungeonMapCatalogEntry> maps) throws SQLException {
        List<DungeonMapCatalogEntry> usableMaps = new ArrayList<>();
        Map<Long, DungeonLayout> layoutsById = new LinkedHashMap<>();
        Map<DungeonMapCatalogEntry, String> failuresByMap = new LinkedHashMap<>();
        for (DungeonMapCatalogEntry map : maps) {
            if (map == null) {
                continue;
            }
            try {
                DungeonLayout layout = layoutRepository.loadLayout(conn, map);
                usableMaps.add(map);
                layoutsById.put(map.mapId(), layout);
            } catch (RuntimeException exception) {
                failuresByMap.put(map, loadFailureMessage(exception));
            }
        }
        return new LoadedCatalog(
                List.copyOf(maps),
                List.copyOf(usableMaps),
                Map.copyOf(layoutsById),
                Map.copyOf(failuresByMap));
    }

    private DungeonMapLoadResult fallbackResult(
            Connection conn,
            List<DungeonMapCatalogEntry> maps,
            List<DungeonMapCatalogEntry> fallbackMaps,
            Set<Long> excludedMapIds,
            String primaryMessage
    ) throws SQLException {
        String message = primaryMessage;
        for (DungeonMapCatalogEntry fallbackMap : fallbackCandidates(maps, fallbackMaps, excludedMapIds)) {
            try {
                return new DungeonMapLoadResult(maps, layoutRepository.loadLayout(conn, fallbackMap), message);
            } catch (RuntimeException exception) {
                message = combineMessages(
                        message,
                        fallbackMap.name() + " (" + loadFailureMessage(exception) + ")");
            }
        }
        return new DungeonMapLoadResult(maps, null, message);
    }

    private static List<DungeonMapCatalogEntry> fallbackCandidates(
            List<DungeonMapCatalogEntry> maps,
            List<DungeonMapCatalogEntry> fallbackMaps,
            Set<Long> excludedMapIds
    ) {
        LinkedHashMap<Long, DungeonMapCatalogEntry> candidates = new LinkedHashMap<>();
        if (fallbackMaps != null) {
            for (DungeonMapCatalogEntry fallbackMap : fallbackMaps) {
                if (fallbackMap != null && !excludedMapIds.contains(fallbackMap.mapId())) {
                    candidates.putIfAbsent(fallbackMap.mapId(), fallbackMap);
                }
            }
        }
        for (DungeonMapCatalogEntry map : maps) {
            if (map != null && !excludedMapIds.contains(map.mapId())) {
                candidates.putIfAbsent(map.mapId(), map);
            }
        }
        return List.copyOf(candidates.values());
    }

    private static String combineMessages(String primaryMessage, String secondaryMessage) {
        if (primaryMessage == null || primaryMessage.isBlank()) {
            return secondaryMessage;
        }
        if (secondaryMessage == null || secondaryMessage.isBlank()) {
            return primaryMessage;
        }
        return primaryMessage + " " + secondaryMessage;
    }

    private static String loadFailureMessage(RuntimeException exception) {
        String message = exception.getMessage();
        if (message != null && !message.isBlank()) {
            return message;
        }
        return exception.getClass().getSimpleName();
    }

    private static DungeonMapCatalogEntry findMap(List<DungeonMapCatalogEntry> maps, long mapId) {
        for (DungeonMapCatalogEntry map : maps) {
            if (map.mapId() == mapId) {
                return map;
            }
        }
        return null;
    }

    private static final class LoadedCatalog {
        private final List<DungeonMapCatalogEntry> allMaps;
        private final List<DungeonMapCatalogEntry> usableMaps;
        private final Map<Long, DungeonLayout> layoutsById;
        private final Map<DungeonMapCatalogEntry, String> failuresByMap;

        private LoadedCatalog(
                List<DungeonMapCatalogEntry> allMaps,
                List<DungeonMapCatalogEntry> usableMaps,
                Map<Long, DungeonLayout> layoutsById,
                Map<DungeonMapCatalogEntry, String> failuresByMap
        ) {
            this.allMaps = allMaps == null ? List.of() : List.copyOf(allMaps);
            this.usableMaps = usableMaps == null ? List.of() : List.copyOf(usableMaps);
            this.layoutsById = layoutsById == null ? Map.of() : Map.copyOf(layoutsById);
            this.failuresByMap = failuresByMap == null ? Map.of() : Map.copyOf(failuresByMap);
        }

        private List<DungeonMapCatalogEntry> allMaps() {
            return allMaps;
        }

        private List<DungeonMapCatalogEntry> usableMaps() {
            return usableMaps;
        }

        private Map<Long, DungeonLayout> layoutsById() {
            return layoutsById;
        }

        private String failureMessage() {
            if (failuresByMap.isEmpty()) {
                return null;
            }
            List<Map.Entry<DungeonMapCatalogEntry, String>> failures = failuresByMap.entrySet().stream()
                    .sorted(Comparator.comparingLong(entry -> entry.getKey().mapId()))
                    .toList();
            Map.Entry<DungeonMapCatalogEntry, String> firstFailure = failures.getFirst();
            String prefix = failures.size() == 1
                    ? "1 Dungeon konnte nicht geladen werden"
                    : failures.size() + " Dungeons konnten nicht geladen werden";
            return prefix + ": " + firstFailure.getKey().name() + " (" + firstFailure.getValue() + ")";
        }
    }
}
