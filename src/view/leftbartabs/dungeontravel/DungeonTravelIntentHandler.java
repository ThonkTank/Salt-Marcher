package src.view.leftbartabs.dungeontravel;

import java.util.List;
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
        if (event.resetViewRequested()) {
            presentationModel.requestCameraReset();
            return;
        }
        if (event.projectionLevelShift() != 0) {
            actionListener.accept(DungeonTravelStatePublishedEvent.setProjectionLevel(
                    presentationModel.currentProjectionLevel() + event.projectionLevelShift()));
            return;
        }
        actionListener.accept(DungeonTravelStatePublishedEvent.setOverlay(
                event.overlayModeKey(),
                event.overlayRange(),
                event.overlayOpacity(),
                parseLevels(event.overlayLevelsText())));
    }

    void consume(DungeonTravelStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        actionListener.accept(DungeonTravelStatePublishedEvent.action(event.actionId()));
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
}
