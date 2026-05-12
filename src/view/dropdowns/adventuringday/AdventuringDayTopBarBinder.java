package src.view.dropdowns.adventuringday;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.AdventuringDayCalculationResult;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.AdventuringDaySummary;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.ReadStatus;
import src.view.slotcontent.topbar.dropdown.DropdownPopupContentModel;

final class AdventuringDayTopBarBinder {

    private final ShellRuntimeContext runtimeContext;

    AdventuringDayTopBarBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        PartyApplicationService party = runtimeContext.services().require(PartyApplicationService.class);
        AdventuringDaySummaryModel summaryModel = runtimeContext.services().require(AdventuringDaySummaryModel.class);
        AdventuringDayCalculationModel calculationModel =
                runtimeContext.services().require(AdventuringDayCalculationModel.class);
        AdventuringDayTopBarContributionModel presentationModel = new AdventuringDayTopBarContributionModel();
        AdventuringDayTopBarIntentHandler intentHandler = new AdventuringDayTopBarIntentHandler(presentationModel, party);
        DropdownPopupContentModel popupContentModel = new DropdownPopupContentModel();
        AdventuringDayTopBarView view = new AdventuringDayTopBarView(popupContentModel);
        applyPopupPresentation(popupContentModel, presentationModel.triggerTextProperty().getValue());
        view.onViewInputEvent(intentHandler::consume);
        view.showPanel(presentationModel.panelProperty().getValue());
        presentationModel.triggerTextProperty().addListener((ignored, before, after) ->
                applyPopupPresentation(popupContentModel, after));
        presentationModel.panelProperty().addListener((ignored, before, after) -> view.showPanel(after));
        summaryModel.subscribe(result -> applySummary(presentationModel, result));
        calculationModel.subscribe(result -> presentationModel.applyCalculationResult(
                result == null || result.calculation() == null
                        ? null
                        : new AdventuringDayCalculationMapper().map(result.calculation()),
                successful(result)));
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

    private static boolean successful(AdventuringDayCalculationResult result) {
        return result != null && result.status() == ReadStatus.SUCCESS;
    }

    private static void applyPopupPresentation(
            DropdownPopupContentModel popupContentModel,
            String triggerText
    ) {
        String safeTriggerText = triggerText == null ? "" : triggerText;
        popupContentModel.showPresentation(
                safeTriggerText,
                safeTriggerText,
                safeTriggerText,
                AdventuringDayTopBarView.TOOLTIP_TEXT,
                false,
                AdventuringDayTopBarView.POPUP_WIDTH);
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
