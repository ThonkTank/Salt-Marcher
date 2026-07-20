package features.party.adapter.javafx.adventuringday;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellSlot;
import features.party.api.PartyApi;
import features.party.api.AdventuringDayCalculationModel;
import features.party.api.AdventuringDayResult;
import features.party.api.AdventuringDaySummary;
import features.party.api.AdventuringDaySummaryModel;
import features.party.api.ReadStatus;
import platform.ui.dropdown.DropdownPopupContentModel;
import platform.ui.dropdown.DropdownPopupView;

final class AdventuringDayTopBarBinder {

    private final AdventuringDaySummaryModel summaryModel;
    private final AdventuringDayCalculationModel calculationModel;
    private final PartyApi party;

    AdventuringDayTopBarBinder(
            AdventuringDaySummaryModel summaryModel,
            AdventuringDayCalculationModel calculationModel,
            PartyApi party
    ) {
        this.summaryModel = Objects.requireNonNull(summaryModel, "summaryModel");
        this.calculationModel = Objects.requireNonNull(calculationModel, "calculationModel");
        this.party = Objects.requireNonNull(party, "party");
    }

    ShellBinding bind() {
        AdventuringDayTopBarContributionModel presentationModel = new AdventuringDayTopBarContributionModel();
        AdventuringDayTopBarContentModel panelContentModel = presentationModel.contentModel();
        DropdownPopupContentModel popupContentModel = new DropdownPopupContentModel();
        AdventuringDayTopBarIntentHandler intentHandler =
                new AdventuringDayTopBarIntentHandler(presentationModel, popupContentModel, party);
        AdventuringDayTopBarView panelView = new AdventuringDayTopBarView();
        DropdownPopupView view = new DropdownPopupView(panelView);
        view.bind(popupContentModel);
        panelView.bind(panelContentModel);
        applyPopupPresentation(popupContentModel, presentationModel.triggerTextProperty().getValue());
        panelView.onViewInputEvent(intentHandler::consume);
        view.onViewInputEvent(intentHandler::consume);
        presentationModel.triggerTextProperty().addListener((ignored, before, after) ->
                applyPopupPresentation(popupContentModel, after));
        summaryModel.subscribe(result -> applySummary(presentationModel, result));
        calculationModel.subscribe(presentationModel::applyCalculationResult);
        AdventuringDayResult initialSummary = summaryModel.current();
        applySummary(presentationModel, initialSummary);
        return new Binding(view);
    }

    private static void applySummary(
            AdventuringDayTopBarContributionModel presentationModel,
            AdventuringDayResult result
    ) {
        AdventuringDaySummary summary = result == null ? null : result.summary();
        presentationModel.applySummaryResult(
                summary == null ? java.util.List.of() : summary.activePartyLevels(),
                summary == null ? 0 : summary.remainingToShortRest(),
                summary == null ? 0 : summary.remainingToLongRest(),
                successful(result));
    }

    private static boolean successful(AdventuringDayResult result) {
        return result != null && result.status() == ReadStatus.SUCCESS;
    }

    private static void applyPopupPresentation(
            DropdownPopupContentModel popupContentModel,
            String triggerText
    ) {
        String safeTriggerText = triggerText == null ? "" : triggerText;
        popupContentModel.showPresentation(new DropdownPopupContentModel.PopupPresentation(
                safeTriggerText,
                safeTriggerText,
                safeTriggerText,
                AdventuringDayTopBarView.TOOLTIP_TEXT,
                false,
                AdventuringDayTopBarView.POPUP_WIDTH));
    }

    private record Binding(Node topBar) implements ShellBinding {

        @Override
        public String title() {
            return "Adventuring Day";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(ShellSlot.TOP_BAR, topBar);
        }
    }
}
