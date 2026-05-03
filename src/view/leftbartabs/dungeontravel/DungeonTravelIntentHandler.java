package src.view.leftbartabs.dungeontravel;

import java.util.Objects;
import java.util.function.Consumer;

final class DungeonTravelIntentHandler {

    private final DungeonTravelContributionModel presentationModel;
    private Consumer<DungeonTravelStatePublishedEvent> actionListener = ignored -> {};

    DungeonTravelIntentHandler(DungeonTravelContributionModel presentationModel) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
    }

    void onPublishedEventRequested(Consumer<DungeonTravelStatePublishedEvent> listener) {
        actionListener = listener == null ? ignored -> {} : listener;
    }

    void consume(DungeonTravelControlsViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.source()) {
            case REFRESH_BUTTON -> presentationModel.requestRefresh();
            case RESET_VIEW_BUTTON -> presentationModel.requestResetView();
            case PREVIOUS_LEVEL_BUTTON -> presentationModel.previousLevel();
            case NEXT_LEVEL_BUTTON -> presentationModel.nextLevel();
            case OVERLAY_MODE_CONTROL -> presentationModel.selectOverlayMode(event.overlayModeKey());
            case OVERLAY_RANGE_CONTROL -> presentationModel.selectOverlayRange(event.overlayRange());
            case OVERLAY_OPACITY_CONTROL -> presentationModel.selectOverlayOpacity(event.overlayOpacity());
            case OVERLAY_LEVEL_SELECTION -> presentationModel.selectOverlayLevels(event.overlayLevels());
        }
    }

    void consume(DungeonTravelStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        actionListener.accept(new DungeonTravelStatePublishedEvent(event.actionId()));
    }
}
