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
        switch (event.kind()) {
            case REFRESH -> presentationModel.requestRefresh();
            case RESET_VIEW -> presentationModel.requestResetView();
            case PREVIOUS_LEVEL -> presentationModel.previousLevel();
            case NEXT_LEVEL -> presentationModel.nextLevel();
            case OVERLAY_MODE_CHANGED -> presentationModel.selectOverlayMode(event.overlayModeKey());
            case OVERLAY_RANGE_CHANGED -> presentationModel.selectOverlayRange(event.overlayRange());
            case OVERLAY_OPACITY_CHANGED -> presentationModel.selectOverlayOpacity(event.overlayOpacity());
            case OVERLAY_LEVELS_CHANGED -> presentationModel.selectOverlayLevels(event.overlayLevels());
            default -> {
            }
        }
    }

    void consume(DungeonTravelStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        actionListener.accept(new DungeonTravelStatePublishedEvent(event.actionId()));
    }
}
