package src.view.leftbartabs.dungeoneditor;

import java.util.function.Consumer;
import src.view.slotcontent.main.dungeonmap.DungeonMapView;
import src.view.slotcontent.primitives.mapcanvas.CanvasPointerEvent;

final class DungeonEditorMainView extends DungeonMapView {

    private Consumer<DungeonEditorMainViewInputEvent> viewInputEventHandler = ignored -> {};

    DungeonEditorMainView() {
        onCanvasPointerEvent(event -> viewInputEventHandler.accept(pointerEvent(event)));
        onLevelScrolled(levelDelta -> viewInputEventHandler.accept(
                new DungeonEditorMainViewInputEvent(
                        DungeonEditorMainViewInputEvent.PointerPhase.levelScrolledPhase(),
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

    private static DungeonEditorMainViewInputEvent pointerEvent(
            CanvasPointerEvent event
    ) {
        CanvasPointerEvent.CanvasHit hit = event.hit();
        String hitRef = hit == null ? "" : hit.hitRef();
        return new DungeonEditorMainViewInputEvent(
                toPointerPhase(event.phase()),
                event.canvasPoint().x(),
                event.canvasPoint().y(),
                event.buttons().primaryButtonDown(),
                event.buttons().secondaryButtonDown(),
                hitRef,
                0);
    }

    private static DungeonEditorMainViewInputEvent.PointerPhase toPointerPhase(CanvasPointerEvent.PointerPhase phase) {
        return DungeonEditorMainViewInputEvent.PointerPhase.fromCanvasPhaseName(phase == null ? null : phase.name());
    }
}
