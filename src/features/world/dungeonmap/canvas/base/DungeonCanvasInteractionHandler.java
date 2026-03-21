package features.world.dungeonmap.canvas.base;

public interface DungeonCanvasInteractionHandler {

    boolean handlePressed(DungeonCanvasPointerEvent event);

    boolean handleDragged(DungeonCanvasPointerEvent event);

    boolean handleReleased(DungeonCanvasPointerEvent event);
}
