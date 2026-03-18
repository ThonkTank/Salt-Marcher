package features.world.dungeonmap.editor.workspace.ui.base.input;

import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorTool;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorSurface;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonPaneInteractionSink;
import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.workspace.ui.corridor.CorridorEditInteractionController;
import features.world.dungeonmap.editor.workspace.ui.wallpath.WallPathInteractionController;

public interface DungeonPaneInputContext {
    boolean editable();
    DungeonEditorTool editorTool();
    DungeonEditorSurface surface();
    DungeonPaneInteractionSink events();
    DungeonPaneInteractionState interactionState();
    DungeonPanePointerTracker pointerTracker();
    CorridorEditInteractionController controller();
    WallPathInteractionController wallPathController();
    CorridorDoorHandle selectedCorridorDoorHandle();
}
