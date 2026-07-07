package src.view.leftbartabs.dungeontravel;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.DungeonTravelRuntimeApplicationService;
import src.domain.dungeon.published.ApplyTravelDungeonSessionCommand;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsContentModel;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsViewInputEvent;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapViewInputEvent;

final class DungeonTravelIntentHandler {
    private static final double SCROLL_DELTA_ZERO = 0.0;

    private final DungeonTravelContributionModel presentationModel;
    private final CatalogCrudControlsContentModel catalogContentModel;
    private final DungeonMapContentModel mapContentModel;
    private final DungeonTravelRuntimeApplicationService travel;
    private double previousMiddleDragCanvasX;
    private double previousMiddleDragCanvasY;
    private boolean middleDragInProgress;

    DungeonTravelIntentHandler(
            DungeonTravelContributionModel presentationModel,
            CatalogCrudControlsContentModel catalogContentModel,
            DungeonMapContentModel mapContentModel,
            DungeonTravelRuntimeApplicationService travel
    ) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
        this.catalogContentModel = Objects.requireNonNull(catalogContentModel, "catalogContentModel");
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
        int projectionLevelShift = event.projectionLevelShift();
        if (projectionLevelShift != 0) {
            travel.applyDungeonTravelSession(ApplyTravelDungeonSessionCommand.projectionLevelShift(projectionLevelShift));
            return;
        }
        travel.applyDungeonTravelSession(ApplyTravelDungeonSessionCommand.overlay(
                new DungeonOverlaySettings(
                        event.overlayModeKey(),
                        event.overlayRange(),
                        event.overlayOpacity(),
                parseLevels(event.overlayLevelsText()))));
    }

    void consume(CatalogCrudControlsViewInputEvent event) {
        if (event == null) {
            return;
        }
        catalogContentModel.updateSelectorFilter(event.selectorFilterText());
        String stagedItemId = event.selectedItemId();
        if (!stagedItemId.isBlank()) {
            catalogContentModel.selectItem(stagedItemId);
            return;
        }
        String openItemId = event.openItemId();
        if (!openItemId.isBlank()) {
            catalogContentModel.selectItem(openItemId);
            travel.applyDungeonTravelSession(ApplyTravelDungeonSessionCommand.selectMap(parseMapId(openItemId)));
        }
    }

    void consume(DungeonTravelStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        presentationModel.actionIdForRow(event.selectedActionRowIndex())
                .ifPresent(actionId -> travel.applyDungeonTravelSession(
                        ApplyTravelDungeonSessionCommand.action(actionId)));
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

    private static long parseMapId(String rawMapId) {
        try {
            return Long.parseLong(rawMapId);
        } catch (NumberFormatException exception) {
            return 0L;
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
        double zoomInFactor = 1.1;
        if (scrollDeltaY > SCROLL_DELTA_ZERO) {
            mapContentModel.zoomAround(
                    event.position().canvasX(),
                    event.position().canvasY(),
                    zoomInFactor);
        } else if (scrollDeltaY < SCROLL_DELTA_ZERO) {
            mapContentModel.zoomAround(
                    event.position().canvasX(),
                    event.position().canvasY(),
                    1.0 / zoomInFactor);
        }
    }
}
