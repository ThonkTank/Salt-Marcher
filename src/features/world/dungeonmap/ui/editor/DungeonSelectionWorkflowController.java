package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonLink;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorTool;
import features.world.dungeonmap.ui.editor.panes.DungeonDetailsPane;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;
import ui.shell.DetailsNavigator;

final class DungeonSelectionWorkflowController {

    @FunctionalInterface
    interface LinkCreator {
        void create(long mapId, long fromEndpointId, long toEndpointId);
    }

    private final DungeonMapPane canvas;
    private final DungeonDetailsPane detailsPane;
    private final DungeonToolSettingsPane toolSettingsPane;
    private final DungeonEditorState state;
    private DetailsNavigator detailsNavigator;

    private Long pendingLinkStartId;

    DungeonSelectionWorkflowController(
            DungeonMapPane canvas,
            DungeonDetailsPane detailsPane,
            DungeonToolSettingsPane toolSettingsPane,
            DungeonEditorState state
    ) {
        this.canvas = canvas;
        this.detailsPane = detailsPane;
        this.toolSettingsPane = toolSettingsPane;
        this.state = state;
    }

    void updateToolMode(DungeonEditorTool tool) {
        canvas.setActiveTool(tool);
        clearPendingLink();
        toolSettingsPane.setActiveTool(tool);
    }

    void cancelPendingLink() {
        clearPendingLink();
    }

    void setDetailsNavigator(DetailsNavigator detailsNavigator) {
        this.detailsNavigator = detailsNavigator;
    }

    void clearSelection() {
        showSelection(DungeonSelection.none());
    }

    void showLinkSelection(DungeonLink link) {
        showSelection(new DungeonSelection(
                DungeonSelection.SelectionType.LINK,
                link.linkId(),
                null,
                null,
                null,
                null,
                link,
                null));
    }

    void showEndpointSelection(DungeonEndpoint endpoint) {
        showSelection(new DungeonSelection(
                DungeonSelection.SelectionType.ENDPOINT,
                endpoint.endpointId(),
                null,
                null,
                null,
                endpoint,
                null,
                null));
    }

    void handleCellClick(
            DungeonEditorTool tool,
            DungeonMapPane.CellInteraction interaction,
            Long currentMapId,
            java.util.function.Consumer<DungeonSquare> onAssignRoomArea,
            java.util.function.Consumer<DungeonSquare> onCreateOrSelectEndpoint
    ) {
        switch (DungeonToolBehavior.forTool(tool).cellClickAction()) {
            case SELECT_SQUARE -> selectSquare(interaction.square(), interaction.x(), interaction.y(), currentMapId);
            case ASSIGN_ROOM_AREA -> {
                if (interaction.square() == null || interaction.square().roomId() == null) {
                    publishInfoMessage("Bereich zuweisen", "Dieses Feld hat keinen Raum — erst Raum zuweisen.");
                } else {
                    onAssignRoomArea.accept(interaction.square());
                }
            }
            case CREATE_OR_SELECT_ENDPOINT -> onCreateOrSelectEndpoint.accept(interaction.square());
        }
    }

    void handleEndpointClick(
            DungeonEditorTool tool,
            DungeonEndpoint endpoint,
            Long currentMapId,
            LinkCreator onCreateLink
    ) {
        if (tool == DungeonEditorTool.LINK) {
            if (pendingLinkStartId == null) {
                pendingLinkStartId = endpoint.endpointId();
                canvas.setPendingLinkStart(pendingLinkStartId);
                toolSettingsPane.showLinkPending(true);
                return;
            }
            Long fromId = pendingLinkStartId;
            clearPendingLink();
            if (currentMapId != null) {
                onCreateLink.create(currentMapId, fromId, endpoint.endpointId());
            }
            return;
        }
        showEndpointSelection(endpoint);
    }

    void selectRoom(DungeonRoom room) {
        if (room == null) {
            return;
        }
        showSelection(new DungeonSelection(
                DungeonSelection.SelectionType.ROOM,
                room.roomId(),
                null,
                room,
                null,
                null,
                null,
                null));
    }

    void selectArea(DungeonArea area) {
        if (area == null) {
            return;
        }
        showSelection(new DungeonSelection(
                DungeonSelection.SelectionType.AREA,
                area.areaId(),
                null,
                null,
                area,
                null,
                null,
                null));
    }

    void selectPassage(DungeonPassage passage) {
        if (passage == null) {
            return;
        }
        showSelection(new DungeonSelection(
                DungeonSelection.SelectionType.PASSAGE,
                passage.passageId(),
                null,
                null,
                null,
                null,
                null,
                passage));
    }

    private void selectSquare(DungeonSquare square, int x, int y, Long currentMapId) {
        DungeonSquare effectiveSquare = square;
        if (effectiveSquare == null && currentMapId != null) {
            effectiveSquare = new DungeonSquare(null, currentMapId, x, y, null, null, null, null);
        }
        showSelection(new DungeonSelection(
                DungeonSelection.SelectionType.SQUARE,
                null,
                effectiveSquare,
                null,
                null,
                null,
                null,
                null));
    }

