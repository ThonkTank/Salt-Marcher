package features.world.dungeon.shell.editor.state;

import features.world.dungeon.catalog.application.DungeonMapCatalogEntry;
import features.world.dungeon.catalog.application.DungeonMapCatalogService;
import features.world.dungeon.dungeonmap.DungeonMapObject;
import features.world.dungeon.dungeonmap.input.SubmitMutationInput;
import features.world.dungeon.dungeonmap.state.DungeonMapState;
import javafx.scene.Node;
import ui.async.UiErrorReporter;

import java.util.Objects;

@SuppressWarnings("unused")
public final class DungeonMapDropdownController {

    private final DungeonMapCatalogService mapCatalogService;
    private final DungeonMapObject mapObject;
    private final DungeonMapState mapState;
    private final DungeonMapEditorDropdown mapDropdown = new DungeonMapEditorDropdown();

    public DungeonMapDropdownController(
            DungeonMapCatalogService mapCatalogService,
            DungeonMapObject mapObject,
            DungeonMapState mapState
    ) {
        this.mapCatalogService = Objects.requireNonNull(mapCatalogService, "mapCatalogService");
        this.mapObject = Objects.requireNonNull(mapObject, "mapObject");
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
        mapObject.submitMutation(new SubmitMutationInput<>(
                () -> mapCatalogService.createMap(name),
                mapId -> mapId,
                ignored -> mapDropdown.hide(),
                throwable -> {
                    UiErrorReporter.reportBackgroundFailure("DungeonMapDropdownController.createMap()", throwable);
                    mapDropdown.showError(failureMessage("Dungeon konnte nicht erstellt werden", throwable));
                }));
    }

    private void updateMap(Long mapId, String name) {
        if (mapId == null) {
            return;
        }
        mapDropdown.setBusy(true);
        mapObject.submitMutation(new SubmitMutationInput<>(
                () -> {
                    mapCatalogService.renameMap(mapId, name);
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> mapDropdown.hide(),
                throwable -> {
                    UiErrorReporter.reportBackgroundFailure("DungeonMapDropdownController.updateMap()", throwable);
                    mapDropdown.showError(failureMessage("Dungeon konnte nicht gespeichert werden", throwable));
                }));
    }

    private void deleteMap(DungeonMapCatalogEntry map) {
        if (map == null) {
            return;
        }
        long mapId = map.mapId();
        mapDropdown.setBusy(true);
        Long activeMapId = mapState.activeMapId();
        Long preferredMapId = Objects.equals(mapId, activeMapId) ? null : activeMapId;
        mapObject.submitMutation(new SubmitMutationInput<>(
                () -> {
                    mapCatalogService.deleteMap(mapId);
                    return preferredMapId;
                },
                nextMapId -> nextMapId,
                ignored -> mapDropdown.hide(),
                throwable -> {
                    UiErrorReporter.reportBackgroundFailure("DungeonMapDropdownController.deleteMap()", throwable);
                    mapDropdown.showError(failureMessage("Dungeon konnte nicht geloescht werden", throwable));
                }));
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
        if (throwable == null) {
            return null;
        }
        String causeDetail = deepestFailureDetail(throwable.getCause());
        if (causeDetail != null) {
            return causeDetail;
        }
        String message = normalizedMessage(throwable.getMessage());
        if (message != null) {
            return message;
        }
        return normalizedMessage(throwable.getClass().getSimpleName());
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
