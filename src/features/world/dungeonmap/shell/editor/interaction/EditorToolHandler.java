package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import javafx.scene.Node;

import java.util.Set;

public sealed interface EditorToolHandler
        permits SelectionToolHandler, RoomPaintToolHandler, BoundaryToolHandler,
                CorridorToolHandler, StairToolHandler, TransitionToolHandler {

    Set<DungeonEditorTool> supportedTools();

    void activate(DungeonEditorTool tool);

    void deactivate();

    boolean handlePressed(DungeonCanvasPointerEvent event);

    boolean handleDragged(DungeonCanvasPointerEvent event);

    boolean handleReleased(DungeonCanvasPointerEvent event);

    Node statePaneContent();

    void setRefreshCallback(Runnable callback);
}
