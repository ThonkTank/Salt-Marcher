package src.view.creatures.ViewModel;

import java.util.List;

public final class CreaturesCatalogViewData {

    private CreaturesCatalogViewData() {
    }

    public record Row(
            long id,
            String name,
            String challengeRating,
            String creatureType,
            String size,
            String alignment,
            int xp,
            int hitPoints,
            int armorClass
    ) {
    }

    public record Page(
            List<Row> rows,
            String pageSummaryText,
            boolean previousPageAvailable,
            boolean nextPageAvailable
    ) {
        public Page {
            rows = rows == null ? List.of() : List.copyOf(rows);
        }
    }

    public static Page emptyPage(String summaryText) {
        return new Page(List.of(), summaryText, false, false);
    }
}
