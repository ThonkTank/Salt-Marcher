package features.world.dungeonmap.canvas.rendering;

@FunctionalInterface
public interface DungeonViewportZoomHandler {

    void handle(double screenX, double screenY, double factor);
}
