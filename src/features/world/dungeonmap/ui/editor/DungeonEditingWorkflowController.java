package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.api.DungeonEncounterTableSummary;
import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonEndpointRole;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.model.PassageType;
import features.world.dungeonmap.service.DungeonMapEditorService;
import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorControls;
import features.world.dungeonmap.ui.editor.panes.DungeonDetailsPane;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;
import javafx.scene.Node;
import ui.components.ConfirmationDropdown;
import ui.components.TextInputDropdown;
import ui.async.UiErrorReporter;

final class DungeonEditingWorkflowController {

    private final DungeonEditorState state;
    private final DungeonEditorApplicationService applicationService;
    private final DungeonEditorControls controls;
    private final DungeonToolSettingsPane toolSettingsPane;
    private final DungeonDetailsPane detailsPane;
    private final DungeonSelectionWorkflowController selectionController;
    private final DungeonPaintSession paintSession;
    private final DungeonMapDropdowns mapDropdowns;
    private final TextInputDropdown roomDropdown = new TextInputDropdown();
    private final TextInputDropdown areaDropdown = new TextInputDropdown();
    private final ConfirmationDropdown confirmationDropdown = new ConfirmationDropdown();
    private Runnable reloadCurrentMap = () -> { };
    private Runnable reloadMapList = () -> { };

    DungeonEditingWorkflowController(
            DungeonEditorState state,
            DungeonEditorApplicationService applicationService,
            DungeonEditorControls controls,
            DungeonToolSettingsPane toolSettingsPane,
            DungeonDetailsPane detailsPane,
            DungeonSelectionWorkflowController selectionController,
            DungeonPaintSession paintSession,
            DungeonMapDropdowns mapDropdowns
    ) {
        this.state = state;
        this.applicationService = applicationService;
        this.controls = controls;
        this.toolSettingsPane = toolSettingsPane;
        this.detailsPane = detailsPane;
        this.selectionController = selectionController;
        this.paintSession = paintSession;
        this.mapDropdowns = mapDropdowns;
    }

    void setReloadCallbacks(Runnable reloadCurrentMap, Runnable reloadMapList) {
        this.reloadCurrentMap = reloadCurrentMap == null ? () -> { } : reloadCurrentMap;
        this.reloadMapList = reloadMapList == null ? () -> { } : reloadMapList;
    }

    void handleCellPaint(DungeonMapPane.CellInteraction interaction) {
        boolean filled = controls.getActiveTool().paintsFilledSquares();
        Long roomId = filled ? toolSettingsPane.getActiveRoomId() : null;
        DungeonSquarePaint paint = new DungeonSquarePaint(interaction.x(), interaction.y(), filled, roomId);
        paintSession.previewPaint(state.currentMapId(), state.currentState(), paint);
    }

    void flushPendingPaints() {
        paintSession.flushPendingPaints(
                state.currentMapId(),
                (mapId, paints) -> applicationService.applySquarePaints(
                        mapId,
                        paints,
                        reloadCurrentMap,
                        ex -> {
                            UiErrorReporter.reportBackgroundFailure("DungeonEditingWorkflowController.flushPendingPaints()", ex);
                            reloadCurrentMap.run();
                        }));
    }

    void commitPendingPaints() {
        flushPendingPaints();
    }

    void discardPendingPaints() {
        paintSession.discardPendingPaints();
    }

    boolean hasPendingPaints() {
        return paintSession.hasPendingPaints();
    }

    void handleCellClick(DungeonMapPane.CellInteraction interaction) {
        selectionController.handleCellClick(
                controls.getActiveTool(),
                interaction,
                state.currentMapId(),
                this::assignRoomToArea,
                this::createOrSelectEndpoint);
    }

