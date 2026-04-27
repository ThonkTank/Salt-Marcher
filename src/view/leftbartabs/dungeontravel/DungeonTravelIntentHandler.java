package src.view.leftbartabs.dungeontravel;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

final class DungeonTravelIntentHandler {

    private final DungeonTravelPresentationModel presentationModel;
    private Runnable refreshListener = () -> {};
    private Consumer<String> actionListener = ignored -> {};

    DungeonTravelIntentHandler(DungeonTravelPresentationModel presentationModel) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
    }

    void onRefreshRequested(Runnable listener) {
        refreshListener = listener == null ? () -> {} : listener;
    }

    void onActionRequested(Consumer<String> listener) {
        actionListener = listener == null ? ignored -> {} : listener;
    }

    void refresh() {
        presentationModel.refresh();
        refreshListener.run();
    }

    void previousLevel() {
        presentationModel.previousLevel();
    }

    void nextLevel() {
        presentationModel.nextLevel();
    }

    void selectOverlayMode(String overlayModeKey) {
        presentationModel.selectOverlayMode(overlayModeKey);
    }

    void selectOverlayRange(int levelRange) {
        presentationModel.selectOverlayRange(levelRange);
    }

    void selectOverlayOpacity(double opacity) {
        presentationModel.selectOverlayOpacity(opacity);
    }

    void selectOverlayLevels(List<Integer> levels) {
        presentationModel.selectOverlayLevels(levels);
    }

    void performAction(String actionId) {
        presentationModel.performAction(actionId);
        actionListener.accept(actionId == null ? "" : actionId);
    }
}
