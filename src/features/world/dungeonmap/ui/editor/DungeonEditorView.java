package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonEncounterTableSummary;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.service.DungeonMapEditorService;
import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorControls;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorTool;
import features.world.dungeonmap.ui.editor.panes.DungeonDetailsPane;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;
import javafx.scene.Node;
import javafx.scene.control.Alert;
import javafx.scene.control.Button;
import javafx.scene.control.ButtonType;
import javafx.scene.control.TextInputDialog;
import ui.async.UiErrorReporter;
import ui.shell.AppView;

import java.util.List;

public class DungeonEditorView implements AppView {

    private final DungeonEditorControls controls = new DungeonEditorControls();
    private final DungeonMapPane canvas = new DungeonMapPane();
    private final DungeonDetailsPane detailsPane = new DungeonDetailsPane();
    private final DungeonToolSettingsPane toolSettingsPane = new DungeonToolSettingsPane();
    private final DungeonEditorApplicationService applicationService = new DungeonEditorApplicationService();
    private final DungeonPaintSession paintSession = new DungeonPaintSession(canvas);
    private final DungeonEditorSelectionController selectionController =
            new DungeonEditorSelectionController(canvas, detailsPane, toolSettingsPane);
    private final DungeonMapDialogs mapDialogs = new DungeonMapDialogs();

    private Long currentMapId;
    private DungeonMapState currentState;
    private long loadRequestToken = 0;
    private boolean syncingAreaSelection = false;
    private Long pendingRoomSelectionId;
    private Long pendingAreaSelectionId;

    public DungeonEditorView() {
        bindControls();
        bindCanvas();
        bindToolSettings();
        bindDetailsPane();
    }

    @Override
    public Node getMainContent() {
        return canvas;
    }

    @Override
    public String getTitle() {
        return "Dungeoneditor";
    }

    @Override
    public String getIconText() {
        return "\u25a6";
    }

    @Override
    public Node getControlsContent() {
        return controls;
    }

    @Override
    public Node getDetailsContent() {
        return detailsPane;
    }

    @Override
    public Node getStateContent() {
        return toolSettingsPane;
    }

    @Override
    public void onShow() {
        loadEncounterTables();
        loadMapList();
    }

    private void bindControls() {
        controls.setOnMapSelected(this::loadMapAsync);
        controls.setOnNewMapRequested(this::showNewMapDialog);
        controls.setOnEditMapRequested(this::showEditMapDialog);
        controls.setOnToolChanged(selectionController::updateToolMode);
    }

    private void bindCanvas() {
        canvas.setOnCellClicked(this::handleCellClick);
        canvas.setOnCellPainted(this::handleCellPaint);
        canvas.setOnPaintStrokeFinished(this::flushPendingPaints);
        canvas.setOnEndpointClicked(this::handleEndpointClick);
        canvas.setOnLinkClicked(selectionController::showLinkSelection);
    }

    private void bindToolSettings() {
        toolSettingsPane.newRoomButton().setOnAction(event -> createRoom());
        toolSettingsPane.deleteRoomButton().setOnAction(event -> deleteActiveRoom());
        toolSettingsPane.newAreaButton().setOnAction(event -> createArea());
        toolSettingsPane.deleteAreaButton().setOnAction(event -> deleteActiveArea());
        toolSettingsPane.setOnRoomSelected(selectionController::selectRoom);
        toolSettingsPane.setOnAreaSelected(this::handleAreaSelected);
        toolSettingsPane.linksVisibleCheckBox().selectedProperty()
                .addListener((obs, oldValue, newValue) -> canvas.setShowLinks(newValue));
        toolSettingsPane.endpointsVisibleCheckBox().selectedProperty()
                .addListener((obs, oldValue, newValue) -> canvas.setShowEndpoints(newValue));
        toolSettingsPane.encounterTableComboBox().valueProperty().addListener((obs, oldValue, newValue) -> saveSelectedAreaEncounterTable(newValue));
        toolSettingsPane.setOnCancelLink(selectionController::cancelPendingLink);
    }

