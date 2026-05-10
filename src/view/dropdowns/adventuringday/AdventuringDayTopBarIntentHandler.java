package src.view.dropdowns.adventuringday;

import java.util.Objects;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.CalculateAdventuringDayCommand;

final class AdventuringDayTopBarIntentHandler {

    private final AdventuringDayTopBarContributionModel presentationModel;
    private final PartyApplicationService party;

    AdventuringDayTopBarIntentHandler(
            AdventuringDayTopBarContributionModel presentationModel,
            PartyApplicationService party
    ) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
        this.party = Objects.requireNonNull(party, "party");
    }

    void consume(AdventuringDayTopBarViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.popupOpening()) {
            return;
        }
        AdventuringDayTopBarContributionModel.CalculationRequest request = presentationModel.applyViewInput(event);
        if (request == null) {
            return;
        }
        party.calculateAdventuringDay(new CalculateAdventuringDayCommand(
                request.levels(),
                request.totalGroupXp()));
    }
}
