package src.view.leftbartabs.dungeontravel;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.DungeonTravelRuntimeApplicationService;
import src.domain.dungeon.published.ApplyTravelDungeonSessionCommand;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapViewInputEvent;

final class DungeonTravelIntentHandler {

    private static final double NO_SCROLL_DELTA = 0.0;
    private static final double WHEEL_ZOOM_STEP = 1.1;
    private static final double WHEEL_ZOOM_BACK_STEP = 1.0 / WHEEL_ZOOM_STEP;

    private final DungeonTravelContributionModel presentationModel;
    private final DungeonMapContentModel mapContentModel;
    private final DungeonTravelRuntimeApplicationService travel;
    private double previousMiddleDragCanvasX;
    private double previousMiddleDragCanvasY;
    private boolean middleDragInProgress;

    DungeonTravelIntentHandler(
            DungeonTravelContributionModel presentationModel,
            DungeonMapContentModel mapContentModel,
            DungeonTravelRuntimeApplicationService travel
    ) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
        this.mapContentModel = Objects.requireNonNull(mapContentModel, "mapContentModel");
        this.travel = Objects.requireNonNull(travel, "travel");
    }

    void consume(DungeonMapViewInputEvent event) {
        if (event == null) {
            return;
        }
        consumeLocalCameraInput(event);
    }

    void consume(DungeonTravelControlsViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.resetViewRequested()) {
            mapContentModel.resetCamera();
            return;
        }
        if (event.projectionLevelShift() != 0) {
            travel.applyDungeonTravelSession(ApplyTravelDungeonSessionCommand.projectionLevel(
                    presentationModel.currentProjectionLevel() + event.projectionLevelShift()));
            return;
        }
        travel.applyDungeonTravelSession(ApplyTravelDungeonSessionCommand.overlay(
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
        travel.applyDungeonTravelSession(ApplyTravelDungeonSessionCommand.action(event.actionId()));
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

    private void consumeLocalCameraInput(DungeonMapViewInputEvent event) {
        DungeonMapViewInputEvent.CanvasInput input = event.input();
        if (input.scrolled()) {
            applyScrollCameraZoom(event);
            return;
        }
        if (!event.buttons().middleButtonDown()) {
            return;
        }
        if (input.mousePressed()) {
            markMiddleDragStart(event.position().canvasX(), event.position().canvasY());
            return;
        }
        if (input.mouseDragged()) {
            dragCameraTo(event.position().canvasX(), event.position().canvasY());
        } else if (input.mouseReleased()) {
            middleDragInProgress = false;
        }
    }

    private void markMiddleDragStart(double canvasX, double canvasY) {
        previousMiddleDragCanvasX = canvasX;
        previousMiddleDragCanvasY = canvasY;
        middleDragInProgress = true;
    }

    private void dragCameraTo(double canvasX, double canvasY) {
        if (middleDragInProgress) {
            mapContentModel.panByPixels(canvasX - previousMiddleDragCanvasX, canvasY - previousMiddleDragCanvasY);
        }
        markMiddleDragStart(canvasX, canvasY);
    }

    private void applyScrollCameraZoom(DungeonMapViewInputEvent event) {
        if (event.modifiers().controlDown()) {
            return;
        }
        double scrollDeltaY = event.scrollDeltaY();
        if (scrollDeltaY > NO_SCROLL_DELTA) {
            mapContentModel.zoomAround(event.position().canvasX(), event.position().canvasY(), WHEEL_ZOOM_STEP);
        } else if (scrollDeltaY < NO_SCROLL_DELTA) {
            mapContentModel.zoomAround(event.position().canvasX(), event.position().canvasY(), WHEEL_ZOOM_BACK_STEP);
        }
    }
}
