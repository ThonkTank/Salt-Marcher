package features.world.dungeonmap.shell.editor;

import features.world.dungeonmap.catalog.application.DungeonMapCatalogService;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.loading.DungeonMapCatalogEntry;
import javafx.scene.Node;
import ui.async.UiErrorReporter;

import java.util.Objects;

public final class DungeonMapDropdownController {

    private final DungeonMapCatalogService mapCatalogService;
    private final DungeonMapLoadingService loadingService;
    private final ReloadHandle reloadHandle;
    private final DungeonMapEditorDropdown mapDropdown = new DungeonMapEditorDropdown();

    public DungeonMapDropdownController(
            DungeonMapCatalogService mapCatalogService,
            DungeonMapLoadingService loadingService,
            ReloadHandle reloadHandle
    ) {
        this.mapCatalogService = Objects.requireNonNull(mapCatalogService, "mapCatalogService");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
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
        loadingService.submitReloadingTask(
                () -> mapCatalogService.createMap(name),
                mapId -> mapId,
                ignored -> mapDropdown.hide(),
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
        loadingService.submitReloadingWrite(
                () -> mapCatalogService.renameMap(mapId, name),
                mapId,
                mapDropdown::hide,
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
        Long preferredMapId = Objects.equals(mapId, reloadHandle.sessionMapId()) ? null : reloadHandle.sessionMapId();
        loadingService.submitReloadingWrite(
                () -> mapCatalogService.deleteMap(mapId),
                preferredMapId,
                mapDropdown::hide,
                throwable -> {
                    UiErrorReporter.reportBackgroundFailure("DungeonMapDropdownController.deleteMap()", throwable);
                    mapDropdown.showError("Dungeon konnte nicht geloescht werden.");
                });
    }

    public record EditRequest(DungeonMapCatalogEntry map, Node anchor) {
    }

    public interface ReloadHandle {
        Long sessionMapId();
    }
}
