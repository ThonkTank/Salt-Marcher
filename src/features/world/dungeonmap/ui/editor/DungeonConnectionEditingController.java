package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonEndpointRole;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.service.DungeonMapEditorService;
import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorControls;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorTool;
import javafx.scene.Node;
import ui.async.UiErrorReporter;
import ui.components.ConfirmationDropdown;

import java.util.function.Consumer;

final class DungeonConnectionEditingController {

    private final DungeonEditorState state;
    private final DungeonEditorApplicationService applicationService;
    private final DungeonMapPane canvas;
    private final DungeonEditorControls controls;
    private final DungeonSelectionWorkflowController selectionController;
    private final ConfirmationDropdown confirmationDropdown = new ConfirmationDropdown();
    private Consumer<DungeonSelectionRestoreRequest> reloadCurrentMap = ignored -> { };

    DungeonConnectionEditingController(
            DungeonEditorState state,
            DungeonEditorApplicationService applicationService,
            DungeonMapPane canvas,
            DungeonEditorControls controls,
            DungeonSelectionWorkflowController selectionController
    ) {
        this.state = state;
        this.applicationService = applicationService;
        this.canvas = canvas;
        this.controls = controls;
        this.selectionController = selectionController;
    }

    void setReloadCurrentMap(Consumer<DungeonSelectionRestoreRequest> reloadCurrentMap) {
        this.reloadCurrentMap = reloadCurrentMap == null ? ignored -> { } : reloadCurrentMap;
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
                        ex -> UiErrorReporter.reportBackgroundFailure("DungeonConnectionEditingController.createLink()", ex)));
    }

    void handleEdgeClick(DungeonMapPane.EdgeInteraction interaction) {
        if (controls.getActiveTool() != DungeonEditorTool.PASSAGE) {
            return;
        }
        DungeonPassage existing = interaction.existingPassage();
        if (existing != null) {
            selectionController.selectPassage(existing);
            return;
        }
        if (interaction.existingWall() == null) {
            canvas.flashInvalidEdge(interaction);
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
                "",
                "",
                null));
    }

    void createOrSelectEndpoint(DungeonSquare square) {
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

    void saveEndpoint(DungeonEndpoint endpoint) {
        applicationService.saveEndpoint(
                endpoint,
                ignored -> reloadCurrentMap.accept(null),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConnectionEditingController.saveEndpoint()", ex));
    }

    void deleteEndpoint(Long endpointId, Node anchor) {
        if (endpointId == null) {
            return;
        }
        confirmDelete(
                anchor,
                "Übergang löschen",
                "Übergang '" + findEndpointName(endpointId) + "' löschen? Alle verbundenen Links werden ebenfalls entfernt.",
                () -> applicationService.deleteEndpoint(
                        endpointId,
                        () -> reloadCurrentMap.accept(null),
                        ex -> UiErrorReporter.reportBackgroundFailure("DungeonConnectionEditingController.deleteEndpoint()", ex)));
    }

    void deleteLink(Long linkId) {
        if (linkId == null) {
            return;
        }
        applicationService.deleteLink(
                linkId,
                () -> reloadCurrentMap.accept(null),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConnectionEditingController.deleteLink()", ex));
    }

    void updateLinkLabel(long linkId, String label, Runnable onSuccess) {
        applicationService.updateLinkLabel(
                linkId,
                label,
                onSuccess,
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConnectionEditingController.updateLinkLabel()", ex));
    }

    void savePassage(DungeonPassage passage) {
        applicationService.savePassage(
                passage,
                passageId -> {
                    reloadCurrentMap.accept(DungeonSelectionRestoreRequest.passage(passageId));
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConnectionEditingController.savePassage()", ex));
    }

    void deletePassage(Long passageId, Node anchor) {
        if (passageId == null) {
            return;
        }
        confirmDelete(
                anchor,
                "Kante zurücksetzen",
                "Kante '" + findPassageName(passageId) + "' löschen? Danach ist die Wand wieder geschlossen.",
                () -> applicationService.deletePassage(
                        passageId,
                        () -> reloadCurrentMap.accept(null),
                        ex -> UiErrorReporter.reportBackgroundFailure("DungeonConnectionEditingController.deletePassage()", ex)));
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

    private void handleLinkCreateResult(DungeonMapEditorService.LinkCreateResult result) {
        if (result == null) {
            return;
        }
        if (result.status() == DungeonMapEditorService.LinkCreateStatus.CREATED) {
            reloadCurrentMap.accept(null);
            return;
        }
        if (result.status() == DungeonMapEditorService.LinkCreateStatus.SAME_ENDPOINT) {
            selectionController.showWorkflowMessage("Linkerstellung", "Linkerstellung abgebrochen: Bitte zwei verschiedene Übergänge wählen.");
            return;
        }
        if (result.status() == DungeonMapEditorService.LinkCreateStatus.DUPLICATE) {
            selectionController.showWorkflowMessage("Linkerstellung", "Diese beiden Übergänge sind bereits verbunden.");
            return;
        }
        if (result.status() == DungeonMapEditorService.LinkCreateStatus.INVALID_ENDPOINT) {
            selectionController.showWorkflowMessage("Linkerstellung", "Linkerstellung abgebrochen: Mindestens ein Übergang ist nicht mehr gültig.");
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

    private void confirmDelete(Node anchor, String title, String message, Runnable onConfirm) {
        confirmationDropdown.show(anchor, title, message, "Löschen", () -> {
            confirmationDropdown.hide();
            onConfirm.run();
        });
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
