package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.model.DungeonFeatureCategory;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import features.world.dungeonmap.ui.editor.state.DungeonSelectionRestoreRequest;
import javafx.scene.Node;
import ui.async.UiErrorReporter;
import ui.components.ConfirmationDropdown;
import ui.components.TextInputDropdown;

import java.util.function.Consumer;

public final class DungeonEntityCrudController {

    private final DungeonEditorState state;
    private final DungeonEditorApplicationService applicationService;
    private final DungeonToolSettingsPane toolSettingsPane;
    private final ConfirmationDropdown confirmationDropdown = new ConfirmationDropdown();
    private final TextInputDropdown areaDropdown = new TextInputDropdown();
    private final TextInputDropdown featureDropdown = new TextInputDropdown();
    private Consumer<DungeonSelectionRestoreRequest> reloadCurrentMap = ignored -> { };

    public DungeonEntityCrudController(
            DungeonEditorState state,
            DungeonEditorApplicationService applicationService,
            DungeonToolSettingsPane toolSettingsPane
    ) {
        this.state = state;
        this.applicationService = applicationService;
        this.toolSettingsPane = toolSettingsPane;
    }

    public void setReloadCurrentMap(Consumer<DungeonSelectionRestoreRequest> reloadCurrentMap) {
        this.reloadCurrentMap = reloadCurrentMap == null ? ignored -> { } : reloadCurrentMap;
    }

