package features.world.dungeonmap.ui.editor.workflow;

import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonEndpointRole;
import features.world.dungeonmap.model.DungeonLinkAnchor;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.application.DungeonLinkCreateResult;
import features.world.dungeonmap.application.DungeonLinkCreateStatus;
import features.world.dungeonmap.service.DungeonMapEditorService;
import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.DungeonUiAsyncSupport;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorTool;
import features.world.dungeonmap.ui.editor.controls.PassageEditorMode;
import features.world.dungeonmap.ui.editor.state.DungeonEditorInteractionState;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import features.world.dungeonmap.ui.editor.state.DungeonSelectionRestoreRequest;
import javafx.scene.Node;
import ui.async.UiErrorReporter;
import ui.components.ConfirmationDropdown;

import java.util.function.Consumer;

public final class DungeonConnectionEditingController {

    private final DungeonEditorState state;
    private final DungeonEditorInteractionState interactionState;
    private final DungeonMapPane canvas;
    private final DungeonSelectionWorkflowController selectionController;
    private final DungeonLinkWorkflowController linkWorkflowController;
    private final DungeonWorkflowMessageController workflowMessageController;
    private final ConfirmationDropdown confirmationDropdown = new ConfirmationDropdown();
    private Consumer<DungeonSelectionRestoreRequest> reloadCurrentMap = ignored -> { };

    public DungeonConnectionEditingController(
            DungeonEditorState state,
            DungeonEditorInteractionState interactionState,
            DungeonMapPane canvas,
            DungeonSelectionWorkflowController selectionController,
            DungeonLinkWorkflowController linkWorkflowController,
            DungeonWorkflowMessageController workflowMessageController
    ) {
        this.state = state;
        this.interactionState = interactionState;
        this.canvas = canvas;
        this.selectionController = selectionController;
        this.linkWorkflowController = linkWorkflowController;
        this.workflowMessageController = workflowMessageController;
    }

    public void setReloadCurrentMap(Consumer<DungeonSelectionRestoreRequest> reloadCurrentMap) {
        this.reloadCurrentMap = reloadCurrentMap == null ? ignored -> { } : reloadCurrentMap;
    }

    public void handleEndpointClick(DungeonEndpoint endpoint) {
        if (interactionState.activeTool() == DungeonEditorTool.LINK) {
            linkWorkflowController.beginOrCompleteLink(
                    DungeonLinkAnchor.endpoint(endpoint.endpointId()),
                    state.currentMapId(),
                    (mapId, fromId, toId) -> DungeonUiAsyncSupport.submitValue(
                            () -> DungeonMapEditorService.createLink(mapId, fromId, toId, ""),
                            this::handleLinkCreateResult,
                            ex -> UiErrorReporter.reportBackgroundFailure("DungeonConnectionEditingController.createLink()", ex)));
            return;
        }
        selectionController.showEndpointSelection(endpoint);
    }

    public void handleEdgeClick(DungeonMapPane.EdgeInteraction interaction) {
        DungeonPassage existing = interaction.edge().passage();
        if (interactionState.activeTool() == DungeonEditorTool.LINK) {
            if (existing == null || existing.passageId() == null) {
                canvas.flashInvalidEdge(interaction);
                return;
            }
            linkWorkflowController.beginOrCompleteLink(
                    DungeonLinkAnchor.passage(existing.passageId()),
                    state.currentMapId(),
                    (mapId, fromAnchor, toAnchor) -> DungeonUiAsyncSupport.submitValue(
                            () -> DungeonMapEditorService.createLink(mapId, fromAnchor, toAnchor, ""),
                            this::handleLinkCreateResult,
                            ex -> UiErrorReporter.reportBackgroundFailure("DungeonConnectionEditingController.createLink()", ex)));
            return;
        }
        if (interactionState.activeTool() != DungeonEditorTool.PASSAGE) {
            return;
        }
        var edge = interaction.edge();
        PassageEditorMode mode = interactionState.passageEditorMode();
        if (mode.deletesPassages()) {
            if (existing != null && existing.passageId() != null) {
                DungeonUiAsyncSupport.submitAction(
                        () -> DungeonMapEditorService.deletePassage(existing.passageId()),
                        () -> reloadCurrentMap.accept(null),
                        ex -> UiErrorReporter.reportBackgroundFailure("DungeonConnectionEditingController.deletePassageImmediate()", ex));
            }
            return;
        }
        if (existing != null) {
            selectionController.selectPassage(existing);
            return;
        }
        if (!interaction.edge().canCreatePassage()) {
            canvas.flashInvalidEdge(interaction);
            return;
        }
        if (state.currentMapId() == null) {
            return;
        }
        savePassage(new DungeonPassage(
                null,
                state.currentMapId(),
                edge.x(),
                edge.y(),
                edge.direction(),
                "",
                "",
                null));
    }

