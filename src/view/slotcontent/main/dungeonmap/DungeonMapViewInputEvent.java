package src.view.slotcontent.main.dungeonmap;

import src.view.slotcontent.primitives.mapcanvas.MapCanvasViewInputEvent;

public record DungeonMapViewInputEvent(
        MapCanvasViewInputEvent canvasEvent
) {

    public DungeonMapViewInputEvent {
        canvasEvent = canvasEvent == null
                ? new MapCanvasViewInputEvent(null, null, null, null, null, 0.0, 0.0, 0.0)
                : canvasEvent;
    }
}