    public void updateRoomMetadata(DungeonRoom room) {
        if (room == null || room.roomId() == null) {
            return;
        }
        applicationService.updateRoomMetadata(
                room.roomId(),
                room.name(),
                room.description(),
                () -> reloadCurrentMap.accept(DungeonSelectionRestoreRequest.room(room.roomId())),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEntityCrudController.updateRoomMetadata()", ex));
    }

    public void createArea(Node anchor) {
        if (state.currentMapId() == null) {
            return;
        }
        areaDropdown.show(anchor, "Bereich erstellen", "Name", "Neuer Bereich", "Erstellen", name -> {
            saveArea(new DungeonArea(
                    null,
                    state.currentMapId(),
                    name,
                    DungeonArea.DEFAULT_ENCOUNTER_EVERY_HOURS,
                    java.util.List.of()));
            areaDropdown.hide();
        });
    }

    public void saveArea(DungeonArea area) {
        applicationService.saveArea(
                area,
                areaId -> reloadCurrentMap.accept(DungeonSelectionRestoreRequest.area(areaId)),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEntityCrudController.saveArea()", ex));
    }

    public void deleteActiveArea(Node anchor) {
        Long areaId = selectedAreaIdForActions();
        if (areaId != null) {
            deleteArea(areaId, anchor);
        }
    }

    void deleteArea(Long areaId, Node anchor) {
        if (areaId == null) {
            return;
        }
        confirmDelete(
                anchor,
                "Bereich löschen",
                "Bereich '" + findAreaName(areaId) + "' löschen? Alle zugehörigen Räume werden automatisch neu zugeordnet.",
                () -> applicationService.deleteArea(
                        areaId,
                        () -> reloadCurrentMap.accept(null),
                        ex -> UiErrorReporter.reportBackgroundFailure("DungeonEntityCrudController.deleteArea()", ex)));
    }

    public void createFeature(Node anchor) {
        if (state.currentMapId() == null) {
            return;
        }
        DungeonFeatureCategory category = toolSettingsPane.getActiveFeatureCategory();
        featureDropdown.show(anchor, "Feature erstellen", "Name", category.label(), "Erstellen", name -> {
            saveFeature(new DungeonFeature(
                    null,
                    state.currentMapId(),
                    category,
                    null,
                    name,
                    ""));
            featureDropdown.hide();
        });
    }

    public void saveFeature(DungeonFeature feature) {
        applicationService.saveFeature(
                feature,
                featureId -> {
                    reloadCurrentMap.accept(DungeonSelectionRestoreRequest.feature(featureId));
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEntityCrudController.saveFeature()", ex));
    }

    public void deleteActiveFeature(Node anchor) {
        Long featureId = selectedFeatureIdForActions();
        if (featureId != null) {
            deleteFeature(featureId, anchor);
        }
    }

    void deleteFeature(Long featureId, Node anchor) {
        if (featureId == null) {
            return;
        }
        confirmDelete(
                anchor,
                "Feature löschen",
                "Feature '" + findFeatureName(featureId) + "' löschen? Die gesamte Flächenzuordnung wird entfernt.",
                () -> applicationService.deleteFeature(
                        featureId,
                        () -> reloadCurrentMap.accept(null),
                        ex -> UiErrorReporter.reportBackgroundFailure("DungeonEntityCrudController.deleteFeature()", ex)));
    }

    public void addSelectedSquareToActiveFeature() {
        DungeonSquare square = selectedSquare();
        Long featureId = selectedFeatureIdForActions();
        if (square == null || square.squareId() == null || featureId == null) {
            return;
        }
        applicationService.addSquareToFeature(
                featureId,
                square.squareId(),
                () -> reloadCurrentMap.accept(DungeonSelectionRestoreRequest.feature(featureId)),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEntityCrudController.addSelectedSquareToActiveFeature()", ex));
    }

    public void removeSelectedSquareFromActiveFeature() {
        DungeonSquare square = selectedSquare();
        Long featureId = selectedFeatureIdForActions();
        if (square == null || square.squareId() == null || featureId == null) {
            return;
        }
        applicationService.removeSquareFromFeature(
                featureId,
                square.squareId(),
                () -> reloadCurrentMap.accept(DungeonSelectionRestoreRequest.feature(featureId)),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEntityCrudController.removeSelectedSquareFromActiveFeature()", ex));
    }

    public void assignRoomToArea(DungeonSquare square) {
        Long areaId = toolSettingsPane.getActiveAreaId();
        if (square == null || square.roomId() == null || areaId == null) {
            return;
        }
        applicationService.assignRoomArea(
                square.roomId(),
                areaId,
                () -> reloadCurrentMap.accept(DungeonSelectionRestoreRequest.room(square.roomId())),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEntityCrudController.assignRoomToArea()", ex));
    }

    DungeonFeature findFeature(Long featureId) {
        if (state.currentState() == null || featureId == null) {
            return null;
        }
        for (DungeonFeature feature : state.currentState().features()) {
            if (featureId.equals(feature.featureId())) {
                return feature;
            }
        }
        return null;
    }

    private void confirmDelete(Node anchor, String title, String message, Runnable onConfirm) {
        confirmationDropdown.show(anchor, title, message, "Löschen", () -> {
            confirmationDropdown.hide();
            onConfirm.run();
        });
    }

    private DungeonSquare selectedSquare() {
        return state.currentSelection() == null ? null : state.currentSelection().square();
    }

    private Long selectedAreaIdForActions() {
        if (state.currentSelection() != null && state.currentSelection().type() == DungeonSelection.SelectionType.AREA) {
            return state.currentSelection().area() == null ? null : state.currentSelection().area().areaId();
        }
        return toolSettingsPane.getActiveAreaId();
    }

    private Long selectedFeatureIdForActions() {
        if (state.currentSelection() != null && state.currentSelection().type() == DungeonSelection.SelectionType.FEATURE) {
            return state.currentSelection().feature() == null ? null : state.currentSelection().feature().featureId();
        }
        return toolSettingsPane.getActiveFeatureId();
    }
    private String findAreaName(Long areaId) {
        if (state.currentState() != null) {
            for (DungeonArea area : state.currentState().areas()) {
                if (areaId.equals(area.areaId())) {
                    return area.name();
                }
            }
        }
        return "#" + areaId;
    }

    private String findFeatureName(Long featureId) {
        DungeonFeature feature = findFeature(featureId);
        return feature == null ? "Feature" : feature.toString();
    }
}