    public void createOrSelectEndpoint(DungeonSquare square) {
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

    public void saveEndpoint(DungeonEndpoint endpoint) {
        DungeonUiAsyncSupport.submitValue(
                () -> DungeonMapEditorService.saveEndpoint(endpoint),
                ignored -> reloadCurrentMap.accept(null),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConnectionEditingController.saveEndpoint()", ex));
    }

    public void deleteEndpoint(Long endpointId, Node anchor) {
        if (endpointId == null) {
            return;
        }
        confirmDelete(
                anchor,
                "Übergang löschen",
                "Übergang '" + findEndpointName(endpointId) + "' löschen? Alle verbundenen Links werden ebenfalls entfernt.",
                () -> DungeonUiAsyncSupport.submitAction(
                        () -> DungeonMapEditorService.deleteEndpoint(endpointId),
                        () -> reloadCurrentMap.accept(null),
                        ex -> UiErrorReporter.reportBackgroundFailure("DungeonConnectionEditingController.deleteEndpoint()", ex)));
    }

    public void deleteLink(Long linkId) {
        if (linkId == null) {
            return;
        }
        DungeonUiAsyncSupport.submitAction(
                () -> DungeonMapEditorService.deleteLink(linkId),
                () -> reloadCurrentMap.accept(null),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConnectionEditingController.deleteLink()", ex));
    }

    public void updateLinkLabel(long linkId, String label, Runnable onSuccess) {
        Runnable effectiveOnSuccess = onSuccess == null ? () -> reloadCurrentMap.accept(null) : onSuccess;
        DungeonUiAsyncSupport.submitAction(
                () -> DungeonMapEditorService.updateLinkLabel(linkId, label),
                effectiveOnSuccess,
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConnectionEditingController.updateLinkLabel()", ex));
    }

    public void savePassage(DungeonPassage passage) {
        DungeonUiAsyncSupport.submitValue(
                () -> DungeonMapEditorService.savePassage(passage),
                passageId -> {
                    reloadCurrentMap.accept(DungeonSelectionRestoreRequest.passage(passageId));
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConnectionEditingController.savePassage()", ex));
    }

    public void deletePassage(Long passageId, Node anchor) {
        if (passageId == null) {
            return;
        }
        confirmDelete(
                anchor,
                "Kante zurücksetzen",
                "Kante '" + findPassageName(passageId) + "' löschen? Danach ist die Wand wieder geschlossen.",
                () -> DungeonUiAsyncSupport.submitAction(
                        () -> DungeonMapEditorService.deletePassage(passageId),
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

    private void handleLinkCreateResult(DungeonLinkCreateResult result) {
        if (result == null) {
            return;
        }
        if (result.status() == DungeonLinkCreateStatus.CREATED) {
            reloadCurrentMap.accept(null);
            return;
        }
        if (result.status() == DungeonLinkCreateStatus.SAME_ANCHOR) {
            workflowMessageController.showMessage("Linkerstellung", "Linkerstellung abgebrochen: Bitte zwei verschiedene Verbindungen wählen.");
            return;
        }
        if (result.status() == DungeonLinkCreateStatus.DUPLICATE) {
            workflowMessageController.showMessage("Linkerstellung", "Diese beiden Verbindungen sind bereits verbunden.");
            return;
        }
        if (result.status() == DungeonLinkCreateStatus.INVALID_ANCHOR) {
            workflowMessageController.showMessage("Linkerstellung", "Linkerstellung abgebrochen: Mindestens eine Verbindung ist nicht mehr gültig.");
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