    void handleEndpointClick(DungeonEndpoint endpoint) {
        selectionController.handleEndpointClick(
                controls.getActiveTool(),
                endpoint,
                state.currentMapId(),
                (mapId, fromId, toId) -> applicationService.createLink(
                        mapId,
                        fromId,
                        toId,
                        this::handleLinkCreateResult,
                        ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditingWorkflowController.createLink()", ex)));
    }

    void handleEdgeClick(DungeonMapPane.EdgeInteraction interaction) {
        if (controls.getActiveTool() != features.world.dungeonmap.ui.editor.controls.DungeonEditorTool.PASSAGE) {
            return;
        }
        DungeonPassage existing = interaction.existingPassage();
        if (existing != null) {
            selectionController.selectPassage(existing);
            return;
        }
        if (state.currentMapId() == null) {
            return;
        }
        savePassage(new DungeonPassage(
                null,
                state.currentMapId(),
                interaction.x(),
                interaction.y(),
                interaction.direction(),
                PassageType.DOOR,
                "",
                "",
                null));
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
                    state.setPendingRoomSelectionId(roomId);
                    state.setPendingAreaSelectionId(null);
                    reloadCurrentMap.run();
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditingWorkflowController.saveRoom()", ex));
    }

    void deleteActiveRoom(Node anchor) {
        Long roomId = toolSettingsPane.getActiveRoomId();
        if (roomId != null) {
            deleteRoom(roomId, anchor);
        }
    }

    void deleteRoom(Long roomId, Node anchor) {
        if (roomId == null) {
            return;
        }
        String name = findRoomName(roomId);
        confirmationDropdown.show(anchor,
                "Raum löschen",
                "Raum '" + name + "' löschen? Alle zugewiesenen Felder werden freigegeben.",
                "Löschen",
                () -> {
                    confirmationDropdown.hide();
                    applicationService.deleteRoom(
                            roomId,
                            reloadCurrentMap,
                            ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditingWorkflowController.deleteRoom()", ex));
                });
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
                    selectedTable == null ? null : selectedTable.tableId(),
                    selectedTable == null ? null : selectedTable.name()));
            areaDropdown.hide();
        });
    }

    void saveArea(DungeonArea area) {
        applicationService.saveArea(
                area,
                areaId -> {
                    state.setPendingAreaSelectionId(areaId);
                    state.setPendingRoomSelectionId(null);
                    reloadCurrentMap.run();
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditingWorkflowController.saveArea()", ex));
    }

    void deleteActiveArea(Node anchor) {
        Long areaId = toolSettingsPane.getActiveAreaId();
        if (areaId != null) {
            deleteArea(areaId, anchor);
        }
    }

    void deleteArea(Long areaId, Node anchor) {
        if (areaId == null) {
            return;
        }
        String name = findAreaName(areaId);
        confirmationDropdown.show(anchor,
                "Bereich löschen",
                "Bereich '" + name + "' löschen? Alle zugehörigen Räume werden vom Bereich getrennt.",
                "Löschen",
                () -> {
                    confirmationDropdown.hide();
                    applicationService.deleteArea(
                            areaId,
                            reloadCurrentMap,
                            ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditingWorkflowController.deleteArea()", ex));
                });
    }

    void saveEndpoint(DungeonEndpoint endpoint) {
        applicationService.saveEndpoint(
                endpoint,
                ignored -> reloadCurrentMap.run(),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditingWorkflowController.saveEndpoint()", ex));
    }

    void deleteEndpoint(Long endpointId, Node anchor) {
        if (endpointId == null) {
            return;
        }
        String name = findEndpointName(endpointId);
        confirmationDropdown.show(anchor,
                "Übergang löschen",
                "Übergang '" + name + "' löschen? Alle verbundenen Links werden ebenfalls entfernt.",
                "Löschen",
                () -> {
                    confirmationDropdown.hide();
                    applicationService.deleteEndpoint(
                            endpointId,
                            reloadCurrentMap,
                            ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditingWorkflowController.deleteEndpoint()", ex));
                });
    }

    void deleteLink(Long linkId) {
        if (linkId == null) {
            return;
        }
        applicationService.deleteLink(
                linkId,
                reloadCurrentMap,
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditingWorkflowController.deleteLink()", ex));
    }

    void updateLinkLabel(long linkId, String label, Runnable onSuccess) {
        applicationService.updateLinkLabel(
                linkId,
                label,
                onSuccess,
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditingWorkflowController.updateLinkLabel()", ex));
    }

    void savePassage(DungeonPassage passage) {
        applicationService.savePassage(
                passage,
                passageId -> {
                    state.setPendingPassageSelectionId(passageId);
                    reloadCurrentMap.run();
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditingWorkflowController.savePassage()", ex));
    }

    void deletePassage(Long passageId, Node anchor) {
        if (passageId == null) {
            return;
        }
        String name = findPassageName(passageId);
        confirmationDropdown.show(anchor,
                "Durchgang löschen",
                "Durchgang '" + name + "' löschen?",
                "Löschen",
                () -> {
                    confirmationDropdown.hide();
                    applicationService.deletePassage(
                            passageId,
                            reloadCurrentMap,
                            ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditingWorkflowController.deletePassage()", ex));
                });
    }

    void showNewMapDropdown(Node anchor) {
        mapDropdowns.showNewMapDropdown(anchor, result -> applicationService.createMap(
                result.name(),
                result.width(),
                result.height(),
                mapId -> {
                    state.setCurrentMapId(mapId);
                    reloadMapList.run();
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditingWorkflowController.createMap()", ex)));
    }

    void showEditMapDropdown(DungeonEditorControls.MapActionRequest request) {
        mapDropdowns.showEditMapDropdown(
                request.anchor(),
                request.map(),
                state.currentState(),
                result -> applicationService.updateMap(
                        request.map().mapId(),
                        result.name(),
                        result.width(),
                        result.height(),
                        () -> {
                            state.setCurrentMapId(request.map().mapId());
                            reloadMapList.run();
                        },
                        ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditingWorkflowController.updateMap()", ex)));
    }

    DungeonEndpoint findEndpoint(Long endpointId) {
        if (state.currentState() == null || endpointId == null) {
            return null;
        }
        for (DungeonEndpoint endpoint : state.currentState().endpoints()) {
            if (endpointId.equals(endpoint.endpointId())) {
                return endpoint;
            }
        }
        return null;
    }

    String selectedEncounterTableName(Long encounterTableId) {
        if (encounterTableId == null) {
            return null;
        }
        DungeonEncounterTableSummary selectedTable = toolSettingsPane.getSelectedEncounterTable();
        if (selectedTable != null && encounterTableId.equals(selectedTable.tableId())) {
            return selectedTable.name();
        }
        if (state.currentState() == null) {
            return null;
        }
        for (DungeonArea area : state.currentState().areas()) {
            if (encounterTableId.equals(area.encounterTableId())) {
                return area.encounterTableName();
            }
        }
        return null;
    }

    private void assignRoomToArea(DungeonSquare square) {
        if (square == null || square.roomId() == null) {
            return;
        }
        applicationService.assignRoomArea(
                square.roomId(),
                toolSettingsPane.getActiveAreaId(),
                reloadCurrentMap,
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonEditingWorkflowController.assignRoomToArea()", ex));
    }

    private void createOrSelectEndpoint(DungeonSquare square) {
        if (square == null || square.squareId() == null || state.currentMapId() == null) {
            return;
        }
        DungeonEndpoint existing = findEndpointBySquare(square.squareId());
        if (existing != null) {
            selectionController.showEndpointSelection(existing);
            return;
        }
        saveEndpoint(new DungeonEndpoint(
                null,
                state.currentMapId(),
                square.squareId(),
                "Übergang " + square.x() + "," + square.y(),
                "",
                DungeonEndpointRole.BOTH,
                false,
                square.x(),
                square.y()));
    }

    private void handleLinkCreateResult(DungeonMapEditorService.LinkCreateResult result) {
        if (result == null) {
            return;
        }
        if (result.status() == DungeonMapEditorService.LinkCreateStatus.CREATED) {
            reloadCurrentMap.run();
            return;
        }
        if (result.status() == DungeonMapEditorService.LinkCreateStatus.SAME_ENDPOINT) {
            selectionController.publishInfoMessage("Linkerstellung", "Linkerstellung abgebrochen: Bitte zwei verschiedene Übergänge wählen.");
            return;
        }
        if (result.status() == DungeonMapEditorService.LinkCreateStatus.DUPLICATE) {
            selectionController.publishInfoMessage("Linkerstellung", "Diese beiden Übergänge sind bereits verbunden.");
            return;
        }
        if (result.status() == DungeonMapEditorService.LinkCreateStatus.INVALID_ENDPOINT) {
            selectionController.publishInfoMessage("Linkerstellung", "Linkerstellung abgebrochen: Mindestens ein Übergang ist nicht mehr gültig.");
        }
    }

    private DungeonEndpoint findEndpointBySquare(Long squareId) {
        if (state.currentState() == null || squareId == null) {
            return null;
        }
        for (DungeonEndpoint endpoint : state.currentState().endpoints()) {
            if (squareId.equals(endpoint.squareId())) {
                return endpoint;
            }
        }
        return null;
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

    private String findEndpointName(Long endpointId) {
        if (state.currentState() != null) {
            for (DungeonEndpoint endpoint : state.currentState().endpoints()) {
                if (endpointId.equals(endpoint.endpointId())) {
                    String name = endpoint.name();
                    return (name != null && !name.isBlank()) ? name : "#" + endpointId;
                }
            }
        }
        return "#" + endpointId;
    }

    private String findPassageName(Long passageId) {
        if (state.currentState() != null) {
            for (DungeonPassage passage : state.currentState().passages()) {
                if (passageId.equals(passage.passageId())) {
                    String name = passage.name();
                    return (name != null && !name.isBlank()) ? name : "#" + passageId;
                }
            }
        }
        return "#" + passageId;
    }
}
