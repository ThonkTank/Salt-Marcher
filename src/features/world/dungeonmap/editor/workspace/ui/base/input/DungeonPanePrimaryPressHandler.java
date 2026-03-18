package features.world.dungeonmap.editor.workspace.ui.base.input;

import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorTool;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorSurface;
import features.world.dungeonmap.editor.workspace.ui.base.input.DungeonPaneRenderContext;
import features.world.dungeonmap.corridors.model.DungeonCorridorEndpoint;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;

final class DungeonPanePrimaryPressHandler {

    private final DungeonPanePointerProjection projection;
    private final DungeonPaneGridPointerProjection gridProjection;
    private final DungeonPaneGraphCreationProjection graphCreationProjection;
    private final DungeonPaneInputContext interaction;
    private final DungeonPaneRenderContext render;

    DungeonPanePrimaryPressHandler(
            DungeonPanePointerProjection projection,
            DungeonPaneGridPointerProjection gridProjection,
            DungeonPaneGraphCreationProjection graphCreationProjection,
            DungeonPaneInputContext interaction,
            DungeonPaneRenderContext render
    ) {
        this.projection = projection;
        this.gridProjection = gridProjection;
        this.graphCreationProjection = graphCreationProjection;
        this.interaction = interaction;
        this.render = render;
    }

    boolean handle(MouseEvent event, DungeonPanePointerHit hit) {
        return handleRoomToolPress(event, hit)
                || handleCorridorToolPress(event, hit)
                || handleRoomDragPress(event, hit)
                || handleSelectionPress(event, hit)
                || handlePassiveSelection(hit);
    }

    private boolean handleRoomToolPress(MouseEvent event, DungeonPanePointerHit hit) {
        if (!interaction.editable() || event.getButton() != MouseButton.PRIMARY) {
            return false;
        }
        if ((interaction.editorTool().isWallTool() || interaction.editorTool().isDoorTool())
                && interaction.surface() == DungeonEditorSurface.GRID) {
            var edgeRef = gridProjection.findClusterEdgeAt(event.getX(), event.getY());
            if (edgeRef == null) {
                return false;
            }
            if (interaction.editorTool().isWallTool()) {
                interaction.wallPathController().handlePrimaryPress(event.getX(), event.getY());
            } else if (interaction.editorTool() == DungeonEditorTool.CLUSTER_DOOR_DELETE) {
                interaction.events().onClusterDoorDeleted(java.util.Set.of(edgeRef));
            } else {
                interaction.events().onClusterDoorPainted(java.util.Set.of(edgeRef));
            }
            return true;
        }
        if (interaction.editorTool() != DungeonEditorTool.ROOM_PAINT && interaction.editorTool() != DungeonEditorTool.ROOM_DELETE) {
            return false;
        }
        if (interaction.surface() == DungeonEditorSurface.GRID) {
            interaction.interactionState().setPointerInteraction(new DungeonPaneInteractionState.PaintInteraction(hit.world()));
            render.beginPaint(hit.world());
            return true;
        }
        if (interaction.surface() != DungeonEditorSurface.GRAPH) {
            return false;
        }
        if (interaction.editorTool() == DungeonEditorTool.ROOM_PAINT
                && hit.cluster() == null
                && hit.room() == null
                && graphCreationProjection.canCreateGraphRoomAt(hit.world())) {
            interaction.interactionState().setPointerInteraction(new DungeonPaneInteractionState.GraphCreateInteraction(hit.world()));
            return true;
        }
        if (interaction.editorTool() == DungeonEditorTool.ROOM_DELETE && hit.cluster() != null) {
            interaction.interactionState().setPointerInteraction(new DungeonPaneInteractionState.GraphDeleteInteraction(hit.cluster()));
            return true;
        }
        return false;
    }

    private boolean handleCorridorToolPress(MouseEvent event, DungeonPanePointerHit hit) {
        if (!interaction.editable() || event.getButton() != MouseButton.PRIMARY) {
            return false;
        }
        if (interaction.editorTool() != DungeonEditorTool.CORRIDOR_CREATE && interaction.editorTool() != DungeonEditorTool.CORRIDOR_DELETE) {
            return false;
        }
        if (interaction.editorTool() == DungeonEditorTool.CORRIDOR_CREATE) {
            DungeonCorridorEndpoint endpoint = projection.corridorEndpointLocationAt(event.getX(), event.getY(), hit.room(), hit.corridor());
            if (endpoint != null) {
                interaction.events().onCorridorEndpointSelected(endpoint);
                return true;
            }
            if (hit.corridor() != null) {
                interaction.events().onCorridorEndpointSelected(DungeonCorridorEndpoint.corridor(hit.corridor().corridorId()));
                return true;
            }
            return false;
        }
        if (hit.corridorDoorHit() != null) {
            interaction.events().onCorridorRoomRemoved(hit.corridorDoorHit());
            return true;
        }
        if (hit.corridor() != null) {
            interaction.events().onCorridorDeleted(hit.corridor());
            return true;
        }
        return false;
    }

    private boolean handleRoomDragPress(MouseEvent event, DungeonPanePointerHit hit) {
        if (!(interaction.editable() && hit.cluster() != null && isRoomDragButton(event.getButton(), interaction.editorTool()))) {
            return false;
        }
        interaction.events().onClusterSelected(hit.cluster());
        interaction.interactionState().setPointerInteraction(new DungeonPaneInteractionState.DragInteraction(
                hit.cluster(),
                hit.cluster().center(),
                projection.worldX(event.getX()),
                projection.worldY(event.getY())));
        return true;
    }

    private boolean handleSelectionPress(MouseEvent event, DungeonPanePointerHit hit) {
        if (!(interaction.editable()
                && event.getButton() == MouseButton.PRIMARY
                && interaction.editorTool() == DungeonEditorTool.SELECT
                && interaction.surface() == DungeonEditorSurface.GRID
                && hit.corridor() == null
                && hit.cluster() == null
                && hit.room() == null)) {
            return false;
        }
        interaction.interactionState().setPointerInteraction(new DungeonPaneInteractionState.SelectionInteraction(hit.world()));
        render.beginSelection(hit.world());
        return true;
    }

    private boolean handlePassiveSelection(DungeonPanePointerHit hit) {
        if (hit.corridor() != null) {
            interaction.events().onCorridorSelected(hit.corridor());
            return true;
        }
        if (hit.cluster() != null) {
            interaction.events().onClusterSelected(hit.cluster());
            return true;
        }
        if (hit.room() != null) {
            interaction.events().onRoomSelected(hit.room());
            return true;
        }
        interaction.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
        return true;
    }

    private static boolean isRoomDragButton(MouseButton button, DungeonEditorTool tool) {
        if (button == MouseButton.MIDDLE) {
            return true;
        }
        return button == MouseButton.PRIMARY && tool == DungeonEditorTool.SELECT;
    }
}
