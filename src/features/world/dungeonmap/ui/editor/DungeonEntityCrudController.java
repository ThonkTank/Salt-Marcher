package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.api.DungeonEncounterTableSummary;
import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.model.DungeonFeatureCategory;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;
import javafx.scene.Node;
import ui.async.UiErrorReporter;
import ui.components.ConfirmationDropdown;
import ui.components.TextInputDropdown;

import java.util.function.Consumer;

final class DungeonEntityCrudController {

    private final DungeonEditorState state;
    private final DungeonEditorApplicationService applicationService;
    private final DungeonToolSettingsPane toolSettingsPane;
    private final ConfirmationDropdown confirmationDropdown = new ConfirmationDropdown();
    private final TextInputDropdown roomDropdown = new TextInputDropdown();
    private final TextInputDropdown areaDropdown = new TextInputDropdown();
    private final TextInputDropdown featureDropdown = new TextInputDropdown();
    private Consumer<DungeonSelectionRestoreRequest> reloadCurrentMap = ignored -> { };

    DungeonEntityCrudController(
            DungeonEditorState state,
            DungeonEditorApplicationService applicationService,
            DungeonToolSettingsPane toolSettingsPane
    ) {
        this.state = state;
        this.applicationService = applicationService;
        this.toolSettingsPane = toolSettingsPane;
    }

    void setReloadCurrentMap(Consumer<DungeonSelectionRestoreRequest> reloadCurrentMap) {
        this.reloadCurrentMap = reloadCurrentMap == null ? ignored -> { } : reloadCurrentMap;
    }

    void createRoom(Node anchor) {
        if (state.currentMapId() == null) {
            return;
        }
        roomDropdown.show(anchor, "Raum erstellen", "Name", "Neuer Raum", "Erstellen", name -> {
            saveRoom(new DungeonRoom(null, state.currentMapId(), name, "", toolSettingsPane.getActiveAreaId()));
            roomDropdown.hide();
        });
    }

    void saveRoom(DungeonRoom room) {
        applicationService.saveRoom(
                room,
                roomId -> {
                    reloadCurrentMap.accept(DungeonSelectionRestoreRequest.room(roomId));
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEntityCrudController.saveRoom()", ex));
    }

    void deleteActiveRoom(Node anchor) {
        Long roomId = selectedRoomIdForActions();
        if (roomId != null) {
            deleteRoom(roomId, anchor);
        }
    }

    void deleteRoom(Long roomId, Node anchor) {
        if (roomId == null) {
            return;
        }
        confirmDelete(
                anchor,
                "Raum löschen",
                "Raum '" + findRoomName(roomId) + "' löschen? Alle zugewiesenen Felder werden freigegeben.",
                () -> applicationService.deleteRoom(
                        roomId,
                        () -> reloadCurrentMap.accept(null),
                        ex -> UiErrorReporter.reportBackgroundFailure("DungeonEntityCrudController.deleteRoom()", ex)));
    }

    void createArea(Node anchor) {
        if (state.currentMapId() == null) {
            return;
        }
        areaDropdown.show(anchor, "Bereich erstellen", "Name", "Neuer Bereich", "Erstellen", name -> {
            DungeonEncounterTableSummary selectedTable = toolSettingsPane.getSelectedEncounterTable();
            saveArea(new DungeonArea(
                    null,
                    state.currentMapId(),
                    name,
                    "",
                    selectedTable == null ? null : selectedTable.tableId()));
            areaDropdown.hide();
        });
    }

    void saveArea(DungeonArea area) {
        applicationService.saveArea(
                area,
                areaId -> {
                    reloadCurrentMap.accept(DungeonSelectionRestoreRequest.area(areaId));
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEntityCrudController.saveArea()", ex));
    }

    void deleteActiveArea(Node anchor) {
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
                "Bereich '" + findAreaName(areaId) + "' löschen? Alle zugehörigen Räume werden vom Bereich getrennt.",
                () -> applicationService.deleteArea(
                        areaId,
                        () -> reloadCurrentMap.accept(null),
                        ex -> UiErrorReporter.reportBackgroundFailure("DungeonEntityCrudController.deleteArea()", ex)));
    }

    void createFeature(Node anchor) {
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

    void saveFeature(DungeonFeature feature) {
        applicationService.saveFeature(
                feature,
                featureId -> {
                    reloadCurrentMap.accept(DungeonSelectionRestoreRequest.feature(featureId));
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEntityCrudController.saveFeature()", ex));
    }

    void deleteActiveFeature(Node anchor) {
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

    void addSelectedSquareToActiveFeature() {
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

    void removeSelectedSquareFromActiveFeature() {
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

    void assignRoomToArea(DungeonSquare square) {
        if (square == null || square.roomId() == null) {
            return;
        }
        applicationService.assignRoomArea(
                square.roomId(),
                toolSettingsPane.getActiveAreaId(),
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

    private Long selectedRoomIdForActions() {
        if (state.currentSelection() != null && state.currentSelection().type() == DungeonSelection.SelectionType.ROOM) {
            return state.currentSelection().room() == null ? null : state.currentSelection().room().roomId();
        }
        return toolSettingsPane.getActiveRoomId();
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

    private String findRoomName(Long roomId) {
        if (state.currentState() != null) {
            for (DungeonRoom room : state.currentState().rooms()) {
                if (roomId.equals(room.roomId())) {
                    return room.name();
                }
            }
        }
        return "#" + roomId;
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
