package src.view.leftbartabs.dungeoneditor;

import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionCommand;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasContentModel;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasViewInputEvent;

final class DungeonEditorMainViewIntentSupport {

    private static final double ZOOM_IN_FACTOR = 1.1;
    private static final double ZOOM_OUT_FACTOR = 1.0 / ZOOM_IN_FACTOR;
    private static final double ZERO_SCROLL_DELTA = 0.0;
    private static final int NO_LEVEL_DELTA = 0;
    private static final int LEVEL_UP_DELTA = 1;
    private static final int LEVEL_DOWN_DELTA = -1;

    private DungeonEditorMainViewIntentSupport() {
    }

    static @Nullable DungeonEditorSessionCommand toCommand(
            MapCanvasContentModel mapCanvasContentModel,
            MapCanvasViewInputEvent event
    ) {
        if (event == null) {
            return null;
        }
        if (event.interaction().isDrag()
                && event.buttons().middleButtonDown()) {
            mapCanvasContentModel.panByPixels(event.dragDeltaX(), event.dragDeltaY());
            return null;
        }
        if (event.interaction().isScroll()) {
            return handleScroll(mapCanvasContentModel, event);
        }
        if (event.buttons().middleButtonDown()) {
            return null;
        }
        return DungeonEditorSessionCommands.mainViewCommand(new DungeonEditorSessionCommand.MainViewInput(
                toMainViewSource(event.interaction()),
                event.position().canvasX(),
                event.position().canvasY(),
                event.buttons().primaryButtonDown(),
                event.buttons().secondaryButtonDown(),
                hitRef(event),
                NO_LEVEL_DELTA));
    }

    private static @Nullable DungeonEditorSessionCommand handleScroll(
            MapCanvasContentModel mapCanvasContentModel,
            MapCanvasViewInputEvent event
    ) {
        if (!event.modifiers().controlDown()) {
            zoomForScroll(mapCanvasContentModel, event);
            return null;
        }
        int levelDelta = normalizeLevelDelta(event.scrollDeltaY());
        if (levelDelta == NO_LEVEL_DELTA) {
            return null;
        }
        return DungeonEditorSessionCommands.mainViewCommand(new DungeonEditorSessionCommand.MainViewInput(
                DungeonEditorSessionCommand.MainViewInputSource.LEVEL_SCROLLED,
                event.position().canvasX(),
                event.position().canvasY(),
                event.buttons().primaryButtonDown(),
                event.buttons().secondaryButtonDown(),
                hitRef(event),
                levelDelta));
    }

    private static void zoomForScroll(
            MapCanvasContentModel mapCanvasContentModel,
            MapCanvasViewInputEvent event
    ) {
        if (event.scrollDeltaY() > ZERO_SCROLL_DELTA) {
            mapCanvasContentModel.zoomAround(
                    event.position().canvasX(),
                    event.position().canvasY(),
                    ZOOM_IN_FACTOR);
        } else if (event.scrollDeltaY() < ZERO_SCROLL_DELTA) {
            mapCanvasContentModel.zoomAround(
                    event.position().canvasX(),
                    event.position().canvasY(),
                    ZOOM_OUT_FACTOR);
        }
    }

    private static String hitRef(MapCanvasViewInputEvent event) {
        return event.hit() == null ? "" : event.hit().hitRef();
    }

    private static int normalizeLevelDelta(double scrollDeltaY) {
        if (scrollDeltaY > ZERO_SCROLL_DELTA) {
            return LEVEL_UP_DELTA;
        }
        if (scrollDeltaY < ZERO_SCROLL_DELTA) {
            return LEVEL_DOWN_DELTA;
        }
        return NO_LEVEL_DELTA;
    }

    private static DungeonEditorSessionCommand.MainViewInputSource toMainViewSource(
            MapCanvasViewInputEvent.Interaction interaction
    ) {
        MapCanvasViewInputEvent.Interaction safeInteraction = interaction == null
                ? MapCanvasViewInputEvent.Interaction.MOVE
                : interaction;
        return switch (safeInteraction) {
            case PRESS -> DungeonEditorSessionCommand.MainViewInputSource.POINTER_PRESSED;
            case DRAG -> DungeonEditorSessionCommand.MainViewInputSource.POINTER_DRAGGED;
            case RELEASE -> DungeonEditorSessionCommand.MainViewInputSource.POINTER_RELEASED;
            case MOVE -> DungeonEditorSessionCommand.MainViewInputSource.POINTER_MOVED;
            case SCROLL -> DungeonEditorSessionCommand.MainViewInputSource.LEVEL_SCROLLED;
        };
    }
}
