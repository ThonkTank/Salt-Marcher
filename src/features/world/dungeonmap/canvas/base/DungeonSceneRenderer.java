package features.world.dungeonmap.canvas.base;

import features.world.dungeonmap.model.DungeonLayout;
import javafx.scene.canvas.GraphicsContext;

public interface DungeonSceneRenderer {

    void render(
            GraphicsContext gc,
            double width,
            double height,
            DungeonSceneFrame frame);
}
