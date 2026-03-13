package features.world.dungeonmap.ui.editor.workflow.entity;

import features.world.dungeonmap.model.domain.DungeonArea;
import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonFeatureCategory;
import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.ui.shared.selection.DungeonSelection;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.ui.shared.canvas.DungeonMapPane;
import features.world.dungeonmap.service.DungeonMapCommandService;
import features.world.dungeonmap.ui.shared.async.DungeonUiAsyncSupport;
import features.world.dungeonmap.ui.editor.chrome.inspector.DungeonEntityInspectorActions;
import features.world.dungeonmap.ui.editor.chrome.sidebar.DungeonToolSettingsPane;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import features.world.dungeonmap.ui.editor.state.DungeonSelectionRestoreRequest;
import features.world.dungeonmap.ui.editor.workflow.tools.EditorMessageBus;
import features.world.dungeonmap.ui.editor.workflow.selection.DungeonSelectionController;
import javafx.scene.Node;
import ui.async.UiErrorReporter;
import ui.components.ConfirmationDropdown;
import ui.components.TextInputDropdown;

import java.util.function.Consumer;

public final class DungeonEntityWorkflow implements DungeonEntityInspectorActions {

    private final DungeonEditorState state;
    private final DungeonToolSettingsPane toolSettingsPane;
    private final DungeonSelectionController selectionController;
    private final EditorMessageBus workflowMessageBus;
    private final DungeonMapCommandService commands;
    private final ConfirmationDropdown confirmationDropdown = new ConfirmationDropdown();
    private final TextInputDropdown areaDropdown = new TextInputDropdown();
    private final TextInputDropdown featureDropdown = new TextInputDropdown();
    private final Consumer<DungeonSelectionRestoreRequest> reloadCurrentMap;

    public DungeonEntityWorkflow(
            DungeonEditorState state,
            DungeonToolSettingsPane toolSettingsPane,
            DungeonSelectionController selectionController,
            EditorMessageBus workflowMessageBus,
            DungeonMapCommandService commands,
            Consumer<DungeonSelectionRestoreRequest> reloadCurrentMap
    ) {
        this.state = state;
        this.toolSettingsPane = toolSettingsPane;
        this.selectionController = selectionController;
        this.workflowMessageBus = workflowMessageBus;
        this.commands = commands;
        this.reloadCurrentMap = reloadCurrentMap == null ? ignored -> { } : reloadCurrentMap;
    }

    @Override
    public void updateRoomMetadata(DungeonRoom room) {
        if (room == null || room.roomId() == null) {
            return;
        }
        DungeonUiAsyncSupport.submitAction(
                () -> commands.updateRoomMetadata(room.roomId(), room.name(), room.description()),
                () -> reloadCurrentMap.accept(DungeonSelectionRestoreRequest.room(room.roomId())),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEntityWorkflow.updateRoomMetadata()", ex));
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
                () -> commands.saveArea(area),
                areaId -> reloadCurrentMap.accept(DungeonSelectionRestoreRequest.area(areaId)),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEntityWorkflow.saveArea()", ex));
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
                        () -> commands.deleteArea(areaId),
                        () -> reloadCurrentMap.accept(null),
                        ex -> UiErrorReporter.reportBackgroundFailure("DungeonEntityWorkflow.deleteArea()", ex)));
    }

    public void createFeature(Node anchor) {
        if (state.currentMapId() == null) {
            return;
        }
        DungeonFeatureCategory category = toolSettingsPane.selectedFeatureCategory();
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

    @Override
    public void saveFeature(DungeonFeature feature) {
        DungeonUiAsyncSupport.submitValue(
                () -> commands.saveFeature(feature),
                featureId -> {
                    reloadCurrentMap.accept(DungeonSelectionRestoreRequest.feature(featureId));
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEntityWorkflow.saveFeature()", ex));
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
                        () -> commands.deleteFeature(featureId),
                        () -> reloadCurrentMap.accept(null),
                        ex -> UiErrorReporter.reportBackgroundFailure("DungeonEntityWorkflow.deleteFeature()", ex)));
    }

    public void addSelectedSquareToActiveFeature() {
        DungeonSquare square = selectedSquare();
        Long featureId = selectedFeatureIdForActions();
        if (square == null || square.squareId() == null || featureId == null) {
            return;
        }
        DungeonUiAsyncSupport.submitAction(
                () -> commands.addSquareToFeature(featureId, square.squareId()),
                () -> reloadCurrentMap.accept(DungeonSelectionRestoreRequest.feature(featureId)),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEntityWorkflow.addSelectedSquareToActiveFeature()", ex));
    }

    public void removeSelectedSquareFromActiveFeature() {
        DungeonSquare square = selectedSquare();
        Long featureId = selectedFeatureIdForActions();
        if (square == null || square.squareId() == null || featureId == null) {
            return;
        }
        DungeonUiAsyncSupport.submitAction(
                () -> commands.removeSquareFromFeature(featureId, square.squareId()),
                () -> reloadCurrentMap.accept(DungeonSelectionRestoreRequest.feature(featureId)),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEntityWorkflow.removeSelectedSquareFromActiveFeature()", ex));
    }

    public void assignRoomToArea(DungeonSquare square) {
        Long areaId = toolSettingsPane.selectedAreaId();
        if (square == null || square.roomId() == null || areaId == null) {
            return;
        }
        DungeonUiAsyncSupport.submitAction(
                () -> commands.assignRoomArea(square.roomId(), areaId),
                () -> reloadCurrentMap.accept(DungeonSelectionRestoreRequest.room(square.roomId())),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEntityWorkflow.assignRoomToArea()", ex));
    }

    public void handleAreaAssignClick(DungeonMapPane.CellInteraction interaction, Long currentMapId) {
        if (interaction == null) {
            return;
        }
        DungeonSquare square = interaction.square();
        if (square == null || square.roomId() == null) {
            selectionController.handleSquareClick(interaction, currentMapId);
            workflowMessageBus.showMessage("Bereich zuweisen", "Dieses Feld gehoert noch zu keinem Raum.");
            return;
        }
        if (toolSettingsPane.selectedAreaId() == null) {
            selectionController.handleSquareClick(interaction, currentMapId);
            workflowMessageBus.showMessage("Bereich zuweisen", "Zuerst einen Bereich im State-Panel auswaehlen.");
            return;
        }
        assignRoomToArea(square);
    }

    DungeonFeature findFeature(Long featureId) {
        return state.findFeature(featureId);
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
        return toolSettingsPane.selectedAreaId();
    }

    private Long selectedFeatureIdForActions() {
        if (state.currentSelection() != null && state.currentSelection().type() == DungeonSelection.SelectionType.FEATURE) {
            return state.currentSelection().feature() == null ? null : state.currentSelection().feature().featureId();
        }
        return toolSettingsPane.selectedFeatureId();
    }
    private String findAreaName(Long areaId) {
        DungeonArea area = state.findArea(areaId);
        if (area != null) {
            return area.name();
        }
        return "#" + areaId;
    }

    private String findFeatureName(Long featureId) {
        DungeonFeature feature = findFeature(featureId);
        return feature == null ? "Feature" : feature.toString();
    }
}
