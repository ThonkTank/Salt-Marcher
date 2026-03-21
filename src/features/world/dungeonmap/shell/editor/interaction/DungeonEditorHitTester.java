package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.model.DungeonLayout;
import javafx.geometry.Point2D;

public interface DungeonEditorHitTester {

    DungeonEditorHitTarget hitTest(DungeonLayout layout, Point2D canvasPoint, DungeonCanvasCamera camera);
}
