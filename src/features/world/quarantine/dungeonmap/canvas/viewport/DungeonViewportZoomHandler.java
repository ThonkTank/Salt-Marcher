package features.world.quarantine.dungeonmap.canvas.viewport;

@FunctionalInterface
public interface DungeonViewportZoomHandler {

    void handle(double screenX, double screenY, double factor);
}
