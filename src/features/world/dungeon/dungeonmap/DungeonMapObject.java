package features.world.dungeon.dungeonmap;

import features.world.dungeon.dungeonmap.corridor.CorridorObject;
import features.world.dungeon.dungeonmap.input.EnsureLoadedInput;
import features.world.dungeon.dungeonmap.input.PersistClusterRewriteReboundsInput;
import features.world.dungeon.dungeonmap.input.SelectMapInput;
import features.world.dungeon.dungeonmap.input.SubmitMutationInput;
import features.world.dungeon.transition.TransitionObject;
import features.world.dungeon.transition.input.PersistReboundConnectionsInput;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

/**
 * Public root owner object for loaded dungeon-map snapshots and map-owned workflows.
 */
public final class DungeonMapObject {

    private final features.world.dungeon.dungeonmap.repository.DungeonMapRepository mapRepository;
    private final features.world.dungeon.dungeonmap.application.DungeonMapApplicationService mapApplicationService;
    private final CorridorObject corridorObject;
    private final TransitionObject transitionObject;
    private final features.world.dungeon.dungeonmap.application.DungeonMapLoadingService loadingService;

    @SuppressWarnings("unused")
    public DungeonMapObject(
            features.world.dungeon.dungeonmap.repository.DungeonMapRepository mapRepository,
            features.world.dungeon.dungeonmap.application.DungeonMapApplicationService mapApplicationService,
            CorridorObject corridorObject,
            TransitionObject transitionObject,
            features.world.dungeon.dungeonmap.application.DungeonMapLoadingService loadingService
    ) {
        this.mapRepository = java.util.Objects.requireNonNull(mapRepository, "mapRepository");
        this.mapApplicationService = java.util.Objects.requireNonNull(mapApplicationService, "mapApplicationService");
        this.corridorObject = java.util.Objects.requireNonNull(corridorObject, "corridorObject");
        this.transitionObject = java.util.Objects.requireNonNull(transitionObject, "transitionObject");
        this.loadingService = java.util.Objects.requireNonNull(loadingService, "loadingService");
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
        List<Long> persistedClusterIds = input.persistedClusterIds();
        features.world.dungeon.dungeonmap.model.DungeonMap persistedRoomMap = mapRepository.persistClusterRoomRewriteAndReload(
                conn,
                originalMap.mapId(),
                rewriteRequest,
                persistedClusterIds);
        features.world.dungeon.dungeonmap.model.ClusterRewriteEffects rewriteEffects = mapApplicationService.reconcileClusterRewrite(
                new features.world.dungeon.dungeonmap.api.ReconcileClusterRewriteRequest(originalMap, persistedRoomMap, rewriteRequest));
        corridorObject.persistReboundCorridors(conn, persistedRoomMap.mapId(), rewriteEffects.reboundCorridors());
        transitionObject.persistReboundConnections(PersistReboundConnectionsInput.reboundConnections(
                conn,
                originalMap,
                rewriteEffects.reboundTransitionConnectionsById()));
    }
}
