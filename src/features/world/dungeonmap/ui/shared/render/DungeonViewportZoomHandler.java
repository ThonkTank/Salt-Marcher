package features.world.dungeonmap.ui.shared.render;

@FunctionalInterface
public interface DungeonViewportZoomHandler {

    void handle(double screenX, double screenY, double factor);
}
