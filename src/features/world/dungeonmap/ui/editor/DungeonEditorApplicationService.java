package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.api.DungeonEncounterTableSummary;
import features.world.dungeonmap.api.DungeonEncounterSummary;
import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.model.DungeonWallEdit;
import features.world.dungeonmap.service.DungeonMapEditorService;
import features.world.dungeonmap.service.DungeonMapQueryService;
import features.world.dungeonmap.service.adapter.DungeonEncounterCatalogAdapter;
import features.world.dungeonmap.service.adapter.DungeonEncounterTableCatalogAdapter;
import javafx.concurrent.Task;
import ui.async.UiAsyncTasks;

import java.util.List;
import java.util.concurrent.Callable;
import java.util.function.Consumer;

public final class DungeonEditorApplicationService {

    public void loadMapList(Consumer<List<DungeonMap>> onSuccess, Consumer<Throwable> onError) {
        submitValue(DungeonMapQueryService::getAllMaps, onSuccess, onError);
    }

    public void loadEncounterTables(Consumer<List<DungeonEncounterTableSummary>> onSuccess, Consumer<Throwable> onError) {
        submitValue(DungeonEncounterTableCatalogAdapter::loadSummaries, onSuccess, onError);
    }

    public void loadStoredEncounters(Consumer<List<DungeonEncounterSummary>> onSuccess, Consumer<Throwable> onError) {
        submitValue(DungeonEncounterCatalogAdapter::loadSummaries, onSuccess, onError);
    }

    public void loadMap(long mapId, Consumer<DungeonMapState> onSuccess, Consumer<Throwable> onError) {
        submitValue(() -> DungeonMapQueryService.loadMapState(mapId), onSuccess, onError);
    }

    public void createMap(String name, int width, int height, Consumer<Long> onSuccess, Consumer<Throwable> onError) {
        submitValue(() -> DungeonMapEditorService.createMap(name, width, height), onSuccess, onError);
    }

    public void updateMap(long mapId, String name, int width, int height, Runnable onSuccess, Consumer<Throwable> onError) {
        submitAction(() -> DungeonMapEditorService.updateMap(mapId, name, width, height), onSuccess, onError);
    }

    public void deleteMap(long mapId, Runnable onSuccess, Consumer<Throwable> onError) {
        submitAction(() -> DungeonMapEditorService.deleteMap(mapId), onSuccess, onError);
    }

    public void applySquareEdits(long mapId, List<DungeonSquarePaint> edits, Runnable onSuccess, Consumer<Throwable> onError) {
        submitAction(() -> DungeonMapEditorService.applySquareEditsAndReconcileState(mapId, edits), onSuccess, onError);
    }

    public void saveRoom(DungeonRoom room, Consumer<Long> onSuccess, Consumer<Throwable> onError) {
        submitValue(() -> DungeonMapEditorService.saveRoom(room), onSuccess, onError);
    }

    public void deleteRoom(long roomId, Runnable onSuccess, Consumer<Throwable> onError) {
        submitAction(() -> DungeonMapEditorService.deleteRoom(roomId), onSuccess, onError);
    }

    public void saveArea(DungeonArea area, Consumer<Long> onSuccess, Consumer<Throwable> onError) {
        submitValue(() -> DungeonMapEditorService.saveArea(area), onSuccess, onError);
    }

    public void deleteArea(long areaId, Runnable onSuccess, Consumer<Throwable> onError) {
        submitAction(() -> DungeonMapEditorService.deleteArea(areaId), onSuccess, onError);
    }

    public void saveFeature(DungeonFeature feature, Consumer<Long> onSuccess, Consumer<Throwable> onError) {
        submitValue(() -> DungeonMapEditorService.saveFeature(feature), onSuccess, onError);
    }

    public void deleteFeature(long featureId, Runnable onSuccess, Consumer<Throwable> onError) {
        submitAction(() -> DungeonMapEditorService.deleteFeature(featureId), onSuccess, onError);
    }

    public void addSquareToFeature(long featureId, long squareId, Runnable onSuccess, Consumer<Throwable> onError) {
        submitAction(() -> DungeonMapEditorService.addSquareToFeature(featureId, squareId), onSuccess, onError);
    }

    public void removeSquareFromFeature(long featureId, long squareId, Runnable onSuccess, Consumer<Throwable> onError) {
        submitAction(() -> DungeonMapEditorService.removeSquareFromFeature(featureId, squareId), onSuccess, onError);
    }

    public void assignRoomArea(long roomId, Long areaId, Runnable onSuccess, Consumer<Throwable> onError) {
        submitAction(() -> DungeonMapEditorService.assignRoomArea(roomId, areaId), onSuccess, onError);
    }

    public void saveEndpoint(DungeonEndpoint endpoint, Consumer<Long> onSuccess, Consumer<Throwable> onError) {
        submitValue(() -> DungeonMapEditorService.saveEndpoint(endpoint), onSuccess, onError);
    }

    public void deleteEndpoint(long endpointId, Runnable onSuccess, Consumer<Throwable> onError) {
        submitAction(() -> DungeonMapEditorService.deleteEndpoint(endpointId), onSuccess, onError);
    }

    public void createLink(
            long mapId,
            long fromEndpointId,
            long toEndpointId,
            Consumer<DungeonMapEditorService.LinkCreateResult> onSuccess,
            Consumer<Throwable> onError
    ) {
        submitValue(() -> DungeonMapEditorService.createLink(mapId, fromEndpointId, toEndpointId, ""), onSuccess, onError);
    }

    public void deleteLink(long linkId, Runnable onSuccess, Consumer<Throwable> onError) {
        submitAction(() -> DungeonMapEditorService.deleteLink(linkId), onSuccess, onError);
    }

    public void updateLinkLabel(long linkId, String label, Runnable onSuccess, Consumer<Throwable> onError) {
        submitAction(() -> DungeonMapEditorService.updateLinkLabel(linkId, label), onSuccess, onError);
    }

    public void savePassage(DungeonPassage passage, Consumer<Long> onSuccess, Consumer<Throwable> onError) {
        submitValue(() -> DungeonMapEditorService.savePassage(passage), onSuccess, onError);
    }

    public void deletePassage(long passageId, Runnable onSuccess, Consumer<Throwable> onError) {
        submitAction(() -> DungeonMapEditorService.deletePassage(passageId), onSuccess, onError);
    }

    public void applyWallEdits(long mapId, List<DungeonWallEdit> edits, Runnable onSuccess, Consumer<Throwable> onError) {
        submitAction(() -> DungeonMapEditorService.applyWallEdits(mapId, edits), onSuccess, onError);
    }

    private <T> void submitValue(Callable<T> action, Consumer<T> onSuccess, Consumer<Throwable> onError) {
        Task<T> task = new Task<>() {
            @Override
            protected T call() throws Exception {
                return action.call();
            }
        };
        UiAsyncTasks.submit(task, onSuccess, onError);
    }

    private void submitAction(ThrowingRunnable action, Runnable onSuccess, Consumer<Throwable> onError) {
        Task<Void> task = new Task<>() {
            @Override
            protected Void call() throws Exception {
                action.run();
                return null;
            }
        };
        UiAsyncTasks.submit(task, ignored -> onSuccess.run(), onError);
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }
}
