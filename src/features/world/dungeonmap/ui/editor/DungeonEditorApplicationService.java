package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonLinkAnchor;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.model.DungeonWallEdit;
import features.world.dungeonmap.service.DungeonLinkCreateResult;
import features.world.dungeonmap.service.DungeonLinkCreateStatus;
import features.world.dungeonmap.service.DungeonMapEditorService;
import features.world.dungeonmap.service.DungeonMapQueryService;
import features.world.dungeonmap.service.catalog.DungeonEncounterCatalogAdapter;
import features.world.dungeonmap.service.catalog.DungeonEncounterSummary;
import features.world.dungeonmap.service.catalog.DungeonEncounterTableCatalogAdapter;
import features.world.dungeonmap.service.catalog.DungeonEncounterTableSummary;
import features.world.dungeonmap.ui.DungeonUiAsyncSupport;

import java.util.List;
import java.util.function.Consumer;

public final class DungeonEditorApplicationService {

    public void loadMapList(Consumer<List<DungeonMap>> onSuccess, Consumer<Throwable> onError) {
        DungeonUiAsyncSupport.submitValue(DungeonMapQueryService::getAllMaps, onSuccess, onError);
    }

    public void loadEncounterTables(Consumer<List<DungeonEncounterTableSummary>> onSuccess, Consumer<Throwable> onError) {
        DungeonUiAsyncSupport.submitValue(DungeonEncounterTableCatalogAdapter::loadSummaries, onSuccess, onError);
    }

    public void loadStoredEncounters(Consumer<List<DungeonEncounterSummary>> onSuccess, Consumer<Throwable> onError) {
        DungeonUiAsyncSupport.submitValue(DungeonEncounterCatalogAdapter::loadSummaries, onSuccess, onError);
    }

    public void loadMap(long mapId, Consumer<DungeonMapState> onSuccess, Consumer<Throwable> onError) {
        DungeonUiAsyncSupport.submitValue(() -> DungeonMapQueryService.loadMapState(mapId), onSuccess, onError);
    }

    public void createMap(String name, int width, int height, Consumer<Long> onSuccess, Consumer<Throwable> onError) {
        DungeonUiAsyncSupport.submitValue(() -> DungeonMapEditorService.createMap(name, width, height), onSuccess, onError);
    }

    public void updateMap(long mapId, String name, int width, int height, Runnable onSuccess, Consumer<Throwable> onError) {
        DungeonUiAsyncSupport.submitAction(() -> DungeonMapEditorService.updateMap(mapId, name, width, height), onSuccess, onError);
    }

    public void deleteMap(long mapId, Runnable onSuccess, Consumer<Throwable> onError) {
        DungeonUiAsyncSupport.submitAction(() -> DungeonMapEditorService.deleteMap(mapId), onSuccess, onError);
    }

    public void applySquareEdits(
            long mapId,
            List<DungeonSquarePaint> edits,
            Runnable onSuccess,
            Consumer<Throwable> onError
    ) {
        DungeonUiAsyncSupport.submitAction(() -> DungeonMapEditorService.applySquareEditsAndReconcileState(mapId, edits), onSuccess, onError);
    }

    public void updateRoomMetadata(long roomId, String name, String description, Runnable onSuccess, Consumer<Throwable> onError) {
        DungeonUiAsyncSupport.submitAction(() -> DungeonMapEditorService.updateRoomMetadata(roomId, name, description), onSuccess, onError);
    }

    public void saveArea(DungeonArea area, Consumer<Long> onSuccess, Consumer<Throwable> onError) {
        DungeonUiAsyncSupport.submitValue(() -> DungeonMapEditorService.saveArea(area), onSuccess, onError);
    }

    public void deleteArea(long areaId, Runnable onSuccess, Consumer<Throwable> onError) {
        DungeonUiAsyncSupport.submitAction(() -> DungeonMapEditorService.deleteArea(areaId), onSuccess, onError);
    }

    public void saveFeature(DungeonFeature feature, Consumer<Long> onSuccess, Consumer<Throwable> onError) {
        DungeonUiAsyncSupport.submitValue(() -> DungeonMapEditorService.saveFeature(feature), onSuccess, onError);
    }

