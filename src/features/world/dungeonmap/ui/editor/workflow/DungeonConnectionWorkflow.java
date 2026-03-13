package features.world.dungeonmap.ui.editor.workflow;

import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonEndpointRole;
import features.world.dungeonmap.model.DungeonLinkAnchor;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.service.DungeonMapCommandService;
import features.world.dungeonmap.service.editing.DungeonLinkCreateResult;
import features.world.dungeonmap.service.editing.DungeonLinkCreateStatus;
import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.DungeonUiAsyncSupport;
import features.world.dungeonmap.ui.editor.inspector.actions.DungeonConnectionInspectorActions;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorTool;
import features.world.dungeonmap.ui.editor.controls.PassageEditorMode;
import features.world.dungeonmap.ui.editor.state.DungeonEditorInteractionState;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import features.world.dungeonmap.ui.editor.state.DungeonSelectionRestoreRequest;
import javafx.scene.Node;
import ui.async.UiErrorReporter;
import ui.components.ConfirmationDropdown;

import java.util.function.Consumer;

final class DungeonConnectionWorkflow implements DungeonConnectionInspectorActions {

    private final DungeonEditorState state;
    private final DungeonEditorInteractionState interactionState;
    private final DungeonMapPane canvas;
    private final DungeonSelectionController selectionController;
    private final DungeonLinkFlow linkFlow;
    private final EditorMessageBus workflowMessageBus;
    private final DungeonMapCommandService commands;
    private final ConfirmationDropdown confirmationDropdown = new ConfirmationDropdown();
    private final Consumer<DungeonSelectionRestoreRequest> reloadCurrentMap;

    public DungeonConnectionWorkflow(
            DungeonEditorState state,
            DungeonEditorInteractionState interactionState,
            DungeonMapPane canvas,
            DungeonSelectionController selectionController,
            DungeonLinkFlow linkFlow,
            EditorMessageBus workflowMessageBus,
            DungeonMapCommandService commands,
            Consumer<DungeonSelectionRestoreRequest> reloadCurrentMap
    ) {
        this.state = state;
        this.interactionState = interactionState;
        this.canvas = canvas;
        this.selectionController = selectionController;
        this.linkFlow = linkFlow;
        this.workflowMessageBus = workflowMessageBus;
        this.commands = commands;
        this.reloadCurrentMap = reloadCurrentMap == null ? ignored -> { } : reloadCurrentMap;
    }

