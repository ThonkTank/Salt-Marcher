package src.view.dropdowns.adventuringday;

import java.util.List;
import java.util.Objects;
import java.util.function.BiConsumer;

final class AdventuringDayTopBarIntentHandler {

    private final AdventuringDayTopBarPresentationModel presentationModel;
    private Runnable refreshListener = () -> {};
    private BiConsumer<List<Integer>, Integer> calculationListener = (ignoredLevels, ignoredXp) -> {};

    AdventuringDayTopBarIntentHandler(AdventuringDayTopBarPresentationModel presentationModel) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
    }

    void onRefreshRequested(Runnable listener) {
        refreshListener = listener == null ? () -> {} : listener;
    }

    void onCalculationRequested(BiConsumer<List<Integer>, Integer> listener) {
        calculationListener = listener == null ? (ignoredLevels, ignoredXp) -> {} : listener;
    }

    void onOpen() {
        presentationModel.requestRefresh();
        refreshListener.run();
    }

    AdventuringDayTopBarPresentationModel.CalculationModel calculate(List<Integer> levels, int totalGroupXp) {
        AdventuringDayTopBarPresentationModel.CalculationModel pendingCalculation =
                presentationModel.beginCalculation(totalGroupXp);
        calculationListener.accept(levels == null ? List.of() : List.copyOf(levels), totalGroupXp);
        return pendingCalculation;
    }
}