    public void deleteFeature(long featureId, Runnable onSuccess, Consumer<Throwable> onError) {
        DungeonUiAsyncSupport.submitAction(() -> DungeonMapEditorService.deleteFeature(featureId), onSuccess, onError);
    }

    public void addSquareToFeature(long featureId, long squareId, Runnable onSuccess, Consumer<Throwable> onError) {
        DungeonUiAsyncSupport.submitAction(() -> DungeonMapEditorService.addSquareToFeature(featureId, squareId), onSuccess, onError);
    }

    public void removeSquareFromFeature(long featureId, long squareId, Runnable onSuccess, Consumer<Throwable> onError) {
        DungeonUiAsyncSupport.submitAction(() -> DungeonMapEditorService.removeSquareFromFeature(featureId, squareId), onSuccess, onError);
    }

    public void assignRoomArea(long roomId, long areaId, Runnable onSuccess, Consumer<Throwable> onError) {
        DungeonUiAsyncSupport.submitAction(() -> DungeonMapEditorService.assignRoomArea(roomId, areaId), onSuccess, onError);
    }

    public void saveEndpoint(DungeonEndpoint endpoint, Consumer<Long> onSuccess, Consumer<Throwable> onError) {
        DungeonUiAsyncSupport.submitValue(() -> DungeonMapEditorService.saveEndpoint(endpoint), onSuccess, onError);
    }

    public void deleteEndpoint(long endpointId, Runnable onSuccess, Consumer<Throwable> onError) {
        DungeonUiAsyncSupport.submitAction(() -> DungeonMapEditorService.deleteEndpoint(endpointId), onSuccess, onError);
    }

    public void createLink(
            long mapId,
            DungeonLinkAnchor fromAnchor,
            DungeonLinkAnchor toAnchor,
            Consumer<features.world.dungeonmap.ui.DungeonLinkCreateResult> onSuccess,
            Consumer<Throwable> onError
    ) {
        DungeonUiAsyncSupport.submitValue(
                () -> toDungeonLinkCreateResult(DungeonMapEditorService.createLink(mapId, fromAnchor, toAnchor, "")),
                onSuccess,
                onError);
    }

    public void deleteLink(long linkId, Runnable onSuccess, Consumer<Throwable> onError) {
        DungeonUiAsyncSupport.submitAction(() -> DungeonMapEditorService.deleteLink(linkId), onSuccess, onError);
    }

    public void updateLinkLabel(long linkId, String label, Runnable onSuccess, Consumer<Throwable> onError) {
        DungeonUiAsyncSupport.submitAction(() -> DungeonMapEditorService.updateLinkLabel(linkId, label), onSuccess, onError);
    }

    public void savePassage(DungeonPassage passage, Consumer<Long> onSuccess, Consumer<Throwable> onError) {
        DungeonUiAsyncSupport.submitValue(() -> DungeonMapEditorService.savePassage(passage), onSuccess, onError);
    }

    public void deletePassage(long passageId, Runnable onSuccess, Consumer<Throwable> onError) {
        DungeonUiAsyncSupport.submitAction(() -> DungeonMapEditorService.deletePassage(passageId), onSuccess, onError);
    }

    public void applyWallEdits(
            long mapId,
            List<DungeonWallEdit> edits,
            Runnable onSuccess,
            Consumer<Throwable> onError
    ) {
        DungeonUiAsyncSupport.submitAction(() -> DungeonMapEditorService.applyWallEdits(mapId, edits), onSuccess, onError);
    }

    private features.world.dungeonmap.ui.DungeonLinkCreateResult toDungeonLinkCreateResult(DungeonLinkCreateResult result) {
        if (result == null) {
            return null;
        }
        return new features.world.dungeonmap.ui.DungeonLinkCreateResult(
                switch (result.status()) {
                    case CREATED -> features.world.dungeonmap.ui.DungeonLinkCreateStatus.CREATED;
                    case SAME_ANCHOR -> features.world.dungeonmap.ui.DungeonLinkCreateStatus.SAME_ANCHOR;
                    case DUPLICATE -> features.world.dungeonmap.ui.DungeonLinkCreateStatus.DUPLICATE;
                    case INVALID_ANCHOR -> features.world.dungeonmap.ui.DungeonLinkCreateStatus.INVALID_ANCHOR;
                },
                result.linkId());
    }
}
