package features.world.dungeonmap.canvas.base;

public interface DungeonCanvasInteractionHandler {

    boolean handlePressed(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera);

    boolean handleDragged(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera);

    boolean handleReleased(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera);

    default boolean handleLevelScroll(int levelDelta) {
        return false;
    }
}
