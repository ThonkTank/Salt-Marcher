package features.party.adapter.javafx.adventuringday;

import java.util.List;

public record AdventuringDayTopBarViewInputEvent(
        boolean popupCloseRequested,
        boolean useActivePartyRequested,
        boolean addRowRequested,
        boolean clearRequested,
        boolean progressModeSelected,
        String totalGroupXpText,
        List<RowInput> rows
) {

    public AdventuringDayTopBarViewInputEvent {
        totalGroupXpText = totalGroupXpText == null ? "" : totalGroupXpText;
        rows = rows == null ? List.of() : List.copyOf(rows);
    }

    public record RowInput(Integer level, String countText) {

        public RowInput {
            countText = countText == null ? "" : countText;
        }
    }
}
