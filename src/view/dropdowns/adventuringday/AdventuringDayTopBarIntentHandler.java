package src.view.dropdowns.adventuringday;

import java.util.Objects;
import java.util.function.Consumer;

final class AdventuringDayTopBarIntentHandler {

    private final AdventuringDayTopBarContributionModel presentationModel;
    private Consumer<AdventuringDayTopBarPublishedEvent> publishedEventListener = ignored -> {};
    private int pendingTotalGroupXp;

    AdventuringDayTopBarIntentHandler(AdventuringDayTopBarContributionModel presentationModel) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
    }

    void onPublishedEventRequested(Consumer<AdventuringDayTopBarPublishedEvent> listener) {
        publishedEventListener = listener == null ? ignored -> {} : listener;
    }

    void storePendingTotalGroupXp(int totalGroupXp) {
        pendingTotalGroupXp = Math.max(0, totalGroupXp);
    }

    int drainPendingTotalGroupXp() {
        int totalGroupXp = pendingTotalGroupXp;
        pendingTotalGroupXp = 0;
        return totalGroupXp;
    }

    void consume(AdventuringDayTopBarViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.popupOpening()) {
            return;
        }
        presentationModel.beginCalculation(event.totalGroupXp());
        publishedEventListener.accept(
                AdventuringDayTopBarPublishedEvent.calculate(event.levels(), event.totalGroupXp()));
    }
}
