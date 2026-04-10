package features.world.dungeon.dungeonmap;

import features.world.dungeon.dungeonmap.corridor.CorridorObject;
import features.world.dungeon.dungeonmap.input.EnsureLoadedInput;
import features.world.dungeon.dungeonmap.input.PersistClusterRewriteReboundsInput;
import features.world.dungeon.dungeonmap.input.PersistClusterRewriteRoomsInput;
import features.world.dungeon.dungeonmap.input.SelectMapInput;
import features.world.dungeon.dungeonmap.input.SetActiveProjectionLevelInput;
import features.world.dungeon.dungeonmap.input.SetLevelOverlayModeInput;
import features.world.dungeon.dungeonmap.input.SetLevelOverlayOpacityInput;
import features.world.dungeon.dungeonmap.input.SetLevelOverlayRangeInput;
import features.world.dungeon.dungeonmap.input.SetReachableProjectionLevelInput;
import features.world.dungeon.dungeonmap.input.SetSelectedOverlayLevelsInput;
import features.world.dungeon.dungeonmap.input.SubmitMutationInput;
import features.world.dungeon.transition.TransitionObject;
import features.world.dungeon.transition.input.PersistReboundConnectionsInput;

import java.sql.Connection;
import java.sql.SQLException;

/**
 * Public root owner object for loaded dungeon-map snapshots and map-owned workflows.
 */
public final class DungeonMapObject {

    private final features.world.dungeon.dungeonmap.repository.DungeonMapRepository mapRepository;
    private final features.world.dungeon.dungeonmap.application.DungeonMapApplicationService mapApplicationService;
    private final CorridorObject corridorObject;
    private final TransitionObject transitionObject;
    private final features.world.dungeon.dungeonmap.application.DungeonMapLoadingService loadingService;
    private final features.world.dungeon.dungeonmap.state.DungeonMapState mapState;

    @SuppressWarnings("unused")
    public DungeonMapObject(
            features.world.dungeon.dungeonmap.repository.DungeonMapRepository mapRepository,
            features.world.dungeon.dungeonmap.application.DungeonMapApplicationService mapApplicationService,
            CorridorObject corridorObject,
            TransitionObject transitionObject,
            features.world.dungeon.dungeonmap.application.DungeonMapLoadingService loadingService,
            features.world.dungeon.dungeonmap.state.DungeonMapState mapState
    ) {
        this.mapRepository = java.util.Objects.requireNonNull(mapRepository, "mapRepository");
        this.mapApplicationService = java.util.Objects.requireNonNull(mapApplicationService, "mapApplicationService");
        this.corridorObject = java.util.Objects.requireNonNull(corridorObject, "corridorObject");
        this.transitionObject = java.util.Objects.requireNonNull(transitionObject, "transitionObject");
        this.loadingService = java.util.Objects.requireNonNull(loadingService, "loadingService");
        this.mapState = java.util.Objects.requireNonNull(mapState, "mapState");
    }

    /**
     * Canonical map-owned initial-load handoff for shell surfaces. Selection policy remains in catalog; this owner
     * owns the authoritative load/reload workflow that drives shared map state.
     */
    @SuppressWarnings("unused")
    public void ensureLoaded(EnsureLoadedInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        loadingService.ensureLoaded();
    }

    /**
     * Canonical map-owned explicit map-selection handoff for editor and runtime surfaces.
     */
    @SuppressWarnings("unused")
    public void selectMap(SelectMapInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        loadingService.selectMap(input.mapId());
    }

    /**
     * Canonical map-owned session-state transition for editor projection-level changes.
     */
    public void setActiveProjectionLevel(SetActiveProjectionLevelInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        mapState.setActiveProjectionLevel(input.levelZ());
    }

    /**
     * Canonical map-owned session-state transition for runtime projection levels constrained to reachable floors.
     */
    public void setReachableProjectionLevel(SetReachableProjectionLevelInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        mapState.setReachableProjectionLevel(input.levelZ());
    }

    /**
     * Canonical map-owned overlay-mode transition shared by editor and runtime shell surfaces.
     */
    public void setLevelOverlayMode(SetLevelOverlayModeInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        mapState.setLevelOverlayMode(input.mode());
    }

    /**
     * Canonical map-owned overlay-range transition shared by editor and runtime shell surfaces.
     */
    public void setLevelOverlayRange(SetLevelOverlayRangeInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        mapState.setLevelOverlayRange(input.levelRange());
    }

    /**
     * Canonical map-owned overlay-opacity transition shared by editor and runtime shell surfaces.
     */
    public void setLevelOverlayOpacity(SetLevelOverlayOpacityInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        mapState.setLevelOverlayOpacity(input.opacity());
    }

    /**
     * Canonical map-owned selected-overlay-level transition shared by editor and runtime shell surfaces.
     */
    public void setSelectedOverlayLevels(SetSelectedOverlayLevelsInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        mapState.setSelectedOverlayLevels(input.levels());
    }

    /**
     * Canonical map-owned reload-after-write handoff. Mutations stay on their feature owners, then this owner
     * restores shared map state from authoritative reloads instead of local mirrors.
     */
    public <T> void submitMutation(SubmitMutationInput<T> input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        loadingService.submitMutation(
                input.work(),
                input.preferredMapIdResolver(),
                input.onPersisted(),
                input.onFailure());
    }

    /**
     * Canonical map-owned room rewrite persistence handoff. Cluster-owned rewrite tails project the final room rows,
     * then this owner persists those rows before any reload/rebound reconciliation begins.
     */
    public void persistClusterRewriteRooms(PersistClusterRewriteRoomsInput input) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        if (input.connection() == null || input.mapId() <= 0) {
            return;
        }
        features.world.dungeon.dungeonmap.repository.PersistClusterRewriteRoomsRepository.persistClusterRewriteRooms(
                input.connection(),
                features.world.dungeon.dungeonmap.state.PersistClusterRewriteRoomsState.persistClusterRewriteRooms(input));
    }

    /**
     * Canonical map-owned tail for persisted cluster rewrites: reload authoritative room-backed state, reconcile
     * cross-owner effects, and delegate rebound writes to corridor and transition root seams.
     */
    public void persistClusterRewriteRebounds(PersistClusterRewriteReboundsInput input) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        if (input.isEmpty()) {
            return;
        }
        Connection conn = input.connection();
        features.world.dungeon.dungeonmap.model.DungeonMap originalMap = input.originalMap();
        features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest rewriteRequest = input.rewriteRequest();
        features.world.dungeon.dungeonmap.model.DungeonMap persistedRoomMap = mapRepository.loadMap(conn, originalMap.mapId());
        features.world.dungeon.dungeonmap.model.ClusterRewriteEffects rewriteEffects = mapApplicationService.reconcileClusterRewrite(
                new features.world.dungeon.dungeonmap.api.ReconcileClusterRewriteRequest(originalMap, persistedRoomMap, rewriteRequest));
        corridorObject.persistReboundCorridors(conn, persistedRoomMap.mapId(), rewriteEffects.reboundCorridors());
        transitionObject.persistReboundConnections(PersistReboundConnectionsInput.reboundConnections(
                conn,
                originalMap,
                rewriteEffects.reboundTransitionConnectionsById()));
    }
}
