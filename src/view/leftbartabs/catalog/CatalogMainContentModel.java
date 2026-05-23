package src.view.leftbartabs.catalog;

import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.creatures.published.CreatureCatalogPage;
import src.domain.creatures.published.CreatureCatalogPageResult;
import src.domain.creatures.published.CreatureCatalogRow;
import src.domain.creatures.published.CreatureCatalogSortField;
import src.domain.creatures.published.CreatureQueryStatus;
import src.domain.creatures.published.CreatureSortDirection;

public final class CatalogMainContentModel {

    private static final int PAGE_SIZE = 50;
    private static final List<KeyLabel> CREATURE_COLUMNS = List.of(
            new KeyLabel("name", "Name"),
            new KeyLabel("cr", "CR"),
            new KeyLabel("type", "Typ"),
            new KeyLabel("size", "Größe"),
            new KeyLabel("xp", "XP"));
    private static final List<KeyLabel> SORT_OPTIONS = List.of(
            SortOption.NAME_ASC.asKeyLabel(),
            SortOption.NAME_DESC.asKeyLabel(),
            SortOption.CR_ASC.asKeyLabel(),
            SortOption.CR_DESC.asKeyLabel(),
            SortOption.XP_ASC.asKeyLabel(),
            SortOption.XP_DESC.asKeyLabel());

    private final ReadOnlyObjectWrapper<MainProjection> projection =
            new ReadOnlyObjectWrapper<>(MainProjection.initial());
    private List<CatalogRow> rows = List.of();
    private SortOption selectedSort = SortOption.NAME_ASC;
    private String placeholderText = "Lade Monster...";
    private int pageOffset;
    private int totalCount;

    ReadOnlyObjectProperty<MainProjection> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    void selectSort(String sortKey) {
        selectedSort = SortOption.fromKey(sortKey);
        pageOffset = 0;
        refreshProjection();
    }

    void shiftPage(int pageShift) {
        if (pageShift < 0 && pageOffset > 0) {
            pageOffset = Math.max(0, pageOffset - PAGE_SIZE);
        } else if (pageShift > 0 && pageOffset + PAGE_SIZE < totalCount) {
            pageOffset += PAGE_SIZE;
        }
        refreshProjection();
    }

    void applySearchResult(CreatureCatalogPageResult result) {
        CreatureCatalogPage page = result == null ? CreatureCatalogPage.empty(PAGE_SIZE, pageOffset) : result.page();
        if (page == null) {
            page = CreatureCatalogPage.empty(PAGE_SIZE, pageOffset);
        }
        totalCount = Math.max(0, page.totalCount());
        rows = page.rows().stream().map(CatalogRow::fromCreature).toList();
        placeholderText = switch (result == null ? CreatureQueryStatus.STORAGE_ERROR : result.status()) {
            case SUCCESS -> "Keine Monster gefunden";
            case INVALID_QUERY -> "Filter sind ungültig";
            default -> "Fehler beim Laden";
        };
        refreshProjection();
    }

    void beginSearch() {
        placeholderText = "Lade Monster...";
        refreshProjection();
    }

    CreatureCatalogSortField currentSortField() {
        return selectedSort.field();
    }

    CreatureSortDirection currentSortDirection() {
        return selectedSort.direction();
    }

    String currentSortKey() {
        return selectedSort.key();
    }

    int currentPageOffset() {
        return pageOffset;
    }

    private void refreshProjection() {
        projection.set(MainProjection.from(rows, selectedSort, pageOffset, totalCount, placeholderText));
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    private static String formatInteger(long value) {
        return NumberFormat.getIntegerInstance(Locale.US).format(value);
    }

    private static <T> List<T> copiedList(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    enum SortOption {
        NAME_ASC("name-asc", "Name (A-Z)", CreatureCatalogSortField.NAME, CreatureSortDirection.ASCENDING),
        NAME_DESC("name-desc", "Name (Z-A)", CreatureCatalogSortField.NAME, CreatureSortDirection.DESCENDING),
        CR_ASC("cr-asc", "CR (aufst.)", CreatureCatalogSortField.CHALLENGE_RATING, CreatureSortDirection.ASCENDING),
        CR_DESC("cr-desc", "CR (abst.)", CreatureCatalogSortField.CHALLENGE_RATING, CreatureSortDirection.DESCENDING),
        XP_ASC("xp-asc", "XP (aufst.)", CreatureCatalogSortField.XP, CreatureSortDirection.ASCENDING),
        XP_DESC("xp-desc", "XP (abst.)", CreatureCatalogSortField.XP, CreatureSortDirection.DESCENDING);

        private final String key;
        private final String label;
        private final CreatureCatalogSortField field;
        private final CreatureSortDirection direction;

        SortOption(String key, String label, CreatureCatalogSortField field, CreatureSortDirection direction) {
            this.key = key;
            this.label = label;
            this.field = field;
            this.direction = direction;
        }

        String key() {
            return key;
        }

        CreatureCatalogSortField field() {
            return field;
        }

        CreatureSortDirection direction() {
            return direction;
        }

        KeyLabel asKeyLabel() {
            return new KeyLabel(key, label);
        }

        static SortOption fromKey(String key) {
            for (SortOption option : values()) {
                if (option.key.equals(key)) {
                    return option;
                }
            }
            return NAME_ASC;
        }
    }

    record MainProjection(
            List<KeyLabel> sortOptions,
            List<KeyLabel> columns,
            List<CatalogRow> rows,
            String selectedSortKey,
            String countLabel,
            String pageLabel,
            String placeholderText,
            boolean previousPageAvailable,
            boolean nextPageAvailable
    ) {
        MainProjection {
            sortOptions = copiedList(sortOptions);
            columns = copiedList(columns);
            rows = copiedList(rows);
            selectedSortKey = safe(selectedSortKey);
            countLabel = safe(countLabel);
            pageLabel = safe(pageLabel);
            placeholderText = safe(placeholderText);
        }

        static MainProjection initial() {
            return from(List.of(), SortOption.NAME_ASC, 0, 0, "Lade Monster...");
        }

        static MainProjection from(
                List<CatalogRow> rows,
                SortOption selectedSort,
                int pageOffset,
                int totalCount,
                String placeholderText
        ) {
            int currentPage = totalCount == 0 ? 1 : (pageOffset / PAGE_SIZE) + 1;
            int totalPages = totalCount == 0 ? 1 : (int) Math.ceil((double) totalCount / PAGE_SIZE);
            return new MainProjection(
                    SORT_OPTIONS,
                    CREATURE_COLUMNS,
                    rows,
                    selectedSort == null ? SortOption.NAME_ASC.key() : selectedSort.key(),
                    Math.max(0, totalCount) + " Monster gefunden",
                    "Seite " + currentPage + " / " + totalPages,
                    placeholderText,
                    pageOffset > 0,
                    pageOffset + PAGE_SIZE < totalCount);
        }
    }

    record KeyLabel(String key, String label) {
        KeyLabel {
            key = safe(key);
            label = safe(label);
        }

        @Override
        public String toString() {
            return label;
        }
    }

    record CatalogRow(long id, List<String> cells) {
        CatalogRow {
            cells = copiedList(cells);
        }

        String cell(int index) {
            return index >= 0 && index < cells.size() ? cells.get(index) : "";
        }

        static CatalogRow fromCreature(CreatureCatalogRow creature) {
            return new CatalogRow(
                    creature.id(),
                    List.of(
                            safe(creature.name()),
                            safe(creature.challengeRating()),
                            safe(creature.creatureType()),
                            safe(creature.size()),
                            formatInteger(creature.xp())));
        }
    }
}
