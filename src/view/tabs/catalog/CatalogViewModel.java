package src.view.tabs.catalog;

import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import javafx.beans.property.ReadOnlyBooleanProperty;
import javafx.beans.property.ReadOnlyBooleanWrapper;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.CreatureCatalogPage;
import src.domain.creatures.published.CreatureCatalogPageResult;
import src.domain.creatures.published.CreatureCatalogQuery;
import src.domain.creatures.published.CreatureCatalogRow;
import src.domain.creatures.published.CreatureCatalogSortField;
import src.domain.creatures.published.CreatureFilterOptions;
import src.domain.creatures.published.CreatureFilterOptionsResult;
import src.domain.creatures.published.CreatureQueryStatus;
import src.domain.creatures.published.CreatureReadStatus;
import src.domain.creatures.published.CreatureSortDirection;

public final class CatalogViewModel {

    public enum ContentKind {
        CREATURES("creatures", "Creatures", true),
        ITEMS("items", "Items", false),
        SPELLS("spells", "Spells", false);

        private final String key;
        private final String label;
        private final boolean enabled;

        ContentKind(String key, String label, boolean enabled) {
            this.key = key;
            this.label = label;
            this.enabled = enabled;
        }

        public String key() {
            return key;
        }

        public String label() {
            return label;
        }

        public boolean enabled() {
            return enabled;
        }
    }

    public enum SortOption {
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

        public String key() {
            return key;
        }

        public String label() {
            return label;
        }
    }

    private static final int PAGE_SIZE = 50;
    private static final NumberFormat INTEGER_FORMAT = NumberFormat.getIntegerInstance(Locale.US);
    private static final List<CatalogColumn> CREATURE_COLUMNS = List.of(
            new CatalogColumn("name", "Name"),
            new CatalogColumn("cr", "CR"),
            new CatalogColumn("type", "Typ"),
            new CatalogColumn("size", "Größe"),
            new CatalogColumn("xp", "XP"));

    private final CreaturesApplicationService creatures;
    private final ObservableList<CatalogContent> contents = FXCollections.observableArrayList();
    private final ObservableList<SortSelection> sortOptions = FXCollections.observableArrayList();
    private final ObservableList<CatalogColumn> columns = FXCollections.observableArrayList();
    private final ObservableList<CatalogRow> rows = FXCollections.observableArrayList();
    private final ObservableList<FilterChip> chips = FXCollections.observableArrayList();
    private final ReadOnlyObjectWrapper<ContentKind> selectedContent = new ReadOnlyObjectWrapper<>(ContentKind.CREATURES);
    private final ReadOnlyObjectWrapper<CreatureFilterData> creatureFilterData =
            new ReadOnlyObjectWrapper<>(CreatureFilterData.empty());
    private final ReadOnlyStringWrapper selectedSortKey = new ReadOnlyStringWrapper(SortOption.NAME_ASC.key());
    private final ReadOnlyStringWrapper countLabel = new ReadOnlyStringWrapper("0 Monster gefunden");
    private final ReadOnlyStringWrapper pageLabel = new ReadOnlyStringWrapper("Seite 1 / 1");
    private final ReadOnlyStringWrapper placeholderText = new ReadOnlyStringWrapper("Lade Monster...");
    private final ReadOnlyStringWrapper statusText = new ReadOnlyStringWrapper("");
    private final ReadOnlyBooleanWrapper previousPageAvailable = new ReadOnlyBooleanWrapper(false);
    private final ReadOnlyBooleanWrapper nextPageAvailable = new ReadOnlyBooleanWrapper(false);
    private final ReadOnlyBooleanWrapper loading = new ReadOnlyBooleanWrapper(false);

    private CreatureFilters filters = CreatureFilters.empty();
    private SortOption selectedSort = SortOption.NAME_ASC;
    private int pageOffset;
    private int totalCount;
    private boolean loaded;

    public CatalogViewModel(CreaturesApplicationService creatures) {
        this.creatures = Objects.requireNonNull(creatures, "creatures");
        for (ContentKind kind : ContentKind.values()) {
            contents.add(new CatalogContent(kind.key(), kind.label(), kind.enabled()));
        }
        for (SortOption option : SortOption.values()) {
            sortOptions.add(new SortSelection(option.key(), option.label()));
        }
        columns.setAll(CREATURE_COLUMNS);
    }

    public ObservableList<CatalogContent> contents() {
        return FXCollections.unmodifiableObservableList(contents);
    }

