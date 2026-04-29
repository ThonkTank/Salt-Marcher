package src.view.leftbartabs.dungeoneditor;

import java.util.function.Consumer;
import src.view.slotcontent.main.dungeonmap.DungeonMapView;
import src.view.slotcontent.primitives.mapcanvas.CanvasPointerEvent;

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
                DungeonEditorMainViewInputEvent.levelScrolled(levelDelta)));
    }

    void onViewInputEvent(Consumer<DungeonEditorMainViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> {} : handler;
    }

    private static DungeonEditorMainViewInputEvent pointerPressed(CanvasPointerEvent event) {
        return newPointerEvent(DungeonEditorMainViewInputEvent.Kind.POINTER_PRESSED, event);
    }

    private static DungeonEditorMainViewInputEvent pointerDragged(CanvasPointerEvent event) {
        return newPointerEvent(DungeonEditorMainViewInputEvent.Kind.POINTER_DRAGGED, event);
    }

    private static DungeonEditorMainViewInputEvent pointerReleased(CanvasPointerEvent event) {
        return newPointerEvent(DungeonEditorMainViewInputEvent.Kind.POINTER_RELEASED, event);
    }

    private static DungeonEditorMainViewInputEvent pointerMoved(CanvasPointerEvent event) {
        return newPointerEvent(DungeonEditorMainViewInputEvent.Kind.POINTER_MOVED, event);
    }

    private static DungeonEditorMainViewInputEvent newPointerEvent(
            DungeonEditorMainViewInputEvent.Kind kind,
            CanvasPointerEvent event
    ) {
        CanvasPointerEvent safeEvent = event == null
                ? new CanvasPointerEvent(
                CanvasPointerEvent.PointerPhase.MOVE,
                new CanvasPointerEvent.CanvasButtons(false, false),
                new CanvasPointerEvent.CanvasModifiers(false, false, false),
                new CanvasPointerEvent.CanvasPoint(0.0, 0.0),
                null)
                : event;
        CanvasPointerEvent.CanvasHit hit = safeEvent.hit();
        String hitRef = hit == null || hit.hitRef() == null ? "" : hit.hitRef();
        return switch (kind) {
            case POINTER_PRESSED -> DungeonEditorMainViewInputEvent.pointerPressed(
                    safeEvent.canvasPoint().x(),
                    safeEvent.canvasPoint().y(),
                    safeEvent.buttons().primaryButtonDown(),
                    safeEvent.buttons().secondaryButtonDown(),
                    hitRef);
            case POINTER_DRAGGED -> DungeonEditorMainViewInputEvent.pointerDragged(
                    safeEvent.canvasPoint().x(),
                    safeEvent.canvasPoint().y(),
                    safeEvent.buttons().primaryButtonDown(),
                    safeEvent.buttons().secondaryButtonDown(),
                    hitRef);
            case POINTER_RELEASED -> DungeonEditorMainViewInputEvent.pointerReleased(
                    safeEvent.canvasPoint().x(),
                    safeEvent.canvasPoint().y(),
                    safeEvent.buttons().primaryButtonDown(),
                    safeEvent.buttons().secondaryButtonDown(),
                    hitRef);
            case POINTER_MOVED -> DungeonEditorMainViewInputEvent.pointerMoved(
                    safeEvent.canvasPoint().x(),
                    safeEvent.canvasPoint().y(),
                    safeEvent.buttons().primaryButtonDown(),
                    safeEvent.buttons().secondaryButtonDown(),
                    hitRef);
            case LEVEL_SCROLLED -> DungeonEditorMainViewInputEvent.levelScrolled(0);
        };
    }
}
