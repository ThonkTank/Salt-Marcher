package features.world.dungeonmap.canvas.base;

public interface DungeonCanvasInteractionHandler {

    default void handleMoved(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
    }

    boolean handlePressed(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera);

    boolean handleDragged(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera);

    boolean handleReleased(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera);

    default void handleExited() {
    }

    default void levelScrolled(int levelDelta) {
    }
}