    public ObservableList<SortSelection> sortOptions() {
        return FXCollections.unmodifiableObservableList(sortOptions);
    }

    public ObservableList<CatalogColumn> columns() {
        return FXCollections.unmodifiableObservableList(columns);
    }

    public ObservableList<CatalogRow> rows() {
        return FXCollections.unmodifiableObservableList(rows);
    }

    public ObservableList<FilterChip> chips() {
        return FXCollections.unmodifiableObservableList(chips);
    }

    public ReadOnlyObjectProperty<ContentKind> selectedContentProperty() {
        return selectedContent.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<CreatureFilterData> creatureFilterDataProperty() {
        return creatureFilterData.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty selectedSortKeyProperty() {
        return selectedSortKey.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty countLabelProperty() {
        return countLabel.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty pageLabelProperty() {
        return pageLabel.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty placeholderTextProperty() {
        return placeholderText.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty statusTextProperty() {
        return statusText.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty previousPageAvailableProperty() {
        return previousPageAvailable.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty nextPageAvailableProperty() {
        return nextPageAvailable.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty loadingProperty() {
        return loading.getReadOnlyProperty();
    }

    public void loadInitial() {
        if (loaded) {
            return;
        }
        loaded = true;
        loadCreatureFilterOptions();
        searchCreatures();
    }

    public void selectContent(String key) {
        ContentKind requested = contentKind(key);
        if (!requested.enabled()) {
            statusText.set(requested.label() + " catalog is not migrated yet.");
            return;
        }
        selectedContent.set(requested);
        if (requested == ContentKind.CREATURES) {
            searchCreatures();
        }
    }

    public void applyCreatureFilters(CreatureFilters nextFilters) {
        filters = nextFilters == null ? CreatureFilters.empty() : nextFilters;
        pageOffset = 0;
        rebuildFilterChips();
        searchCreatures();
    }

    public void selectSort(String sortKey) {
        selectedSort = sortOption(sortKey);
        selectedSortKey.set(selectedSort.key());
        pageOffset = 0;
        searchCreatures();
    }

    public void previousPage() {
        if (pageOffset <= 0) {
            return;
        }
        pageOffset = Math.max(0, pageOffset - PAGE_SIZE);
        searchCreatures();
    }

    public void nextPage() {
        if (pageOffset + PAGE_SIZE >= totalCount) {
            return;
        }
        pageOffset += PAGE_SIZE;
        searchCreatures();
    }

    private void loadCreatureFilterOptions() {
        CreatureFilterOptionsResult result = creatures.loadFilterOptions();
        creatureFilterData.set(toCreatureFilterData(result.options()));
        if (result.status() != CreatureReadStatus.SUCCESS) {
            statusText.set("Filteroptionen konnten nicht vollständig geladen werden.");
        }
    }

    private void searchCreatures() {
        loading.set(true);
        placeholderText.set("Lade Monster...");
        CreatureCatalogPageResult result = creatures.searchCatalog(new CreatureCatalogQuery(
                filters.nameQuery(),
                filters.challengeRatingMin(),
                filters.challengeRatingMax(),
                filters.sizes(),
                filters.types(),
                filters.subtypes(),
                filters.biomes(),
                filters.alignments(),
                selectedSort.field,
                selectedSort.direction,
                PAGE_SIZE,
                pageOffset));
        loading.set(false);
        applySearchResult(result);
    }

    private void applySearchResult(CreatureCatalogPageResult result) {
        CreatureCatalogPage page = result == null ? CreatureCatalogPage.empty(PAGE_SIZE, pageOffset) : result.page();
        if (page == null) {
            page = CreatureCatalogPage.empty(PAGE_SIZE, pageOffset);
        }
        totalCount = Math.max(0, page.totalCount());
        rows.setAll(page.rows().stream().map(CatalogViewModel::toCatalogRow).toList());
        updatePagingLabels();
        CreatureQueryStatus status = result == null ? CreatureQueryStatus.STORAGE_ERROR : result.status();
        if (status == CreatureQueryStatus.SUCCESS) {
            placeholderText.set("Keine Monster gefunden");
            statusText.set("");
        } else if (status == CreatureQueryStatus.INVALID_QUERY) {
            placeholderText.set("Filter sind ungültig");
            statusText.set("Filter sind ungültig.");
        } else {
            placeholderText.set("Fehler beim Laden");
            statusText.set("Creature catalog could not be loaded.");
        }
    }

    private void updatePagingLabels() {
        int currentPage = totalCount == 0 ? 1 : (pageOffset / PAGE_SIZE) + 1;
        int totalPages = totalCount == 0 ? 1 : (int) Math.ceil((double) totalCount / PAGE_SIZE);
        countLabel.set(totalCount + " Monster gefunden");
        pageLabel.set("Seite " + currentPage + " / " + totalPages);
        previousPageAvailable.set(pageOffset > 0);
        nextPageAvailable.set(pageOffset + PAGE_SIZE < totalCount);
    }

    private void rebuildFilterChips() {
        chips.clear();
        if (filters.nameQuery() != null) {
            chips.add(new FilterChip("search", "Suche: " + filters.nameQuery(), "chip-type"));
        }
        if (filters.challengeRatingMin() != null || filters.challengeRatingMax() != null) {
            chips.add(new FilterChip("cr", "CR: "
                    + (filters.challengeRatingMin() == null ? "0" : filters.challengeRatingMin())
                    + "-"
                    + (filters.challengeRatingMax() == null ? "30" : filters.challengeRatingMax()), "chip-cr"));
        }
        addChips("size", filters.sizes(), "chip-size");
        addChips("type", filters.types(), "chip-type");
        addChips("subtype", filters.subtypes(), "chip-subtype");
        addChips("biome", filters.biomes(), "chip-biome");
        addChips("alignment", filters.alignments(), "chip-align");
    }

    private void addChips(String prefix, List<String> values, String styleClass) {
        for (String value : values) {
            chips.add(new FilterChip(prefix + ":" + value, value, styleClass));
        }
    }

    private static CatalogRow toCatalogRow(CreatureCatalogRow creature) {
        return new CatalogRow(
                creature.id(),
                List.of(
                        safe(creature.name()),
                        safe(creature.challengeRating()),
                        safe(creature.creatureType()),
                        safe(creature.size()),
                        INTEGER_FORMAT.format(creature.xp())));
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    private static CreatureFilterData toCreatureFilterData(CreatureFilterOptions options) {
        CreatureFilterOptions safeOptions = options == null ? CreatureFilterOptions.empty() : options;
        return new CreatureFilterData(
                safeOptions.sizes(),
                safeOptions.types(),
                safeOptions.subtypes(),
                safeOptions.biomes(),
                safeOptions.alignments(),
                safeOptions.challengeRatings());
    }

    private static List<String> copiedFilterValues(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    private static ContentKind contentKind(String key) {
        for (ContentKind kind : ContentKind.values()) {
            if (kind.key().equals(key)) {
                return kind;
            }
        }
        return ContentKind.CREATURES;
    }

    private static SortOption sortOption(String key) {
        for (SortOption option : SortOption.values()) {
            if (option.key().equals(key)) {
                return option;
            }
        }
        return SortOption.NAME_ASC;
    }

    public record CatalogContent(String key, String label, boolean enabled) {
    }

    public record SortSelection(String key, String label) {
    }

    public record CatalogColumn(String key, String label) {
    }

    public record CatalogRow(long id, List<String> cells) {
        public CatalogRow {
            cells = cells == null ? List.of() : List.copyOf(cells);
        }
    }

    public record FilterChip(String key, String label, String styleClass) {
    }

    public record CreatureFilterData(
            List<String> sizes,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            List<String> alignments,
            List<String> challengeRatings
    ) {
        public CreatureFilterData {
            sizes = copiedFilterValues(sizes);
            types = copiedFilterValues(types);
            subtypes = copiedFilterValues(subtypes);
            biomes = copiedFilterValues(biomes);
            alignments = copiedFilterValues(alignments);
            challengeRatings = copiedFilterValues(challengeRatings);
        }

        public static CreatureFilterData empty() {
            return new CreatureFilterData(List.of(), List.of(), List.of(), List.of(), List.of(), List.of());
        }

    }

    public record CreatureFilters(
            @Nullable String nameQuery,
            @Nullable String challengeRatingMin,
            @Nullable String challengeRatingMax,
            List<String> sizes,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            List<String> alignments
    ) {
        public CreatureFilters {
            sizes = copiedFilterValues(sizes);
            types = copiedFilterValues(types);
            subtypes = copiedFilterValues(subtypes);
            biomes = copiedFilterValues(biomes);
            alignments = copiedFilterValues(alignments);
        }

        public static CreatureFilters empty() {
            return new CreatureFilters(null, null, null, List.of(), List.of(), List.of(), List.of(), List.of());
        }

    }
}
