package features.encounter.adapter.javafx.catalog;

import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import features.creatures.api.CreatureCatalogPage;
import features.creatures.api.CreatureCatalogPageResult;
import features.creatures.api.CreatureCatalogRow;
import features.creatures.api.CreatureQueryStatus;

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

    String currentSortFieldName() {
        return selectedSort.sortFieldName();
    }

    String currentSortDirectionName() {
        return selectedSort.sortDirectionName();
    }

    int currentPageOffset() {
        return pageOffset;
    }

    private void refreshProjection() {
        projection.set(MainProjection.from(rows, selectedSort, pageOffset, totalCount, placeholderText));
    }

    enum SortOption {
        NAME_ASC("name-asc", "Name (A-Z)", "NAME", "ASCENDING"),
        NAME_DESC("name-desc", "Name (Z-A)", "NAME", "DESCENDING"),
        CR_ASC("cr-asc", "CR (aufst.)", "CHALLENGE_RATING", "ASCENDING"),
        CR_DESC("cr-desc", "CR (abst.)", "CHALLENGE_RATING", "DESCENDING"),
        XP_ASC("xp-asc", "XP (aufst.)", "XP", "ASCENDING"),
        XP_DESC("xp-desc", "XP (abst.)", "XP", "DESCENDING");

        private final String key;
        private final String label;
        private final String sortFieldName;
        private final String sortDirectionName;

        SortOption(
                String key,
                String label,
                String sortFieldName,
                String sortDirectionName
        ) {
            this.key = key;
            this.label = label;
            this.sortFieldName = sortFieldName;
            this.sortDirectionName = sortDirectionName;
        }

        String key() {
            return key;
        }

        String sortFieldName() {
            return sortFieldName;
        }

        String sortDirectionName() {
            return sortDirectionName;
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
            sortOptions = Values.copiedList(sortOptions);
            columns = Values.copiedList(columns);
            rows = Values.copiedList(rows);
            selectedSortKey = Values.safe(selectedSortKey);
            countLabel = Values.safe(countLabel);
            pageLabel = Values.safe(pageLabel);
            placeholderText = Values.safe(placeholderText);
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
            key = Values.safe(key);
            label = Values.safe(label);
        }

        @Override
        public String toString() {
            return label;
        }
    }

    record CatalogRow(long id, List<String> cells) {
        CatalogRow {
            cells = Values.copiedList(cells);
        }

        String cell(int index) {
            return index >= 0 && index < cells.size() ? cells.get(index) : "";
        }

        static CatalogRow fromCreature(CreatureCatalogRow creature) {
            return new CatalogRow(
                    creature.id(),
                    List.of(
                            Values.safe(creature.name()),
                            Values.safe(creature.challengeRating()),
                            Values.safe(creature.creatureType()),
                            Values.safe(creature.size()),
                            Values.formatInteger(creature.xp())));
        }
    }

    private static final class Values {

        static <T> List<T> copiedList(List<T> values) {
            return values == null ? List.of() : List.copyOf(values);
        }

        static String safe(String value) {
            return value == null ? "" : value;
        }

        static String formatInteger(long value) {
            return NumberFormat.getIntegerInstance(Locale.US).format(value);
        }
    }
}
