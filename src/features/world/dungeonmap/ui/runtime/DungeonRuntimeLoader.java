package features.world.dungeonmap.ui.runtime;

import features.world.dungeonmap.ui.shared.selection.DungeonSelection;
import features.world.dungeonmap.service.DungeonMapQueryService;
import features.world.dungeonmap.service.runtime.DungeonRuntimeQueryService;
import features.world.dungeonmap.ui.runtime.chrome.controls.DungeonViewControls;
import features.world.dungeonmap.ui.runtime.chrome.state.DungeonRuntimeStatePane;
import features.world.dungeonmap.ui.shared.async.DungeonUiAsyncSupport;
import features.world.dungeonmap.ui.shared.canvas.DungeonMapPane;
import ui.async.UiErrorReporter;

public final class DungeonRuntimeLoader {

    private final DungeonRuntimeViewState state;
    private final DungeonViewControls controls;
    private final DungeonRuntimeStatePane statePane;
    private final DungeonMapPane canvas;
    private final DungeonMapQueryService queries;
    private final DungeonRuntimeQueryService runtimeQueries;

    public DungeonRuntimeLoader(
            DungeonRuntimeViewState state,
            DungeonViewControls controls,
            DungeonRuntimeStatePane statePane,
            DungeonMapPane canvas,
            DungeonMapQueryService queries,
            DungeonRuntimeQueryService runtimeQueries
    ) {
        this.state = state;
        this.controls = controls;
        this.statePane = statePane;
        this.canvas = canvas;
        this.queries = queries;
        this.runtimeQueries = runtimeQueries;
    }

    public void onShow(Runnable afterLoad) {
        DungeonUiAsyncSupport.submitValue(
                queries::getAllMaps,
                maps -> controls.setMaps(maps, state.selectedMapId()),
                ex -> {
                    canvas.showLoadError("Dungeonliste konnte nicht geladen werden");
                    UiErrorReporter.reportBackgroundFailure("DungeonRuntimeLoader.loadMapList()", ex);
                });
        loadMap(null, afterLoad);
    }

    public void handleMapSelected(Long mapId, Runnable afterLoad) {
        state.setRuntimeStatusMessage(null);
        loadMap(mapId, afterLoad);
    }

    public void reloadCurrentMap(Runnable afterLoad) {
        loadMap(state.currentMapId(), afterLoad);
    }

    private void loadMap(Long mapId, Runnable afterLoad) {
        long requestToken = state.beginLoad(mapId);
        DungeonUiAsyncSupport.submitValue(
                () -> runtimeQueries.loadRuntimeState(mapId),
                runtimeState -> {
                    if (!state.isCurrentLoad(requestToken)) {
                        return;
                    }
                    state.applyRuntimeState(runtimeState);
                    if (state.currentState() == null) {
                        canvas.showEmptyState();
                        canvas.setPartyEndpoint(null);
                        canvas.setPartySquare(null);
                        controls.selectMap(null);
                        statePane.showLocation(null, null, null, null, null);
                        return;
                    }
                    controls.selectMap(state.selectedMapId());
                    canvas.loadState(state.currentState());
                    canvas.setSelectedSelection(DungeonSelection.none());
                    afterLoad.run();
                },
                ex -> handleLoadFailure(requestToken, mapId, ex));
    }

    private void handleLoadFailure(long requestToken, Long mapId, Throwable throwable) {
        if (!state.isCurrentLoad(requestToken)) {
            return;
        }
        state.applyLoadFailure(mapId);
        canvas.showLoadError("Dungeon konnte nicht geladen werden");
        canvas.setPartyEndpoint(null);
        canvas.setPartySquare(null);
        statePane.showLocation(null, null, null, null, state.runtimeStatusMessage());
        UiErrorReporter.reportBackgroundFailure("DungeonRuntimeLoader.loadMap()", throwable);
    }
}
