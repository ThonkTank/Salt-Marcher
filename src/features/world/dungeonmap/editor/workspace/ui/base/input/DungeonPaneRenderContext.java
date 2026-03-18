package features.world.dungeonmap.editor.workspace.ui.base.input;

import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorTool;
import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.workspace.ui.corridor.CorridorEditInteractionController;
import features.world.dungeonmap.editor.workspace.ui.base.input.DungeonPaneInteractionState;
import features.world.dungeonmap.foundation.geometry.Point2i;
import javafx.scene.input.MouseEvent;

import java.util.Set;

public interface DungeonPaneRenderContext {
    void transitionToTool(DungeonEditorTool editorTool, CorridorDoorHandle selectedCorridorDoorHandle);
    void transitionToShownLayout(CorridorDoorHandle selectedCorridorDoorHandle);
    void transitionToUpdatedSelection(CorridorDoorHandle selectedCorridorDoorHandle);
    boolean clearCorridorDoorPreview();
    boolean clearHoveredCorridor();
    void requestRender();
    void applySelectedCorridorDoorHandle(CorridorDoorHandle handle, boolean renderNow);
    void updatePointerPosition(MouseEvent event);
    boolean updateCorridorPressMode(MouseEvent event);
    boolean updateHoveredCorridorAt(double screenX, double screenY);
    void refreshHoverAfterProjectionChange();
    void beginSelection(Point2i world);
    void updateSelectionPreview(Point2i world);
    void commitSelection(Point2i start, Point2i end);
    void beginPaint(Point2i world);
    void updatePaintPreview(Point2i world);
    void commitPaint(Point2i world);
    void updateDragPreview(DungeonPaneInteractionState.DragInteraction dragInteraction);
    void commitDrag(DungeonPaneInteractionState.DragInteraction dragInteraction);
    void onPointerExited();
}
