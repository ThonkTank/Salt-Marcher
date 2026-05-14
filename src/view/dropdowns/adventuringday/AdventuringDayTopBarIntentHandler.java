package src.view.dropdowns.adventuringday;

import java.util.Objects;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.CalculateAdventuringDayCommand;
import src.view.slotcontent.topbar.dropdown.DropdownPopupContentModel;
import src.view.slotcontent.topbar.dropdown.DropdownPopupViewInputEvent;

final class AdventuringDayTopBarIntentHandler {

    private final AdventuringDayTopBarContributionModel presentationModel;
    private final DropdownPopupContentModel popupContentModel;
    private final PartyApplicationService party;

    AdventuringDayTopBarIntentHandler(
            AdventuringDayTopBarContributionModel presentationModel,
            DropdownPopupContentModel popupContentModel,
            PartyApplicationService party
    ) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
        this.popupContentModel = Objects.requireNonNull(popupContentModel, "popupContentModel");
        this.party = Objects.requireNonNull(party, "party");
    }

    void consume(AdventuringDayTopBarViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.popupCloseRequested()) {
            popupContentModel.close();
            return;
        }
        AdventuringDayTopBarContributionModel.CalculationRequest request = presentationModel.applyViewInput(
                event.useActivePartyRequested(),
                event.addRowRequested(),
                event.clearRequested(),
                event.progressModeSelected(),
                event.totalGroupXpText(),
                new AdventuringDayRowProjection().normalizeRows(event.rows()));
        if (request == null) {
            return;
        }
        party.calculateAdventuringDay(new CalculateAdventuringDayCommand(
                request.levels(),
                request.totalGroupXp()));
    }

    void consume(DropdownPopupViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.interaction()) {
            case REQUEST_OPEN -> popupContentModel.open();
            case REQUEST_CLOSE, HIDDEN -> popupContentModel.close();
        }
    }
}
