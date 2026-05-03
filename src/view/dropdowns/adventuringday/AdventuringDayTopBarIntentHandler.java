package src.view.dropdowns.adventuringday;

import java.util.Objects;

final class AdventuringDayTopBarIntentHandler {

    private final AdventuringDayTopBarContributionModel presentationModel;

    AdventuringDayTopBarIntentHandler(AdventuringDayTopBarContributionModel presentationModel) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
    }

    void consume(AdventuringDayTopBarViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.source()) {
            case POPUP_OPENED -> presentationModel.requestRefresh();
            case CALCULATOR_SUBMIT -> presentationModel.requestCalculation(event.levels(), event.totalGroupXp());
        }
    }
}
