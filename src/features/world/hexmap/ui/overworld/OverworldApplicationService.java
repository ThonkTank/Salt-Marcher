package features.world.hexmap.ui.overworld;

import features.world.hexmap.model.HexTile;
import features.world.hexmap.service.HexMapService;
import features.world.hexmap.service.PartyPositionSession;
import javafx.concurrent.Task;
import ui.async.UiAsyncTasks;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

/**
 * UI-naher Application-Service fuer Overworld-Workflows.
 * Kapselt Hintergrund-Tasks und delegiert Persistenzlogik an den HexMapService.
 */
public final class OverworldApplicationService {

    public record OverworldMapState(List<HexTile> tiles, Long partyTileId, Long defaultPartyTileId) {}
    private final AtomicReference<Consumer<Throwable>> persistErrorHandler = new AtomicReference<>(ignored -> { });
    private PartyPositionSession partyPositionSession = new PartyPositionSession(this::handlePersistError);

    public void loadInitialMap(Consumer<OverworldMapState> onSuccess, Consumer<Throwable> onError) {
        Task<OverworldMapState> task = new Task<>() {
            @Override
            protected OverworldMapState call() throws Exception {
                HexMapService.MapLoadResult mapLoadResult = HexMapService.loadFirstMapWithParty();
                List<HexTile> tiles = mapLoadResult.tiles();
                Long partyTileId = mapLoadResult.partyTileId();
                Long defaultPartyTileId = partyTileId == null ? pickDefaultPartyTileId(tiles) : null;
                return new OverworldMapState(tiles, partyTileId, defaultPartyTileId);
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onError);
    }

    public void updatePartyTile(Long tileId, Runnable onSuccess, Consumer<Throwable> onError) {
        if (tileId == null) {
            onError.accept(new IllegalArgumentException("tileId darf nicht null sein"));
            return;
        }
        Task<Void> task = new Task<>() {
            @Override
            protected Void call() throws Exception {
                HexMapService.updatePartyTile(tileId);
                return null;
            }
        };
        UiAsyncTasks.submit(task, ignored -> onSuccess.run(), onError);
    }

    public void schedulePartyTileUpdate(Long tileId, Consumer<Throwable> onError) {
        if (tileId == null) {
            onError.accept(new IllegalArgumentException("tileId darf nicht null sein"));
            return;
        }
        try {
            persistErrorHandler.set(Objects.requireNonNull(onError, "onError"));
            getPartyPositionSession().scheduleUpdate(tileId);
        } catch (RuntimeException ex) {
            onError.accept(ex);
        }
    }

    public synchronized void shutdownPartyPositionSession() {
        if (partyPositionSession != null) {
            partyPositionSession.close();
            partyPositionSession = null;
        }
    }

    private static Long pickDefaultPartyTileId(List<HexTile> tiles) {
        if (tiles == null || tiles.isEmpty()) return null;
        for (HexTile tile : tiles) {
            if (tile.q() == 0 && tile.r() == 0) {
                return tile.tileId();
            }
        }
        return tiles.get(0).tileId();
    }

    private synchronized PartyPositionSession getPartyPositionSession() {
        if (partyPositionSession == null) {
            partyPositionSession = new PartyPositionSession(this::handlePersistError);
        }
        return partyPositionSession;
    }

    private void handlePersistError(Throwable throwable) {
        persistErrorHandler.get().accept(throwable);
    }
}
