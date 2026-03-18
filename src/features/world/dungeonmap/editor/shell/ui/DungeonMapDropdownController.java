package features.world.dungeonmap.editor.shell.ui;

import features.world.dungeonmap.catalog.model.DungeonMap;
import features.world.dungeonmap.catalog.application.DungeonMapCatalogService;
import javafx.scene.Node;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.Objects;

public final class DungeonMapDropdownController {

    private final DungeonMapCatalogService mapCatalogService;
    private final ReloadHandle reloadHandle;
    private final DungeonMapEditorDropdown mapDropdown = new DungeonMapEditorDropdown();

    public DungeonMapDropdownController(DungeonMapCatalogService mapCatalogService, ReloadHandle reloadHandle) {
        this.mapCatalogService = Objects.requireNonNull(mapCatalogService, "mapCatalogService");
        this.reloadHandle = Objects.requireNonNull(reloadHandle, "reloadHandle");
    }

    public void showCreate(Node anchor) {
        mapDropdown.showCreate(anchor, this::createMap);
    }

    public void showEdit(EditRequest request) {
        mapDropdown.showEdit(
                request.anchor(),
                request.map(),
                editRequest -> updateMap(editRequest.mapId(), editRequest.name()),
                () -> deleteMap(request.map()));
    }

    private void createMap(String name) {
        UiAsyncTasks.submit(() -> mapCatalogService.createMap(name), mapId -> reloadAfterChange(mapId), throwable -> {
            UiErrorReporter.reportBackgroundFailure("DungeonMapDropdownController.createMap()", throwable);
            mapDropdown.showError("Dungeon konnte nicht erstellt werden.");
        });
    }

    private void updateMap(Long mapId, String name) {
        if (mapId == null) {
            return;
        }
        UiAsyncTasks.submitVoid(() -> mapCatalogService.renameMap(mapId, name), () -> reloadAfterChange(mapId), throwable -> {
            UiErrorReporter.reportBackgroundFailure("DungeonMapDropdownController.updateMap()", throwable);
            mapDropdown.showError("Dungeon konnte nicht gespeichert werden.");
        });
    }

    private void deleteMap(DungeonMap map) {
        if (map == null || map.mapId() == null) {
            return;
        }
        long mapId = map.mapId();
        UiAsyncTasks.submitVoid(() -> mapCatalogService.deleteMap(mapId), () -> {
            Long preferredMapId = Objects.equals(mapId, reloadHandle.sessionMapId()) ? null : reloadHandle.sessionMapId();
            reloadAfterChange(preferredMapId);
        }, throwable -> {
            UiErrorReporter.reportBackgroundFailure("DungeonMapDropdownController.deleteMap()", throwable);
            mapDropdown.showError("Dungeon konnte nicht geloescht werden.");
        });
    }

    private void reloadAfterChange(Long preferredMapId) {
        reloadHandle.reloadAfterChange(preferredMapId, mapDropdown::hide);
    }

    public record EditRequest(DungeonMap map, Node anchor) {
    }

    public interface ReloadHandle {
        void reloadAfterChange(Long preferredMapId, Runnable afterReload);
        Long sessionMapId();
    }
}
