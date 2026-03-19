package features.world.quarantine.dungeonmap.editor.shell;

import features.world.quarantine.dungeonmap.catalog.model.DungeonMap;
import features.world.quarantine.dungeonmap.catalog.application.DungeonMapCatalogService;
import features.world.quarantine.dungeonmap.foundation.async.DungeonAsyncRunner;
import ui.async.UiErrorReporter;
import javafx.scene.Node;

import java.util.Objects;

public final class DungeonMapDropdownController {

    private final DungeonMapCatalogService mapCatalogService;
    private final ReloadHandle reloadHandle;
    private final DungeonAsyncRunner asyncRunner;
    private final DungeonMapEditorDropdown mapDropdown = new DungeonMapEditorDropdown();

    public DungeonMapDropdownController(DungeonMapCatalogService mapCatalogService, ReloadHandle reloadHandle, DungeonAsyncRunner asyncRunner) {
        this.mapCatalogService = Objects.requireNonNull(mapCatalogService, "mapCatalogService");
        this.reloadHandle = Objects.requireNonNull(reloadHandle, "reloadHandle");
        this.asyncRunner = Objects.requireNonNull(asyncRunner, "asyncRunner");
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
        asyncRunner.submit(
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
        asyncRunner.submit(
                () -> { mapCatalogService.renameMap(mapId, name); return null; },
                ignored -> reloadAfterChange(mapId),
                throwable -> {
                    UiErrorReporter.reportBackgroundFailure("DungeonMapDropdownController.updateMap()", throwable);
                    mapDropdown.showError("Dungeon konnte nicht gespeichert werden.");
                });
    }

    private void deleteMap(DungeonMap map) {
        if (map == null || map.mapId() == null) {
            return;
        }
        long mapId = map.mapId();
        asyncRunner.submit(
                () -> { mapCatalogService.deleteMap(mapId); return null; },
                ignored -> {
                    Long preferredMapId = Objects.equals(mapId, reloadHandle.sessionMapId()) ? null : reloadHandle.sessionMapId();
                    reloadAfterChange(preferredMapId);
                },
                throwable -> {
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
