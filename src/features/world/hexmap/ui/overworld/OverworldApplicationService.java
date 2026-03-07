package features.world.hexmap.ui.overworld;

import features.world.hexmap.model.HexTile;
import features.world.hexmap.service.HexMapService;
import javafx.concurrent.Task;
import ui.UiAsyncExecutor;

import java.util.List;
import java.util.function.Consumer;

/**
 * UI-naher Application-Service fuer Overworld-Workflows.
 * Kapselt Hintergrund-Tasks und delegiert Persistenzlogik an den HexMapService.
 */
public final class OverworldApplicationService {

    public record OverworldMapState(List<HexTile> tiles, Long partyTileId, Long defaultPartyTileId) {}

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
        task.setOnSucceeded(e -> onSuccess.accept(task.getValue()));
        task.setOnFailed(e -> onError.accept(task.getException()));
        UiAsyncExecutor.submit(task);
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
        task.setOnSucceeded(e -> onSuccess.run());
        task.setOnFailed(e -> onError.accept(task.getException()));
        UiAsyncExecutor.submit(task);
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
}
