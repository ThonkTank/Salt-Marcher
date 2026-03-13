package features.world.dungeonmap.ui.editor.workflow;

import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.model.DungeonFeatureCategory;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.service.DungeonMapEditorService;
import features.world.dungeonmap.ui.DungeonUiAsyncSupport;
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
    private final DungeonToolSettingsPane toolSettingsPane;
    private final DungeonSelectionWorkflowController selectionController;
    private final DungeonWorkflowMessageController workflowMessageController;
    private final ConfirmationDropdown confirmationDropdown = new ConfirmationDropdown();
    private final TextInputDropdown areaDropdown = new TextInputDropdown();
    private final TextInputDropdown featureDropdown = new TextInputDropdown();
    private Consumer<DungeonSelectionRestoreRequest> reloadCurrentMap = ignored -> { };

    public DungeonEntityCrudController(
            DungeonEditorState state,
            DungeonToolSettingsPane toolSettingsPane,
            DungeonSelectionWorkflowController selectionController,
            DungeonWorkflowMessageController workflowMessageController
    ) {
        this.state = state;
        this.toolSettingsPane = toolSettingsPane;
        this.selectionController = selectionController;
        this.workflowMessageController = workflowMessageController;
    }

    public void setReloadCurrentMap(Consumer<DungeonSelectionRestoreRequest> reloadCurrentMap) {
        this.reloadCurrentMap = reloadCurrentMap == null ? ignored -> { } : reloadCurrentMap;
    }

    public void updateRoomMetadata(DungeonRoom room) {
        if (room == null || room.roomId() == null) {
            return;
        }
        DungeonUiAsyncSupport.submitAction(
                () -> DungeonMapEditorService.updateRoomMetadata(room.roomId(), room.name(), room.description()),
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
        DungeonUiAsyncSupport.submitValue(
                () -> DungeonMapEditorService.saveArea(area),
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
                () -> DungeonUiAsyncSupport.submitAction(
                        () -> DungeonMapEditorService.deleteArea(areaId),
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
        DungeonUiAsyncSupport.submitValue(
                () -> DungeonMapEditorService.saveFeature(feature),
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
                () -> DungeonUiAsyncSupport.submitAction(
                        () -> DungeonMapEditorService.deleteFeature(featureId),
                        () -> reloadCurrentMap.accept(null),
                        ex -> UiErrorReporter.reportBackgroundFailure("DungeonEntityCrudController.deleteFeature()", ex)));
    }

    public void addSelectedSquareToActiveFeature() {
        DungeonSquare square = selectedSquare();
        Long featureId = selectedFeatureIdForActions();
        if (square == null || square.squareId() == null || featureId == null) {
            return;
        }
        DungeonUiAsyncSupport.submitAction(
                () -> DungeonMapEditorService.addSquareToFeature(featureId, square.squareId()),
                () -> reloadCurrentMap.accept(DungeonSelectionRestoreRequest.feature(featureId)),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEntityCrudController.addSelectedSquareToActiveFeature()", ex));
    }

    public void removeSelectedSquareFromActiveFeature() {
        DungeonSquare square = selectedSquare();
        Long featureId = selectedFeatureIdForActions();
        if (square == null || square.squareId() == null || featureId == null) {
            return;
        }
        DungeonUiAsyncSupport.submitAction(
                () -> DungeonMapEditorService.removeSquareFromFeature(featureId, square.squareId()),
                () -> reloadCurrentMap.accept(DungeonSelectionRestoreRequest.feature(featureId)),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEntityCrudController.removeSelectedSquareFromActiveFeature()", ex));
    }

    public void assignRoomToArea(DungeonSquare square) {
        Long areaId = toolSettingsPane.getActiveAreaId();
        if (square == null || square.roomId() == null || areaId == null) {
            return;
        }
        DungeonUiAsyncSupport.submitAction(
                () -> DungeonMapEditorService.assignRoomArea(square.roomId(), areaId),
                () -> reloadCurrentMap.accept(DungeonSelectionRestoreRequest.room(square.roomId())),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEntityCrudController.assignRoomToArea()", ex));
    }

    public void handleAreaAssignClick(DungeonMapPane.CellInteraction interaction, Long currentMapId) {
        if (interaction == null) {
            return;
        }
        DungeonSquare square = interaction.square();
        if (square == null || square.roomId() == null) {
            selectionController.handleSquareClick(interaction, currentMapId);
            workflowMessageController.showMessage("Bereich zuweisen", "Dieses Feld gehoert noch zu keinem Raum.");
            return;
        }
        if (toolSettingsPane.getActiveAreaId() == null) {
            selectionController.handleSquareClick(interaction, currentMapId);
            workflowMessageController.showMessage("Bereich zuweisen", "Zuerst einen Bereich im State-Panel auswaehlen.");
            return;
        }
        assignRoomToArea(square);
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