    public void handleEndpointClick(DungeonEndpoint endpoint) {
        if (interactionState.activeTool() == DungeonEditorTool.LINK) {
            linkFlow.beginOrCompleteLink(
                    DungeonLinkAnchor.endpoint(endpoint.endpointId()),
                    state.currentMapId(),
                    (mapId, fromId, toId) -> DungeonUiAsyncSupport.submitValue(
                            () -> commands.createLink(mapId, fromId, toId, ""),
                            this::handleLinkCreateResult,
                            ex -> UiErrorReporter.reportBackgroundFailure("DungeonConnectionWorkflow.createLink()", ex)));
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
            linkFlow.beginOrCompleteLink(
                    DungeonLinkAnchor.passage(existing.passageId()),
                    state.currentMapId(),
                    (mapId, fromAnchor, toAnchor) -> DungeonUiAsyncSupport.submitValue(
                            () -> commands.createLink(mapId, fromAnchor, toAnchor, ""),
                            this::handleLinkCreateResult,
                            ex -> UiErrorReporter.reportBackgroundFailure("DungeonConnectionWorkflow.createLink()", ex)));
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
                        () -> commands.deletePassage(existing.passageId()),
                        () -> reloadCurrentMap.accept(null),
                        ex -> UiErrorReporter.reportBackgroundFailure("DungeonConnectionWorkflow.deletePassageImmediate()", ex));
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

    @Override
    public void saveEndpoint(DungeonEndpoint endpoint) {
        DungeonUiAsyncSupport.submitValue(
                () -> commands.saveEndpoint(endpoint),
                ignored -> reloadCurrentMap.accept(null),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConnectionWorkflow.saveEndpoint()", ex));
    }

    @Override
    public void deleteEndpoint(Long endpointId, Node anchor) {
        if (endpointId == null) {
            return;
        }
        confirmDelete(
                anchor,
                "Übergang löschen",
                "Übergang '" + findEndpointName(endpointId) + "' löschen? Alle verbundenen Links werden ebenfalls entfernt.",
                () -> DungeonUiAsyncSupport.submitAction(
                        () -> commands.deleteEndpoint(endpointId),
                        () -> reloadCurrentMap.accept(null),
                        ex -> UiErrorReporter.reportBackgroundFailure("DungeonConnectionWorkflow.deleteEndpoint()", ex)));
    }

    @Override
    public void deleteLink(Long linkId) {
        if (linkId == null) {
            return;
        }
        DungeonUiAsyncSupport.submitAction(
                () -> commands.deleteLink(linkId),
                () -> reloadCurrentMap.accept(null),
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConnectionWorkflow.deleteLink()", ex));
    }

    @Override
    public void updateLinkLabel(long linkId, String label, Runnable onSuccess) {
        Runnable effectiveOnSuccess = onSuccess == null ? () -> reloadCurrentMap.accept(null) : onSuccess;
        DungeonUiAsyncSupport.submitAction(
                () -> commands.updateLinkLabel(linkId, label),
                effectiveOnSuccess,
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConnectionWorkflow.updateLinkLabel()", ex));
    }

    @Override
    public void savePassage(DungeonPassage passage) {
        DungeonUiAsyncSupport.submitValue(
                () -> commands.savePassage(passage),
                passageId -> {
                    reloadCurrentMap.accept(DungeonSelectionRestoreRequest.passage(passageId));
                },
                ex -> UiErrorReporter.reportBackgroundFailure("DungeonConnectionWorkflow.savePassage()", ex));
    }

    @Override
    public void deletePassage(Long passageId, Node anchor) {
        if (passageId == null) {
            return;
        }
        confirmDelete(
                anchor,
                "Kante zurücksetzen",
                "Kante '" + findPassageName(passageId) + "' löschen? Danach ist die Wand wieder geschlossen.",
                () -> DungeonUiAsyncSupport.submitAction(
                        () -> commands.deletePassage(passageId),
                        () -> reloadCurrentMap.accept(null),
                        ex -> UiErrorReporter.reportBackgroundFailure("DungeonConnectionWorkflow.deletePassage()", ex)));
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
            workflowMessageBus.showMessage("Linkerstellung", "Linkerstellung abgebrochen: Bitte zwei verschiedene Verbindungen wählen.");
            return;
        }
        if (result.status() == DungeonLinkCreateStatus.DUPLICATE) {
            workflowMessageBus.showMessage("Linkerstellung", "Diese beiden Verbindungen sind bereits verbunden.");
            return;
        }
        if (result.status() == DungeonLinkCreateStatus.INVALID_ANCHOR) {
            workflowMessageBus.showMessage("Linkerstellung", "Linkerstellung abgebrochen: Mindestens eine Verbindung ist nicht mehr gültig.");
        }
    }

    private DungeonEndpoint findEndpointBySquare(Long squareId) {
        if (squareId == null) {
            return null;
        }
        for (DungeonEndpoint endpoint : state.index().endpointsById().values()) {
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
        DungeonEndpoint endpoint = state.findEndpoint(endpointId);
        if (endpoint != null) {
            String name = endpoint.name();
            return (name != null && !name.isBlank()) ? name : "#" + endpointId;
        }
        return "#" + endpointId;
    }

    private String findPassageName(Long passageId) {
        DungeonPassage passage = state.findPassage(passageId);
        if (passage != null) {
            String name = passage.name();
            return (name != null && !name.isBlank()) ? name : "#" + passageId;
        }
        return "#" + passageId;
    }
}
