package features.world.dungeon.canvas.base;

import features.world.dungeon.dungeonmap.model.DungeonMap;
import javafx.scene.canvas.GraphicsContext;

public interface DungeonSceneRenderer {

    void render(
            GraphicsContext gc,
            double width,
            double height,
            DungeonSceneFrame frame);
}
