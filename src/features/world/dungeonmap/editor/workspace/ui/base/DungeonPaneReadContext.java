package features.world.dungeonmap.editor.workspace.ui.base;

import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.view.model.DungeonSelection;
import features.world.dungeonmap.canvas.rendering.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.rendering.DungeonLayoutRenderData;

public interface DungeonPaneReadContext {
    DungeonLayout dungeonLayout();
    DungeonLayoutRenderData renderData();
    DungeonCanvasCamera camera();
    DungeonSelection selectedTarget();
}
