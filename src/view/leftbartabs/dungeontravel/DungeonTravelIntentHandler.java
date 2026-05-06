package src.view.leftbartabs.dungeontravel;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

final class DungeonTravelIntentHandler {

    private final DungeonTravelContributionModel presentationModel;
    private Consumer<DungeonTravelStatePublishedEvent> publishedEventListener = ignored -> {};
    private Consumer<ViewEffect> viewEffectListener = ignored -> {};

    DungeonTravelIntentHandler(DungeonTravelContributionModel presentationModel) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
    }

    void onPublishedEventRequested(Consumer<DungeonTravelStatePublishedEvent> listener) {
        publishedEventListener = listener == null ? ignored -> {} : listener;
    }

    void onViewEffectRequested(Consumer<ViewEffect> listener) {
        viewEffectListener = listener == null ? ignored -> {} : listener;
    }

    void consume(DungeonTravelControlsViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.resetViewRequested()) {
            viewEffectListener.accept(ViewEffect.RESET_CAMERA);
            return;
        }
        if (event.projectionLevelShift() != 0) {
            publishedEventListener.accept(DungeonTravelStatePublishedEvent.setProjectionLevel(
                    presentationModel.currentProjectionLevel() + event.projectionLevelShift()));
            return;
        }
        publishedEventListener.accept(DungeonTravelStatePublishedEvent.setOverlay(
                event.overlayModeKey(),
                event.overlayRange(),
                event.overlayOpacity(),
                parseLevels(event.overlayLevelsText())));
    }

    void consume(DungeonTravelStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        publishedEventListener.accept(DungeonTravelStatePublishedEvent.action(event.actionId()));
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

    enum ViewEffect {
        RESET_CAMERA
    }
}
