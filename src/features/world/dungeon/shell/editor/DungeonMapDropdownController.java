package features.world.dungeon.shell.editor;

import features.world.dungeon.catalog.application.DungeonMapCatalogEntry;
import features.world.dungeon.catalog.application.DungeonMapCatalogService;
import features.world.dungeon.dungoenmap.application.DungeonMapLoadingService;
import features.world.dungeon.dungoenmap.state.DungeonMapState;
import javafx.scene.Node;
import ui.async.UiErrorReporter;

import java.util.Objects;

public final class DungeonMapDropdownController {

    private final DungeonMapCatalogService mapCatalogService;
    private final DungeonMapLoadingService loadingService;
    private final DungeonMapState mapState;
    private final DungeonMapEditorDropdown mapDropdown = new DungeonMapEditorDropdown();

    public DungeonMapDropdownController(
            DungeonMapCatalogService mapCatalogService,
            DungeonMapLoadingService loadingService,
            DungeonMapState mapState
    ) {
        this.mapCatalogService = Objects.requireNonNull(mapCatalogService, "mapCatalogService");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.mapState = Objects.requireNonNull(mapState, "mapState");
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
        loadingService.submitMutation(
                () -> mapCatalogService.createMap(name),
                mapId -> mapId,
                ignored -> mapDropdown.hide(),
                throwable -> {
                    UiErrorReporter.reportBackgroundFailure("DungeonMapDropdownController.createMap()", throwable);
                    mapDropdown.showError(failureMessage("Dungeon konnte nicht erstellt werden", throwable));
                });
    }

    private void updateMap(Long mapId, String name) {
        if (mapId == null) {
            return;
        }
        mapDropdown.setBusy(true);
        loadingService.submitMutation(
                () -> {
                    mapCatalogService.renameMap(mapId, name);
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> mapDropdown.hide(),
                throwable -> {
                    UiErrorReporter.reportBackgroundFailure("DungeonMapDropdownController.updateMap()", throwable);
                    mapDropdown.showError(failureMessage("Dungeon konnte nicht gespeichert werden", throwable));
                });
    }

    private void deleteMap(DungeonMapCatalogEntry map) {
        if (map == null) {
            return;
        }
        long mapId = map.mapId();
        mapDropdown.setBusy(true);
        Long activeMapId = mapState.activeMapId();
        Long preferredMapId = Objects.equals(mapId, activeMapId) ? null : activeMapId;
        loadingService.submitMutation(
                () -> {
                    mapCatalogService.deleteMap(mapId);
                    return preferredMapId;
                },
                nextMapId -> nextMapId,
                ignored -> mapDropdown.hide(),
                throwable -> {
                    UiErrorReporter.reportBackgroundFailure("DungeonMapDropdownController.deleteMap()", throwable);
                    mapDropdown.showError(failureMessage("Dungeon konnte nicht geloescht werden", throwable));
                });
    }

    // Dropdown mutation errors should surface the deepest available cause because workflow wrappers
    // otherwise hide the actionable failure behind generic "konnte nicht ..." summaries.
    private static String failureMessage(String summary, Throwable throwable) {
        String detail = deepestFailureDetail(throwable);
        if (detail == null) {
            return summary + ".";
        }
        return summary + ": " + detail;
    }

    private static String deepestFailureDetail(Throwable throwable) {
        String detail = null;
        for (Throwable cause = throwable; cause != null; cause = cause.getCause()) {
            String message = normalizedMessage(cause.getMessage());
            if (message != null) {
                detail = message;
            }
        }
        if (detail != null) {
            return detail;
        }
        if (throwable == null) {
            return null;
        }
        String type = normalizedMessage(throwable.getClass().getSimpleName());
        return type == null ? null : type;
    }

    private static String normalizedMessage(String message) {
        if (message == null) {
            return null;
        }
        String normalized = message
                .replace('\r', ' ')
                .replace('\n', ' ')
                .strip();
        return normalized.isBlank() ? null : normalized;
    }

    public record EditRequest(DungeonMapCatalogEntry map, Node anchor) {
    }
}
