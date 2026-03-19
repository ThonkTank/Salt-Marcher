package features.world.quarantine.dungeonmap.editor.workspace;

import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.layout.model.DungeonSelection;
import features.world.quarantine.dungeonmap.canvas.viewport.DungeonCanvasCamera;
import features.world.quarantine.dungeonmap.canvas.state.DungeonLayoutRenderData;
import features.world.quarantine.dungeonmap.editor.workspace.pane.DungeonPaneSceneState;

public interface DungeonPaneContext {

    DungeonLayout dungeonLayout();
    DungeonLayoutRenderData renderData();
    DungeonCanvasCamera camera();

    boolean layoutPresent();

    DungeonPaneSceneState sceneState();

    default DungeonSelection selectedTarget() {
        return sceneState().selectedTarget();
    }
}