    private void showSelection(DungeonSelection selection) {
        canvas.setSelectedSelection(selection);
        detailsPane.showSelection(selection);
        publishSelection(selection);
        if (selection.type() == DungeonSelection.SelectionType.ROOM && selection.room() != null) {
            toolSettingsPane.selectRoom(selection.room().roomId());
        } else if (selection.type() == DungeonSelection.SelectionType.AREA && selection.area() != null) {
            toolSettingsPane.selectArea(selection.area().areaId());
        } else if (selection.type() == DungeonSelection.SelectionType.SQUARE && selection.square() != null) {
            if (selection.square().roomId() != null) {
                toolSettingsPane.selectRoom(selection.square().roomId());
            }
            if (selection.square().areaId() != null) {
                toolSettingsPane.selectArea(selection.square().areaId());
            }
        }
    }

    private void clearPendingLink() {
        pendingLinkStartId = null;
        canvas.setPendingLinkStart(null);
        toolSettingsPane.showLinkPending(false);
    }

    private void publishSelection(DungeonSelection selection) {
        if (detailsNavigator == null || selection == null) {
            return;
        }
        switch (selection.type()) {
            case ROOM -> {
                if (selection.room() == null) {
                    detailsNavigator.clear();
                    return;
                }
                detailsNavigator.showDungeonRoom(new DetailsNavigator.DungeonRoomSummary(
                        selection.room().roomId(),
                        titleOrFallback(selection.room().name(), "Raum"),
                        selection.room().description(),
                        resolveAreaName(selection.room().areaId())));
            }
            case AREA -> {
                if (selection.area() == null) {
                    detailsNavigator.clear();
                    return;
                }
                detailsNavigator.showDungeonArea(new DetailsNavigator.DungeonAreaSummary(
                        selection.area().areaId(),
                        titleOrFallback(selection.area().name(), "Bereich"),
                        selection.area().description(),
                        selection.area().encounterTableName()));
            }
            case ENDPOINT -> {
                if (selection.endpoint() == null) {
                    detailsNavigator.clear();
                    return;
                }
                detailsNavigator.showDungeonEndpoint(new DetailsNavigator.DungeonEndpointSummary(
                        selection.endpoint().endpointId(),
                        titleOrFallback(selection.endpoint().name(), "Übergang"),
                        selection.endpoint().notes(),
                        endpointRoleLabel(selection.endpoint()),
                        selection.endpoint().defaultEntry(),
                        selection.endpoint().x(),
                        selection.endpoint().y()));
            }
            case LINK -> {
                if (selection.link() == null) {
                    detailsNavigator.clear();
                    return;
                }
                detailsNavigator.showDungeonLink(new DetailsNavigator.DungeonLinkSummary(
                        selection.link().linkId(),
                        selection.link().label(),
                        resolveEndpointName(selection.link().fromEndpointId()),
                        resolveEndpointName(selection.link().toEndpointId())));
            }
            case PASSAGE -> {
                if (selection.passage() == null || selection.passage().passageId() == null) {
                    detailsNavigator.clear();
                    return;
                }
                detailsNavigator.showDungeonPassage(new DetailsNavigator.DungeonPassageSummary(
                        selection.passage().passageId(),
                        selection.passage().name(),
                        selection.passage().notes(),
                        selection.passage().type() == null ? null : selection.passage().type().label(),
                        selection.passage().direction() == null ? null : selection.passage().direction().name(),
                        selection.passage().x(),
                        selection.passage().y(),
                        resolveEndpointName(selection.passage().endpointId())));
            }
            case SQUARE -> {
                if (selection.square() == null) {
                    detailsNavigator.clear();
                    return;
                }
                detailsNavigator.showDungeonSquare(new DetailsNavigator.DungeonSquareSummary(
                        selection.square().x(),
                        selection.square().y(),
                        selection.square().roomName(),
                        selection.square().areaName()));
            }
            case NONE -> detailsNavigator.clear();
        }
    }

    void publishInfoMessage(String title, String message) {
        detailsPane.showInfoMessage(message);
        if (detailsNavigator != null) {
            detailsNavigator.showInfo(title, "dungeon-info:" + message, message);
        }
    }

    private String resolveAreaName(Long areaId) {
        if (areaId == null || state.currentState() == null) {
            return null;
        }
        for (DungeonArea area : state.currentState().areas()) {
            if (areaId.equals(area.areaId())) {
                return area.name();
            }
        }
        return null;
    }

    private String resolveEndpointName(Long endpointId) {
        if (endpointId == null || state.currentState() == null) {
            return null;
        }
        for (DungeonEndpoint endpoint : state.currentState().endpoints()) {
            if (endpointId.equals(endpoint.endpointId())) {
                return titleOrFallback(endpoint.name(), "Übergang #" + endpointId);
            }
        }
        return "Übergang #" + endpointId;
    }

    private static String endpointRoleLabel(DungeonEndpoint endpoint) {
        if (endpoint == null || endpoint.role() == null) {
            return null;
        }
        return switch (endpoint.role()) {
            case ENTRY -> "Eingang";
            case EXIT -> "Ausgang";
            case BOTH -> "Ein- und Ausgang";
        };
    }

    private static String titleOrFallback(String value, String fallback) {
        return value != null && !value.isBlank() ? value : fallback;
    }
}
