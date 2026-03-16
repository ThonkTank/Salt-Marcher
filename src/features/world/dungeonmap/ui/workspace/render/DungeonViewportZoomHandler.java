package features.world.dungeonmap.ui.workspace.render;

@FunctionalInterface
public interface DungeonViewportZoomHandler {

    void handle(double screenX, double screenY, double factor);
}
