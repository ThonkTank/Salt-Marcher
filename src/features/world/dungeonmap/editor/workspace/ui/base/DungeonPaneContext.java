package features.world.dungeonmap.editor.workspace.ui.base;

import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.canvas.rendering.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.rendering.DungeonLayoutRenderData;

public interface DungeonPaneContext {

    DungeonLayout dungeonLayout();

    DungeonCanvasCamera camera();

    boolean layoutPresent();

    DungeonPaneSelectionState selectionState();

    DungeonLayoutRenderData layoutRenderData();

    DungeonPaneSceneState sceneState();
}
