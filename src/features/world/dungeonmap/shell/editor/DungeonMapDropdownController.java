package features.world.dungeonmap.shell.editor;

import features.world.dungeonmap.catalog.application.DungeonMapCatalogService;
import features.world.dungeonmap.loading.DungeonMapCatalogEntry;
import javafx.scene.Node;
import ui.async.UiErrorReporter;
import ui.async.UiAsyncTasks;

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
        mapDropdown.setBusy(true);
        UiAsyncTasks.submit(
                () -> mapCatalogService.createMap(name),
                this::reloadAfterChange,
                throwable -> {
                    UiErrorReporter.reportBackgroundFailure("DungeonMapDropdownController.createMap()", throwable);
                    mapDropdown.showError("Dungeon konnte nicht erstellt werden.");
                });
    }

    private void updateMap(Long mapId, String name) {
        if (mapId == null) {
            return;
        }
        mapDropdown.setBusy(true);
        UiAsyncTasks.submitVoid(
                () -> mapCatalogService.renameMap(mapId, name),
                () -> reloadAfterChange(mapId),
                throwable -> {
                    UiErrorReporter.reportBackgroundFailure("DungeonMapDropdownController.updateMap()", throwable);
                    mapDropdown.showError("Dungeon konnte nicht gespeichert werden.");
                });
    }

    private void deleteMap(DungeonMapCatalogEntry map) {
        if (map == null) {
            return;
        }
        long mapId = map.mapId();
        mapDropdown.setBusy(true);
        UiAsyncTasks.submitVoid(
                () -> mapCatalogService.deleteMap(mapId),
                () -> {
                    Long preferredMapId = Objects.equals(mapId, reloadHandle.sessionMapId()) ? null : reloadHandle.sessionMapId();
                    reloadAfterChange(preferredMapId);
                },
                throwable -> {
                    UiErrorReporter.reportBackgroundFailure("DungeonMapDropdownController.deleteMap()", throwable);
                    mapDropdown.showError("Dungeon konnte nicht geloescht werden.");
                });
    }

    private void reloadAfterChange(Long preferredMapId) {
        reloadHandle.reload(preferredMapId);
        mapDropdown.hide();
    }

    public record EditRequest(DungeonMapCatalogEntry map, Node anchor) {
    }

    public interface ReloadHandle {
        void reload(Long preferredMapId);
        Long sessionMapId();
    }
}
