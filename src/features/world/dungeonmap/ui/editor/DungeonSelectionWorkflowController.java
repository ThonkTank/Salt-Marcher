package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonLink;
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
    private DetailsNavigator detailsNavigator;

    private Long pendingLinkStartId;

    DungeonSelectionWorkflowController(
            DungeonMapPane canvas,
            DungeonDetailsPane detailsPane,
            DungeonToolSettingsPane toolSettingsPane
    ) {
        this.canvas = canvas;
        this.detailsPane = detailsPane;
        this.toolSettingsPane = toolSettingsPane;
    }

    void updateToolMode(DungeonEditorTool tool) {
        boolean paintMode = tool == DungeonEditorTool.PAINT || tool == DungeonEditorTool.ERASE;
        canvas.setPaintMode(paintMode);
        canvas.setEraseMode(tool == DungeonEditorTool.ERASE);
        canvas.setHandMode(tool == DungeonEditorTool.ENDPOINT || tool == DungeonEditorTool.LINK);
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
                link));
    }

    void showEndpointSelection(DungeonEndpoint endpoint) {
        showSelection(new DungeonSelection(
                DungeonSelection.SelectionType.ENDPOINT,
                endpoint.endpointId(),
                null,
                null,
                null,
                endpoint,
                null));
    }

    void handleCellClick(
            DungeonEditorTool tool,
            DungeonMapPane.CellInteraction interaction,
            Long currentMapId,
            java.util.function.Consumer<DungeonSquare> onAssignRoomArea,
            java.util.function.Consumer<DungeonSquare> onCreateOrSelectEndpoint
    ) {
        switch (tool) {
            case SELECT -> selectSquare(interaction.square(), interaction.x(), interaction.y(), currentMapId);
            case AREA_ASSIGN -> {
                if (interaction.square() == null || interaction.square().roomId() == null) {
                    showInfoMessage("Bereich zuweisen", "Dieses Feld hat keinen Raum — erst Raum zuweisen.");
                } else {
                    onAssignRoomArea.accept(interaction.square());
                }
            }
            case ENDPOINT -> onCreateOrSelectEndpoint.accept(interaction.square());
            default -> selectSquare(interaction.square(), interaction.x(), interaction.y(), currentMapId);
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
                null));
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
                null));
    }

    private void showSelection(DungeonSelection selection) {
        canvas.setSelectedSelection(selection);
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
        if (detailsNavigator == null) {
            detailsPane.showSelection(selection);
            return;
        }
        detailsNavigator.showContent(selectionTitle(selection), selectionKey(selection), () -> {
            detailsPane.showSelection(selection);
            return detailsPane;
        });
    }

    private void showInfoMessage(String title, String message) {
        if (detailsNavigator == null) {
            detailsPane.showInfoMessage(message);
            return;
        }
        detailsNavigator.showContent(title, "dungeon-info:" + message, () -> {
            detailsPane.showInfoMessage(message);
            return detailsPane;
        });
    }

    private static String selectionTitle(DungeonSelection selection) {
        if (selection == null) return "Dungeon-Details";
        return switch (selection.type()) {
            case ROOM -> selection.room() != null && selection.room().name() != null && !selection.room().name().isBlank()
                    ? selection.room().name() : "Raum";
            case AREA -> selection.area() != null && selection.area().name() != null && !selection.area().name().isBlank()
                    ? selection.area().name() : "Bereich";
            case ENDPOINT -> selection.endpoint() != null && selection.endpoint().name() != null && !selection.endpoint().name().isBlank()
                    ? selection.endpoint().name() : "Knoten";
            case LINK -> "Link";
            case SQUARE -> "Feld";
            case NONE -> "Dungeon-Details";
        };
    }

    private static Object selectionKey(DungeonSelection selection) {
        if (selection == null) {
            return "dungeon:none";
        }
        return selection.type().name() + ":" + (selection.id() == null ? "none" : selection.id());
    }
}
