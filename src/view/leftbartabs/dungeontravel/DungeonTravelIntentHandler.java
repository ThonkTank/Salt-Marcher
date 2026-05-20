package src.view.leftbartabs.dungeontravel;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.DungeonTravelRuntimeApplicationService;
import src.domain.dungeon.published.ApplyTravelDungeonSessionCommand;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.view.slotcontent.main.dungeonmap.DungeonMapViewInputEvent;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasContentModel;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasViewInputEvent;

final class DungeonTravelIntentHandler {

    private static final double ZOOM_IN_FACTOR = 1.1;
    private static final double ZOOM_OUT_FACTOR = 1.0 / ZOOM_IN_FACTOR;
    private static final double SCROLL_DELTA_IDLE = 0.0;

    private final DungeonTravelContributionModel presentationModel;
    private final MapCanvasContentModel mapCanvasContentModel;
    private final DungeonTravelRuntimeApplicationService travel;

    DungeonTravelIntentHandler(
            DungeonTravelContributionModel presentationModel,
            MapCanvasContentModel mapCanvasContentModel,
            DungeonTravelRuntimeApplicationService travel
    ) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
        this.mapCanvasContentModel = Objects.requireNonNull(mapCanvasContentModel, "mapCanvasContentModel");
        this.travel = Objects.requireNonNull(travel, "travel");
    }

    void consume(DungeonMapViewInputEvent event) {
        if (event == null) {
            return;
        }
        LocalCameraSupport.consume(mapCanvasContentModel, event.canvasEvent());
    }

    void consume(DungeonTravelControlsViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.resetViewRequested()) {
            mapCanvasContentModel.resetCamera();
            return;
        }
        if (event.projectionLevelShift() != 0) {
            travel.applyDungeonTravelSession(new ApplyTravelDungeonSessionCommand(
                    ApplyTravelDungeonSessionCommand.Action.SET_PROJECTION_LEVEL,
                    "",
                    presentationModel.currentProjectionLevel() + event.projectionLevelShift(),
                    DungeonOverlaySettings.defaults()));
            return;
        }
        travel.applyDungeonTravelSession(new ApplyTravelDungeonSessionCommand(
                ApplyTravelDungeonSessionCommand.Action.SET_OVERLAY,
                "",
                0,
                new DungeonOverlaySettings(
                        event.overlayModeKey(),
                        event.overlayRange(),
                        event.overlayOpacity(),
                        parseLevels(event.overlayLevelsText()))));
    }

    void consume(DungeonTravelStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        travel.applyDungeonTravelSession(new ApplyTravelDungeonSessionCommand(
                ApplyTravelDungeonSessionCommand.Action.ACTION,
                event.actionId(),
                0,
                DungeonOverlaySettings.defaults()));
    }

    private static List<Integer> parseLevels(String rawLevelsText) {
        if (rawLevelsText == null || rawLevelsText.isBlank()) {
            return List.of();
        }
        try {
            return java.util.Arrays.stream(rawLevelsText.split(","))
                    .map(String::trim)
                    .filter(part -> !part.isBlank())
                    .map(Integer::parseInt)
                    .sorted()
                    .distinct()
                    .toList();
        } catch (NumberFormatException exception) {
            return List.of();
        }
    }

    private static final class LocalCameraSupport {

        private static void consume(MapCanvasContentModel mapCanvasContentModel, MapCanvasViewInputEvent event) {
            if (event == null) {
                return;
            }
            if (event.interaction().isDrag()
                    && event.buttons().middleButtonDown()) {
                mapCanvasContentModel.panByPixels(event.dragDeltaX(), event.dragDeltaY());
                return;
            }
            if (event.interaction().isScroll()
                    && !event.modifiers().controlDown()) {
                if (event.scrollDeltaY() > SCROLL_DELTA_IDLE) {
                    mapCanvasContentModel.zoomAround(
                            event.position().canvasX(),
                            event.position().canvasY(),
                            ZOOM_IN_FACTOR);
                } else if (event.scrollDeltaY() < SCROLL_DELTA_IDLE) {
                    mapCanvasContentModel.zoomAround(
                            event.position().canvasX(),
                            event.position().canvasY(),
                            ZOOM_OUT_FACTOR);
                }
            }
        }
    }
}
