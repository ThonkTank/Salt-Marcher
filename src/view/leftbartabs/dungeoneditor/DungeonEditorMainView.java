package src.view.leftbartabs.dungeoneditor;

import java.util.function.Consumer;
import src.view.slotcontent.main.dungeonmap.DungeonMapView;
import src.view.slotcontent.primitives.mapcanvas.CanvasPointerEvent;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasPoint;

final class DungeonEditorMainView extends DungeonMapView {

    private Consumer<DungeonEditorMainViewInputEvent> viewInputEventHandler = ignored -> {};

    DungeonEditorMainView() {
        onPrimaryPressed(event -> {
            viewInputEventHandler.accept(pointerPressed(event));
            return true;
        });
        onPrimaryDragged(event -> viewInputEventHandler.accept(pointerDragged(event)));
        onPrimaryReleased(event -> viewInputEventHandler.accept(pointerReleased(event)));
        onPointerMoved(event -> viewInputEventHandler.accept(pointerMoved(event)));
        onLevelScrolled(levelDelta -> viewInputEventHandler.accept(
                new DungeonEditorMainViewInputEvent(
                        "",
                        0.0,
                        0.0,
                        false,
                        false,
                        "",
                        levelDelta)));
    }

    void onViewInputEvent(Consumer<DungeonEditorMainViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> {} : handler;
    }

    private static DungeonEditorMainViewInputEvent pointerPressed(CanvasPointerEvent event) {
        return newPointerEvent("PRESS", event);
    }

    private static DungeonEditorMainViewInputEvent pointerDragged(CanvasPointerEvent event) {
        return newPointerEvent("DRAG", event);
    }

    private static DungeonEditorMainViewInputEvent pointerReleased(CanvasPointerEvent event) {
        return newPointerEvent("RELEASE", event);
    }

    private static DungeonEditorMainViewInputEvent pointerMoved(CanvasPointerEvent event) {
        return newPointerEvent("MOVE", event);
    }

    private static DungeonEditorMainViewInputEvent newPointerEvent(
            String pointerPhaseKey,
            CanvasPointerEvent event
    ) {
        CanvasPointerEvent safeEvent = event == null
                ? new CanvasPointerEvent(
                CanvasPointerEvent.PointerPhase.MOVE,
                new CanvasPointerEvent.CanvasButtons(false, false),
                new CanvasPointerEvent.CanvasModifiers(false, false, false),
                new MapCanvasPoint(0.0, 0.0),
                null)
                : event;
        CanvasPointerEvent.CanvasHit hit = safeEvent.hit();
        String hitRef = hit == null || hit.hitRef() == null ? "" : hit.hitRef();
        return new DungeonEditorMainViewInputEvent(
                pointerPhaseKey,
                safeEvent.canvasPoint().x(),
                safeEvent.canvasPoint().y(),
                safeEvent.buttons().primaryButtonDown(),
                safeEvent.buttons().secondaryButtonDown(),
                hitRef,
                0);
    }
}
