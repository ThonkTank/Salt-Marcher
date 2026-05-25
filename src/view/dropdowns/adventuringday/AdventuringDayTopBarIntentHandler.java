package src.view.dropdowns.adventuringday;

import java.util.ArrayList;
import java.util.List;
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
        CalculationRequest request = applyInputProjection(event);
        if (request == null) {
            return;
        }
        presentationModel.expectCalculationResult(request.totalGroupXp());
        party.calculateAdventuringDay(new CalculateAdventuringDayCommand(
                request.levels(),
                request.totalGroupXp()));
    }

    void consume(DropdownPopupViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.popupHidden()) {
            popupContentModel.close();
        } else if (event.triggerInvoked() && popupContentModel.isOpen()) {
            popupContentModel.close();
        } else if (event.triggerInvoked()) {
            popupContentModel.open();
        }
    }

    private CalculationRequest applyInputProjection(AdventuringDayTopBarViewInputEvent event) {
        String totalGroupXpText = event.totalGroupXpText();
        int totalGroupXp = AdventuringDayTopBarContentModel.LevelRows.parseNonNegativeInt(totalGroupXpText);
        List<AdventuringDayTopBarContentModel.RowModel> eventRows = normalizeRows(event.rows());
        AdventuringDayTopBarContributionModel.InputSource inputSource = presentationModel.inputSource();
        List<AdventuringDayTopBarContentModel.RowModel> nextRows;
        if (event.useActivePartyRequested()) {
            nextRows = inputSource.activePartyRows();
            presentationModel.showInputProjection(
                    nextRows,
                    event.progressModeSelected(),
                    totalGroupXpText,
                    totalGroupXp,
                    true,
                    true);
        } else if (event.addRowRequested()) {
            nextRows = appendDefaultRow(eventRows);
            presentationModel.showInputProjection(
                    nextRows,
                    event.progressModeSelected(),
                    totalGroupXpText,
                    totalGroupXp,
                    false,
                    false);
        } else if (event.clearRequested()) {
            nextRows = List.of();
            presentationModel.showInputProjection(
                    nextRows,
                    event.progressModeSelected(),
                    totalGroupXpText,
                    totalGroupXp,
                    false,
                    false);
        } else if (inputSource.activePartySource()
                && !eventRows.equals(inputSource.activePartyRows())) {
            nextRows = eventRows;
            presentationModel.showInputProjection(
                    nextRows,
                    event.progressModeSelected(),
                    totalGroupXpText,
                    totalGroupXp,
                    false,
                    false);
        } else {
            nextRows = eventRows;
            presentationModel.showInputProjection(
                    nextRows,
                    event.progressModeSelected(),
                    totalGroupXpText,
                    totalGroupXp,
                    inputSource.activePartySource(),
                    false);
        }
        List<Integer> levels = AdventuringDayTopBarContentModel.LevelRows.expandedLevels(nextRows);
        if (levels.isEmpty()) {
            return null;
        }
        return new CalculationRequest(levels, totalGroupXp);
    }

    private static List<AdventuringDayTopBarContentModel.RowModel> normalizeRows(
            List<AdventuringDayTopBarViewInputEvent.RowInput> rowInputs
    ) {
        if (rowInputs == null || rowInputs.isEmpty()) {
            return List.of();
        }
        List<AdventuringDayTopBarContentModel.RowModel> nextRows = new ArrayList<>();
        for (AdventuringDayTopBarViewInputEvent.RowInput rowInput : rowInputs) {
            if (rowInput != null) {
                int level = rowInput.level() == null ? 1 : Math.max(1, Math.min(20, rowInput.level()));
                nextRows.add(new AdventuringDayTopBarContentModel.RowModel(level, rowInput.countText()));
            }
        }
        return List.copyOf(nextRows);
    }

    private static List<AdventuringDayTopBarContentModel.RowModel> appendDefaultRow(
            List<AdventuringDayTopBarContentModel.RowModel> existingRows
    ) {
        List<AdventuringDayTopBarContentModel.RowModel> nextRows =
                new ArrayList<>(existingRows == null ? List.of() : existingRows);
        nextRows.add(new AdventuringDayTopBarContentModel.RowModel(1, "1"));
        return List.copyOf(nextRows);
    }

    private record CalculationRequest(List<Integer> levels, int totalGroupXp) {

        private CalculationRequest {
            levels = levels == null ? List.of() : List.copyOf(levels);
            totalGroupXp = Math.max(0, totalGroupXp);
        }
    }
}