    private void bindDetailsPane() {
        detailsPane.setOnRoomSaved(form -> saveRoom(new DungeonRoom(
                form.roomId(),
                currentMapId,
                form.name(),
                form.description(),
                form.areaId())));
        detailsPane.setOnRoomDeleted(this::deleteRoom);
        detailsPane.setOnAreaSaved(form -> saveArea(new DungeonArea(
                form.areaId(),
                currentMapId,
                form.name(),
                form.description(),
                form.encounterTableId(),
                selectedEncounterTableName(form.encounterTableId()))));
        detailsPane.setOnAreaDeleted(this::deleteArea);
        detailsPane.setOnEndpointSaved(form -> {
            DungeonEndpoint current = findEndpoint(form.endpointId());
            if (current != null) {
                saveEndpoint(new DungeonEndpoint(
                        current.endpointId(),
                        current.mapId(),
                        current.squareId(),
                        form.name(),
                        form.notes(),
                        current.x(),
                        current.y()));
            }
        });
        detailsPane.setOnEndpointDeleted(this::deleteEndpoint);
        detailsPane.setOnLinkSaved(form -> applicationService.updateLinkLabel(
                form.linkId(),
                form.label(),
                () -> loadMapAsync(currentMapId),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditorView.updateLinkLabel()", ex)));
        detailsPane.setOnLinkDeleted(this::deleteLink);
    }

    private void loadEncounterTables() {
        applicationService.loadEncounterTables(
                tables -> {
                    toolSettingsPane.setEncounterTables(tables);
                    detailsPane.setEncounterTables(tables);
                    syncEncounterTableSelection();
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditorView.loadEncounterTables()", ex));
    }

    private void loadMapList() {
        applicationService.loadMapList(
                maps -> {
                    controls.setMaps(maps);
                    Long mapToSelect = resolveMapSelection(maps);
                    if (mapToSelect != null) {
                        controls.selectMap(mapToSelect);
                        loadMapAsync(mapToSelect);
                    }
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditorView.loadMapList()", ex));
    }

    private Long resolveMapSelection(List<DungeonMap> maps) {
        Long mapToSelect = currentMapId;
        if (mapToSelect != null) {
            for (DungeonMap map : maps) {
                if (mapToSelect.equals(map.mapId())) {
                    return mapToSelect;
                }
            }
        }
        return maps.isEmpty() ? null : maps.get(0).mapId();
    }

    private void loadMapAsync(Long mapId) {
        if (mapId == null) {
            return;
        }
        selectionController.cancelPendingLink();
        currentMapId = mapId;
        long requestToken = ++loadRequestToken;
        applicationService.loadMap(
                mapId,
                state -> {
                    if (requestToken == loadRequestToken && mapId.equals(currentMapId)) {
                        applyLoadedState(state);
                    }
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditorView.loadMapAsync()", ex));
    }

    private void applyLoadedState(DungeonMapState state) {
        currentState = state;
        canvas.loadState(state);
        toolSettingsPane.setRooms(state.rooms());
        toolSettingsPane.setAreas(state.areas());
        detailsPane.setAreas(state.areas());
        detailsPane.setEndpoints(state.endpoints());
        selectionController.cancelPendingLink();
        selectionController.clearSelection();
        applyPendingSelection(state);
        syncEncounterTableSelection();
    }

    private void applyPendingSelection(DungeonMapState state) {
        if (pendingRoomSelectionId != null) {
            Long roomId = pendingRoomSelectionId;
            pendingRoomSelectionId = null;
            for (DungeonRoom room : state.rooms()) {
                if (roomId.equals(room.roomId())) {
                    selectionController.selectRoom(room);
                    return;
                }
            }
        }
        if (pendingAreaSelectionId != null) {
            Long areaId = pendingAreaSelectionId;
            pendingAreaSelectionId = null;
            for (DungeonArea area : state.areas()) {
                if (areaId.equals(area.areaId())) {
                    selectionController.selectArea(area);
                    return;
                }
            }
        }
    }

    private void handleCellPaint(DungeonMapPane.CellInteraction interaction) {
        DungeonEditorTool tool = controls.getActiveTool();
        boolean filled = tool == DungeonEditorTool.PAINT;
        Long roomId = filled ? toolSettingsPane.getActiveRoomId() : null;
        DungeonSquarePaint paint = new DungeonSquarePaint(
                interaction.x(),
                interaction.y(),
                filled,
                roomId);
        paintSession.previewPaint(currentMapId, currentState, paint);
    }

    private void flushPendingPaints() {
        paintSession.flushPendingPaints(
                currentMapId,
                (mapId, paints) -> applicationService.applySquarePaints(
                        mapId,
                        paints,
                        () -> loadMapAsync(currentMapId),
                        ex -> {
                            UiErrorReporter.reportBackgroundFailure("DungeonEditorView.flushPendingPaints()", ex);
                            loadMapAsync(currentMapId);
                        }));
    }

    private void handleCellClick(DungeonMapPane.CellInteraction interaction) {
        selectionController.handleCellClick(
                controls.getActiveTool(),
                interaction,
                currentMapId,
                this::assignRoomToArea,
                this::createOrSelectEndpoint);
    }

    private void handleEndpointClick(DungeonEndpoint endpoint) {
        selectionController.handleEndpointClick(
                controls.getActiveTool(),
                endpoint,
                currentMapId,
                (mapId, fromId, toId) -> applicationService.createLink(
                        mapId,
                        fromId,
                        toId,
                        this::handleLinkCreateResult,
                        ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditorView.createLink()", ex)));
    }

    private void handleAreaSelected(DungeonArea area) {
        selectionController.selectArea(area);
        syncEncounterTableSelection();
    }

    private void syncEncounterTableSelection() {
        DungeonArea selectedArea = toolSettingsPane.areaComboBox().getValue();
        syncingAreaSelection = true;
        toolSettingsPane.selectEncounterTable(selectedArea == null ? null : selectedArea.encounterTableId());
        syncingAreaSelection = false;
    }

    private void saveSelectedAreaEncounterTable(DungeonEncounterTableSummary selectedTable) {
        DungeonArea area = toolSettingsPane.areaComboBox().getValue();
        if (syncingAreaSelection || area == null || currentState == null) {
            return;
        }
        saveArea(new DungeonArea(
                area.areaId(),
                area.mapId(),
                area.name(),
                area.description(),
                selectedTable == null ? null : selectedTable.tableId(),
                selectedTable == null ? null : selectedTable.name()));
    }

    private void assignRoomToArea(DungeonSquare square) {
        if (square == null || square.roomId() == null) {
            return;
        }
        applicationService.assignRoomArea(
                square.roomId(),
                toolSettingsPane.getActiveAreaId(),
                () -> loadMapAsync(currentMapId),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditorView.assignRoomToArea()", ex));
    }

    private void createOrSelectEndpoint(DungeonSquare square) {
        if (square == null || square.squareId() == null || currentMapId == null) {
            return;
        }
        DungeonEndpoint existing = findEndpointBySquare(square.squareId());
        if (existing != null) {
            selectionController.showEndpointSelection(existing);
            return;
        }
        saveEndpoint(new DungeonEndpoint(
                null,
                currentMapId,
                square.squareId(),
                "Knoten " + square.x() + "," + square.y(),
                "",
                square.x(),
                square.y()));
    }

    private void createRoom() {
        if (currentMapId == null) {
            return;
        }
        TextInputDialog dialog = new TextInputDialog("Neuer Raum");
        dialog.setHeaderText("Raum erstellen");
        dialog.setContentText("Name:");
        dialog.showAndWait().ifPresent(name -> {
            if (!name.isBlank()) {
                saveRoom(new DungeonRoom(null, currentMapId, name.strip(), "", toolSettingsPane.getActiveAreaId()));
            }
        });
    }

    private void saveRoom(DungeonRoom room) {
        applicationService.saveRoom(
                room,
                roomId -> {
                    pendingRoomSelectionId = roomId;
                    pendingAreaSelectionId = null;
                    loadMapAsync(currentMapId);
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditorView.saveRoom()", ex));
    }

    private void deleteActiveRoom() {
        Long roomId = toolSettingsPane.getActiveRoomId();
        if (roomId != null) {
            deleteRoom(roomId);
        }
    }

    private void deleteRoom(Long roomId) {
        if (roomId == null) {
            return;
        }
        String name = findRoomName(roomId);
        Alert confirm = new Alert(Alert.AlertType.CONFIRMATION,
                "Raum '" + name + "' löschen? Alle zugewiesenen Felder werden freigegeben.",
                ButtonType.CANCEL, ButtonType.OK);
        confirm.setHeaderText("Raum löschen");
        ((Button) confirm.getDialogPane().lookupButton(ButtonType.CANCEL)).setDefaultButton(true);
        ((Button) confirm.getDialogPane().lookupButton(ButtonType.OK)).setDefaultButton(false);
        if (confirm.showAndWait().filter(ButtonType.OK::equals).isEmpty()) {
            return;
        }
        applicationService.deleteRoom(
                roomId,
                () -> loadMapAsync(currentMapId),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditorView.deleteRoom()", ex));
    }

    private String findRoomName(Long roomId) {
        if (currentState != null) {
            for (DungeonRoom room : currentState.rooms()) {
                if (roomId.equals(room.roomId())) {
                    return room.name();
                }
            }
        }
        return "#" + roomId;
    }

    private void createArea() {
        if (currentMapId == null) {
            return;
        }
        TextInputDialog dialog = new TextInputDialog("Neuer Bereich");
        dialog.setHeaderText("Bereich erstellen");
        dialog.setContentText("Name:");
        dialog.showAndWait().ifPresent(name -> {
            if (!name.isBlank()) {
                DungeonEncounterTableSummary selectedTable = toolSettingsPane.getSelectedEncounterTable();
                saveArea(new DungeonArea(
                        null,
                        currentMapId,
                        name.strip(),
                        "",
                        selectedTable == null ? null : selectedTable.tableId(),
                        selectedTable == null ? null : selectedTable.name()));
            }
        });
    }

    private void saveArea(DungeonArea area) {
        applicationService.saveArea(
                area,
                areaId -> {
                    pendingAreaSelectionId = areaId;
                    pendingRoomSelectionId = null;
                    loadMapAsync(currentMapId);
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditorView.saveArea()", ex));
    }

    private void deleteActiveArea() {
        Long areaId = toolSettingsPane.getActiveAreaId();
        if (areaId != null) {
            deleteArea(areaId);
        }
    }

    private void deleteArea(Long areaId) {
        if (areaId == null) {
            return;
        }
        String name = findAreaName(areaId);
        Alert confirm = new Alert(Alert.AlertType.CONFIRMATION,
                "Bereich '" + name + "' löschen? Alle zugehörigen Räume werden vom Bereich getrennt.",
                ButtonType.CANCEL, ButtonType.OK);
        confirm.setHeaderText("Bereich löschen");
        ((Button) confirm.getDialogPane().lookupButton(ButtonType.CANCEL)).setDefaultButton(true);
        ((Button) confirm.getDialogPane().lookupButton(ButtonType.OK)).setDefaultButton(false);
        if (confirm.showAndWait().filter(ButtonType.OK::equals).isEmpty()) {
            return;
        }
        applicationService.deleteArea(
                areaId,
                () -> loadMapAsync(currentMapId),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditorView.deleteArea()", ex));
    }

    private String findAreaName(Long areaId) {
        if (currentState != null) {
            for (DungeonArea area : currentState.areas()) {
                if (areaId.equals(area.areaId())) {
                    return area.name();
                }
            }
        }
        return "#" + areaId;
    }

    private void saveEndpoint(DungeonEndpoint endpoint) {
        applicationService.saveEndpoint(
                endpoint,
                ignored -> loadMapAsync(currentMapId),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditorView.saveEndpoint()", ex));
    }

    private void deleteEndpoint(Long endpointId) {
        if (endpointId == null) {
            return;
        }
        String name = findEndpointName(endpointId);
        Alert confirm = new Alert(Alert.AlertType.CONFIRMATION,
                "Knoten '" + name + "' löschen? Alle verbundenen Links werden ebenfalls entfernt.",
                ButtonType.CANCEL, ButtonType.OK);
        confirm.setHeaderText("Knoten löschen");
        ((Button) confirm.getDialogPane().lookupButton(ButtonType.CANCEL)).setDefaultButton(true);
        ((Button) confirm.getDialogPane().lookupButton(ButtonType.OK)).setDefaultButton(false);
        if (confirm.showAndWait().filter(ButtonType.OK::equals).isEmpty()) {
            return;
        }
        applicationService.deleteEndpoint(
                endpointId,
                () -> loadMapAsync(currentMapId),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditorView.deleteEndpoint()", ex));
    }

    private String findEndpointName(Long endpointId) {
        if (currentState != null) {
            for (DungeonEndpoint endpoint : currentState.endpoints()) {
                if (endpointId.equals(endpoint.endpointId())) {
                    String n = endpoint.name();
                    return (n != null && !n.isBlank()) ? n : "#" + endpointId;
                }
            }
        }
        return "#" + endpointId;
    }

    private void deleteLink(Long linkId) {
        if (linkId == null) {
            return;
        }
        applicationService.deleteLink(
                linkId,
                () -> loadMapAsync(currentMapId),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditorView.deleteLink()", ex));
    }

    private void handleLinkCreateResult(DungeonMapEditorService.LinkCreateResult result) {
        if (result == null) {
            return;
        }
        if (result.status() == DungeonMapEditorService.LinkCreateStatus.CREATED) {
            loadMapAsync(currentMapId);
            return;
        }
        if (result.status() == DungeonMapEditorService.LinkCreateStatus.SAME_ENDPOINT) {
            detailsPane.showInfoMessage("Linkerstellung abgebrochen: Bitte zwei verschiedene Knoten wählen.");
            return;
        }
        if (result.status() == DungeonMapEditorService.LinkCreateStatus.DUPLICATE) {
            detailsPane.showInfoMessage("Diese beiden Knoten sind bereits verbunden.");
            return;
        }
        if (result.status() == DungeonMapEditorService.LinkCreateStatus.INVALID_ENDPOINT) {
            detailsPane.showInfoMessage("Linkerstellung abgebrochen: Mindestens ein Knoten ist nicht mehr gültig.");
        }
    }

    private DungeonEndpoint findEndpoint(Long endpointId) {
        if (currentState == null || endpointId == null) {
            return null;
        }
        for (DungeonEndpoint endpoint : currentState.endpoints()) {
            if (endpointId.equals(endpoint.endpointId())) {
                return endpoint;
            }
        }
        return null;
    }

    private DungeonEndpoint findEndpointBySquare(Long squareId) {
        if (currentState == null || squareId == null) {
            return null;
        }
        for (DungeonEndpoint endpoint : currentState.endpoints()) {
            if (squareId.equals(endpoint.squareId())) {
                return endpoint;
            }
        }
        return null;
    }

    private String selectedEncounterTableName(Long encounterTableId) {
        if (encounterTableId == null) {
            return null;
        }
        DungeonEncounterTableSummary selectedTable = toolSettingsPane.getSelectedEncounterTable();
        if (selectedTable != null && encounterTableId.equals(selectedTable.tableId())) {
            return selectedTable.name();
        }
        if (currentState == null) {
            return null;
        }
        for (DungeonArea area : currentState.areas()) {
            if (encounterTableId.equals(area.encounterTableId())) {
                return area.encounterTableName();
            }
        }
        return null;
    }

    private void showNewMapDialog() {
        mapDialogs.showNewMapDialog(result -> applicationService.createMap(
                result.name(),
                result.width(),
                result.height(),
                mapId -> {
                    currentMapId = mapId;
                    loadMapList();
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditorView.createMap()", ex)));
    }

    private void showEditMapDialog(DungeonMap map) {
        mapDialogs.showEditMapDialog(
                map,
                currentState,
                result -> applicationService.updateMap(
                        map.mapId(),
                        result.name(),
                        result.width(),
                        result.height(),
                        () -> {
                            currentMapId = map.mapId();
                            loadMapList();
                        },
                        ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditorView.updateMap()", ex)));
    }
}
