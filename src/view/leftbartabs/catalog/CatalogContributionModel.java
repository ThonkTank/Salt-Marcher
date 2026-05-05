package src.view.leftbartabs.catalog;

import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;
import javafx.beans.property.ReadOnlyBooleanProperty;
import javafx.beans.property.ReadOnlyBooleanWrapper;
import javafx.beans.property.ReadOnlyListProperty;
import javafx.beans.property.ReadOnlyListWrapper;
import javafx.beans.property.ReadOnlyLongProperty;
import javafx.beans.property.ReadOnlyLongWrapper;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import javafx.collections.FXCollections;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.published.CreatureCatalogPage;
import src.domain.creatures.published.CreatureCatalogPageResult;
import src.domain.creatures.published.CreatureCatalogRow;
import src.domain.creatures.published.CreatureCatalogSortField;
import src.domain.creatures.published.CreatureFilterOptions;
import src.domain.creatures.published.CreatureFilterOptionsResult;
import src.domain.creatures.published.CreatureQueryStatus;
import src.domain.creatures.published.CreatureReadStatus;
import src.domain.creatures.published.CreatureSortDirection;
import src.domain.encounter.published.EncounterDifficultyBand;
import src.domain.encounter.published.EncounterGenerationTuning;
import src.domain.encounter.published.EncounterSessionSnapshot;
import src.domain.encounter.published.EncounterTuningPreviewLabels;
import src.domain.encountertable.published.EncounterTableCatalogResult;
import src.domain.encountertable.published.EncounterTableReadStatus;
import src.domain.encountertable.published.EncounterTableSummary;

public final class CatalogContributionModel {

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

        public CreatureCatalogSortField field() {
            return field;
        }

        public CreatureSortDirection direction() {
            return direction;
        }
    }

    private static final int PAGE_SIZE = 50;
    private static final NumberFormat INTEGER_FORMAT = NumberFormat.getIntegerInstance(Locale.US);
    private static final String AUTO_DIFFICULTY_KEY = "auto";
    private static final String EASY_DIFFICULTY_KEY = "easy";
    private static final String MEDIUM_DIFFICULTY_KEY = "medium";
    private static final String HARD_DIFFICULTY_KEY = "hard";
    private static final String DEADLY_DIFFICULTY_KEY = "deadly";
    private static final String SEARCH_CHIP_KEY = "search";
    private static final String CHALLENGE_RATING_CHIP_KEY = "cr";
    private static final String ENCOUNTER_TABLE_CHIP_PREFIX = "encounter-table:";
    private static final List<CatalogColumn> CREATURE_COLUMNS = List.of(
            new CatalogColumn("name", "Name"),
            new CatalogColumn("cr", "CR"),
            new CatalogColumn("type", "Typ"),
            new CatalogColumn("size", "Größe"),
            new CatalogColumn("xp", "XP"));

    private final ReadOnlyListWrapper<CatalogContent> contents =
            new ReadOnlyListWrapper<>(FXCollections.observableArrayList());
    private final ReadOnlyListWrapper<SortSelection> sortOptions =
            new ReadOnlyListWrapper<>(FXCollections.observableArrayList());
    private final ReadOnlyListWrapper<CatalogColumn> columns =
            new ReadOnlyListWrapper<>(FXCollections.observableArrayList());
    private final ReadOnlyListWrapper<CatalogRow> rows =
            new ReadOnlyListWrapper<>(FXCollections.observableArrayList());
    private final ReadOnlyListWrapper<FilterChip> chips =
            new ReadOnlyListWrapper<>(FXCollections.observableArrayList());
    private final ReadOnlyListWrapper<EncounterTableOption> encounterTableOptions =
            new ReadOnlyListWrapper<>(FXCollections.observableArrayList());
    private final ReadOnlyObjectWrapper<ContentKind> selectedContent = new ReadOnlyObjectWrapper<>(ContentKind.CREATURES);
    private final ReadOnlyObjectWrapper<CreatureFilters> creatureFilters =
            new ReadOnlyObjectWrapper<>(CreatureFilters.empty());
    private final ReadOnlyObjectWrapper<FilterOptionsProjection> filterOptions =
            new ReadOnlyObjectWrapper<>(FilterOptionsProjection.empty());
    private final ReadOnlyObjectWrapper<EncounterBuilderInputsViewState> encounterBuilderInputs =
            new ReadOnlyObjectWrapper<>(EncounterBuilderInputsViewState.empty());
    private final ReadOnlyObjectWrapper<EncounterTuningPreviewProjection> encounterTuningPreview =
            new ReadOnlyObjectWrapper<>(EncounterTuningPreviewProjection.empty());
    private final ReadOnlyObjectWrapper<FilterDropdownState> sizeDropdownState =
            new ReadOnlyObjectWrapper<>(FilterDropdownState.closed());
    private final ReadOnlyObjectWrapper<FilterDropdownState> typeDropdownState =
            new ReadOnlyObjectWrapper<>(FilterDropdownState.closed());
    private final ReadOnlyObjectWrapper<FilterDropdownState> subtypeDropdownState =
            new ReadOnlyObjectWrapper<>(FilterDropdownState.closed());
    private final ReadOnlyObjectWrapper<FilterDropdownState> biomeDropdownState =
            new ReadOnlyObjectWrapper<>(FilterDropdownState.closed());
    private final ReadOnlyObjectWrapper<FilterDropdownState> alignmentDropdownState =
            new ReadOnlyObjectWrapper<>(FilterDropdownState.closed());
    private final ReadOnlyObjectWrapper<FilterDropdownState> encounterTableDropdownState =
            new ReadOnlyObjectWrapper<>(FilterDropdownState.closed());
    private final ReadOnlyStringWrapper selectedSortKey = new ReadOnlyStringWrapper(SortOption.NAME_ASC.key());
    private final ReadOnlyStringWrapper countLabel = new ReadOnlyStringWrapper("0 Monster gefunden");
    private final ReadOnlyStringWrapper pageLabel = new ReadOnlyStringWrapper("Seite 1 / 1");
    private final ReadOnlyStringWrapper placeholderText = new ReadOnlyStringWrapper("Lade Monster...");
    private final ReadOnlyStringWrapper statusText = new ReadOnlyStringWrapper("");
    private final ReadOnlyBooleanWrapper previousPageAvailable = new ReadOnlyBooleanWrapper(false);
    private final ReadOnlyBooleanWrapper nextPageAvailable = new ReadOnlyBooleanWrapper(false);
    private final ReadOnlyBooleanWrapper loading = new ReadOnlyBooleanWrapper(false);
    private final ReadOnlyLongWrapper searchCycle = new ReadOnlyLongWrapper(0L);
    private final ReadOnlyLongWrapper creatureDetailSelection = new ReadOnlyLongWrapper(0L);
    private SortOption selectedSort = SortOption.NAME_ASC;
    private int pageOffset;
    private int totalCount;

    public CatalogContributionModel() {
        for (ContentKind kind : ContentKind.values()) {
            contents.add(new CatalogContent(kind.key(), kind.label(), kind.enabled()));
        }
        for (SortOption option : SortOption.values()) {
            sortOptions.add(new SortSelection(option.key(), option.label()));
        }
        columns.setAll(CREATURE_COLUMNS);
    }

    public ReadOnlyListProperty<CatalogContent> contentsProperty() {
        return contents.getReadOnlyProperty();
    }

    public ReadOnlyListProperty<SortSelection> sortOptionsProperty() {
        return sortOptions.getReadOnlyProperty();
    }

    public ReadOnlyListProperty<CatalogColumn> columnsProperty() {
        return columns.getReadOnlyProperty();
    }

    public ReadOnlyListProperty<CatalogRow> rowsProperty() {
        return rows.getReadOnlyProperty();
    }

    public ReadOnlyListProperty<FilterChip> chipsProperty() {
        return chips.getReadOnlyProperty();
    }

    public ReadOnlyListProperty<EncounterTableOption> encounterTableOptionsProperty() {
        return encounterTableOptions.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<ContentKind> selectedContentProperty() {
        return selectedContent.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<CreatureFilters> creatureFiltersProperty() {
        return creatureFilters.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<FilterOptionsProjection> filterOptionsProperty() {
        return filterOptions.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<EncounterBuilderInputsViewState> encounterBuilderInputsProperty() {
        return encounterBuilderInputs.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<EncounterTuningPreviewProjection> encounterTuningPreviewProperty() {
        return encounterTuningPreview.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<FilterDropdownState> sizeDropdownStateProperty() {
        return sizeDropdownState.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<FilterDropdownState> typeDropdownStateProperty() {
        return typeDropdownState.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<FilterDropdownState> subtypeDropdownStateProperty() {
        return subtypeDropdownState.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<FilterDropdownState> biomeDropdownStateProperty() {
        return biomeDropdownState.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<FilterDropdownState> alignmentDropdownStateProperty() {
        return alignmentDropdownState.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<FilterDropdownState> encounterTableDropdownStateProperty() {
        return encounterTableDropdownState.getReadOnlyProperty();
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

    public ReadOnlyLongProperty searchCycleProperty() {
        return searchCycle.getReadOnlyProperty();
    }

    public ReadOnlyLongProperty creatureDetailSelectionProperty() {
        return creatureDetailSelection.getReadOnlyProperty();
    }

    public void selectContent(String key) {
        ContentKind requested = contentKind(key);
        if (!requested.enabled()) {
            statusText.set(requested.label() + " catalog is not migrated yet.");
            return;
        }
        selectedContent.set(requested);
    }

    public void applyControlsSnapshot(CatalogControlsViewInputEvent event) {
        if (event == null) {
            return;
        }
        creatureFilters.set(new CreatureFilters(
                event.nameQuery(),
                event.challengeRatingMin(),
                event.challengeRatingMax(),
                event.sizes(),
                event.types(),
                event.subtypes(),
                event.biomes(),
                event.alignments()));
        encounterBuilderInputs.set(new EncounterBuilderInputsViewState(
                event.types(),
                event.subtypes(),
                event.biomes(),
                event.difficultyKey(),
                event.balanceLevel(),
                event.amountValue(),
                event.diversityLevel(),
                event.encounterTableIds()));
        sizeDropdownState.set(new FilterDropdownState(event.sizePopupOpen(), event.sizePopupQuery()));
        typeDropdownState.set(new FilterDropdownState(event.typePopupOpen(), event.typePopupQuery()));
        subtypeDropdownState.set(new FilterDropdownState(event.subtypePopupOpen(), event.subtypePopupQuery()));
        biomeDropdownState.set(new FilterDropdownState(event.biomePopupOpen(), event.biomePopupQuery()));
        alignmentDropdownState.set(new FilterDropdownState(event.alignmentPopupOpen(), event.alignmentPopupQuery()));
        encounterTableDropdownState.set(new FilterDropdownState(event.encounterTablePopupOpen(), ""));
        rebuildChips();
    }

    public void applyCreatureFilterOptions(CreatureFilterOptionsResult result) {
        CreatureFilterOptions options = result == null || result.options() == null
                ? CreatureFilterOptions.empty()
                : result.options();
        filterOptions.set(new FilterOptionsProjection(
                options.sizes(),
                options.types(),
                options.subtypes(),
                options.biomes(),
                options.alignments(),
                options.challengeRatings()));
        pruneInvalidSelections();
        if (result != null && result.status() != CreatureReadStatus.SUCCESS) {
            statusText.set("Filteroptionen konnten nicht vollständig geladen werden.");
        }
    }

    public boolean applyEncounterBuilderInputs(EncounterSessionSnapshot.BuilderInputs builderInputs) {
        EncounterBuilderInputsViewState nextState = toEncounterBuilderInputs(builderInputs);
        if (nextState.equals(encounterBuilderInputs.get())) {
            return false;
        }
        encounterBuilderInputs.set(nextState);
        CreatureFilters currentFilters = creatureFilters.get();
        creatureFilters.set(new CreatureFilters(
                currentFilters.nameQuery(),
                currentFilters.challengeRatingMin(),
                currentFilters.challengeRatingMax(),
                currentFilters.sizes(),
                nextState.creatureTypes(),
                nextState.creatureSubtypes(),
                nextState.biomes(),
                currentFilters.alignments()));
        rebuildChips();
        return true;
    }

    public void applyEncounterTables(EncounterTableCatalogResult result) {
        if (result == null || result.status() != EncounterTableReadStatus.SUCCESS) {
            encounterTableOptions.setAll(List.of());
            EncounterBuilderInputsViewState currentInputs = encounterBuilderInputs.get();
            encounterBuilderInputs.set(new EncounterBuilderInputsViewState(
                    currentInputs.creatureTypes(),
                    currentInputs.creatureSubtypes(),
                    currentInputs.biomes(),
                    currentInputs.difficultyKey(),
                    currentInputs.balanceLevel(),
                    currentInputs.amountValue(),
                    currentInputs.diversityLevel(),
                    List.of()));
            rebuildChips();
            return;
        }
        encounterTableOptions.setAll(result.tables().stream()
                .map(CatalogContributionModel::toEncounterTableOption)
                .toList());
        pruneUnavailableEncounterTables();
        rebuildChips();
    }

    public void applyEncounterTuningPreview(EncounterTuningPreviewLabels labels) {
        EncounterTuningPreviewLabels safeLabels = labels == null
                ? new EncounterTuningPreviewLabels(List.of(), List.of(), List.of(), List.of())
                : labels;
        encounterTuningPreview.set(new EncounterTuningPreviewProjection(
                toPreviewLabels(safeLabels.difficultyLabels()),
                toPreviewLabels(safeLabels.balanceLabels()),
                toPreviewLabels(safeLabels.amountLabels()),
                toPreviewLabels(safeLabels.diversityLabels())));
    }

    public void selectSort(String sortKey) {
        selectedSort = sortOption(sortKey);
        selectedSortKey.set(selectedSort.key());
        pageOffset = 0;
    }

    public void previousPage() {
        if (pageOffset <= 0) {
            return;
        }
        pageOffset = Math.max(0, pageOffset - PAGE_SIZE);
    }

    public void nextPage() {
        if (pageOffset + PAGE_SIZE >= totalCount) {
            return;
        }
        pageOffset += PAGE_SIZE;
    }

    public void applySearchResult(CreatureCatalogPageResult result) {
        loading.set(false);
        applySearchResultInternal(result);
    }

    void beginSearch() {
        loading.set(true);
        placeholderText.set("Lade Monster...");
    }

    void advanceSearchCycle() {
        searchCycle.set(searchCycle.get() + 1L);
    }

    void selectCreatureDetail(long creatureId) {
        creatureDetailSelection.set(Math.max(0L, creatureId));
    }

    void clearCreatureDetailSelection() {
        creatureDetailSelection.set(0L);
    }

    CreatureFilters currentFilters() {
        return creatureFilters.get();
    }

    EncounterBuilderInputsViewState currentEncounterBuilderInputs() {
        return encounterBuilderInputs.get();
    }

    SortOption currentSortOption() {
        return selectedSort;
    }

    int currentPageSize() {
        return PAGE_SIZE;
    }

    int currentPageOffset() {
        return pageOffset;
    }

    private void pruneInvalidSelections() {
        FilterOptionsProjection options = filterOptions.get();
        CreatureFilters currentFilters = creatureFilters.get();
        CreatureFilters prunedFilters = new CreatureFilters(
                currentFilters.nameQuery(),
                currentFilters.challengeRatingMin(),
                currentFilters.challengeRatingMax(),
                retainAvailable(currentFilters.sizes(), options.sizes()),
                retainAvailable(currentFilters.types(), options.types()),
                retainAvailable(currentFilters.subtypes(), options.subtypes()),
                retainAvailable(currentFilters.biomes(), options.biomes()),
                retainAvailable(currentFilters.alignments(), options.alignments()));
        creatureFilters.set(prunedFilters);

        EncounterBuilderInputsViewState currentInputs = encounterBuilderInputs.get();
        encounterBuilderInputs.set(new EncounterBuilderInputsViewState(
                retainAvailable(currentInputs.creatureTypes(), options.types()),
                retainAvailable(currentInputs.creatureSubtypes(), options.subtypes()),
                retainAvailable(currentInputs.biomes(), options.biomes()),
                currentInputs.difficultyKey(),
                currentInputs.balanceLevel(),
                currentInputs.amountValue(),
                currentInputs.diversityLevel(),
                currentInputs.encounterTableIds()));
        rebuildChips();
    }

    private void pruneUnavailableEncounterTables() {
        EncounterBuilderInputsViewState currentInputs = encounterBuilderInputs.get();
        List<Long> availableIds = encounterTableOptions.stream().map(EncounterTableOption::tableId).toList();
        encounterBuilderInputs.set(new EncounterBuilderInputsViewState(
                currentInputs.creatureTypes(),
                currentInputs.creatureSubtypes(),
                currentInputs.biomes(),
                currentInputs.difficultyKey(),
                currentInputs.balanceLevel(),
                currentInputs.amountValue(),
                currentInputs.diversityLevel(),
                retainAvailable(currentInputs.encounterTableIds(), availableIds)));
    }

    private void applySearchResultInternal(CreatureCatalogPageResult result) {
        CreatureCatalogPage page = result == null ? CreatureCatalogPage.empty(PAGE_SIZE, pageOffset) : result.page();
        if (page == null) {
            page = CreatureCatalogPage.empty(PAGE_SIZE, pageOffset);
        }
        totalCount = Math.max(0, page.totalCount());
        rows.setAll(page.rows().stream().map(CatalogContributionModel::toCatalogRow).toList());
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

    private void rebuildChips() {
        chips.clear();
        CreatureFilters filters = creatureFilters.get();
        if (!filters.nameQuery().isBlank()) {
            chips.add(new FilterChip(SEARCH_CHIP_KEY, "Suche: " + filters.nameQuery(), "chip-type"));
        }
        if (!filters.challengeRatingMin().isBlank() || !filters.challengeRatingMax().isBlank()) {
            chips.add(new FilterChip(
                    CHALLENGE_RATING_CHIP_KEY,
                    "CR: " + defaultCrMinimum(filters.challengeRatingMin()) + "-" + defaultCrMaximum(filters.challengeRatingMax()),
                    "chip-cr"));
        }
        addChips("size", filters.sizes(), "chip-size");
        addChips("type", filters.types(), "chip-type");
        addChips("subtype", filters.subtypes(), "chip-subtype");
        addChips("biome", filters.biomes(), "chip-biome");
        addChips("alignment", filters.alignments(), "chip-align");
        addEncounterTableChips(encounterBuilderInputs.get().encounterTableIds());
    }

    private void addChips(String prefix, List<String> values, String styleClass) {
        for (String value : values) {
            chips.add(new FilterChip(prefix + ":" + value, value, styleClass));
        }
    }

    private void addEncounterTableChips(List<Long> encounterTableIds) {
        for (Long tableId : encounterTableIds) {
            EncounterTableOption option = encounterTableOption(tableId);
            if (option == null) {
                continue;
            }
            chips.add(new FilterChip(
                    ENCOUNTER_TABLE_CHIP_PREFIX + option.tableId(),
                    option.name(),
                    "chip-table"));
        }
    }

    private EncounterTableOption encounterTableOption(Long tableId) {
        if (tableId == null) {
            return null;
        }
        for (EncounterTableOption option : encounterTableOptions) {
            if (option.tableId() == tableId.longValue()) {
                return option;
            }
        }
        return null;
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

    private static EncounterTableOption toEncounterTableOption(EncounterTableSummary summary) {
        return new EncounterTableOption(summary.tableId(), summary.name(), summary.linkedLootTableId());
    }

    private static List<PreviewLabel> toPreviewLabels(List<EncounterTuningPreviewLabels.PreviewLabel> labels) {
        return labels == null
                ? List.of()
                : labels.stream().map(label -> new PreviewLabel(label.value(), label.label())).toList();
    }

    private static EncounterBuilderInputsViewState toEncounterBuilderInputs(EncounterSessionSnapshot.BuilderInputs builderInputs) {
        EncounterSessionSnapshot.BuilderInputs safeInputs = builderInputs == null
                ? EncounterSessionSnapshot.BuilderInputs.empty()
                : builderInputs;
        EncounterGenerationTuning tuning = safeInputs.tuning();
        return new EncounterBuilderInputsViewState(
                safeInputs.creatureTypes(),
                safeInputs.creatureSubtypes(),
                safeInputs.biomes(),
                difficultyKey(safeInputs.targetDifficulty()),
                tuning.balanceLevel(),
                tuning.amountValue(),
                tuning.diversityLevel(),
                safeInputs.encounterTableIds());
    }

    private static String difficultyKey(EncounterDifficultyBand band) {
        return switch (band == null ? EncounterDifficultyBand.AUTO : band) {
            case AUTO -> AUTO_DIFFICULTY_KEY;
            case EASY -> EASY_DIFFICULTY_KEY;
            case MEDIUM -> MEDIUM_DIFFICULTY_KEY;
            case HARD -> HARD_DIFFICULTY_KEY;
            case DEADLY -> DEADLY_DIFFICULTY_KEY;
        };
    }

    private static String defaultCrMinimum(String value) {
        return value == null || value.isBlank() ? "0" : value;
    }

    private static String defaultCrMaximum(String value) {
        return value == null || value.isBlank() ? "30" : value;
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    private static <T> List<T> retainAvailable(List<T> selectedValues, List<T> availableValues) {
        if (selectedValues == null || selectedValues.isEmpty()) {
            return List.of();
        }
        List<T> safeAvailable = availableValues == null ? List.of() : List.copyOf(availableValues);
        return selectedValues.stream()
                .filter(safeAvailable::contains)
                .distinct()
                .toList();
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
            nameQuery = nameQuery == null ? "" : nameQuery;
            challengeRatingMin = challengeRatingMin == null ? "" : challengeRatingMin;
            challengeRatingMax = challengeRatingMax == null ? "" : challengeRatingMax;
            sizes = copiedFilterValues(sizes);
            types = copiedFilterValues(types);
            subtypes = copiedFilterValues(subtypes);
            biomes = copiedFilterValues(biomes);
            alignments = copiedFilterValues(alignments);
        }

        @Override
        public List<String> sizes() {
            return copiedFilterValues(sizes);
        }

        @Override
        public List<String> types() {
            return copiedFilterValues(types);
        }

        @Override
        public List<String> subtypes() {
            return copiedFilterValues(subtypes);
        }

        @Override
        public List<String> biomes() {
            return copiedFilterValues(biomes);
        }

        @Override
        public List<String> alignments() {
            return copiedFilterValues(alignments);
        }

        public static CreatureFilters empty() {
            return new CreatureFilters("", "", "", List.of(), List.of(), List.of(), List.of(), List.of());
        }
    }

    public record FilterOptionsProjection(
            List<String> sizes,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            List<String> alignments,
            List<String> challengeRatings
    ) {
        public FilterOptionsProjection {
            sizes = copiedFilterValues(sizes);
            types = copiedFilterValues(types);
            subtypes = copiedFilterValues(subtypes);
            biomes = copiedFilterValues(biomes);
            alignments = copiedFilterValues(alignments);
            challengeRatings = copiedFilterValues(challengeRatings);
        }

        @Override
        public List<String> sizes() {
            return copiedFilterValues(sizes);
        }

        @Override
        public List<String> types() {
            return copiedFilterValues(types);
        }

        @Override
        public List<String> subtypes() {
            return copiedFilterValues(subtypes);
        }

        @Override
        public List<String> biomes() {
            return copiedFilterValues(biomes);
        }

        @Override
        public List<String> alignments() {
            return copiedFilterValues(alignments);
        }

        @Override
        public List<String> challengeRatings() {
            return copiedFilterValues(challengeRatings);
        }

        static FilterOptionsProjection empty() {
            return new FilterOptionsProjection(List.of(), List.of(), List.of(), List.of(), List.of(), List.of());
        }
    }

    public record EncounterBuilderInputsViewState(
            List<String> creatureTypes,
            List<String> creatureSubtypes,
            List<String> biomes,
            String difficultyKey,
            int balanceLevel,
            double amountValue,
            int diversityLevel,
            List<Long> encounterTableIds
    ) {
        public EncounterBuilderInputsViewState {
            creatureTypes = copiedFilterValues(creatureTypes);
            creatureSubtypes = copiedFilterValues(creatureSubtypes);
            biomes = copiedFilterValues(biomes);
            difficultyKey = difficultyKey == null ? "" : difficultyKey;
            encounterTableIds = encounterTableIds == null ? List.of() : List.copyOf(encounterTableIds);
        }

        @Override
        public List<String> creatureTypes() {
            return copiedFilterValues(creatureTypes);
        }

        @Override
        public List<String> creatureSubtypes() {
            return copiedFilterValues(creatureSubtypes);
        }

        @Override
        public List<String> biomes() {
            return copiedFilterValues(biomes);
        }

        @Override
        public List<Long> encounterTableIds() {
            return encounterTableIds == null ? List.of() : List.copyOf(encounterTableIds);
        }

        static EncounterBuilderInputsViewState empty() {
            return new EncounterBuilderInputsViewState(
                    List.of(),
                    List.of(),
                    List.of(),
                    AUTO_DIFFICULTY_KEY,
                    EncounterGenerationTuning.AUTO_BALANCE_LEVEL,
                    EncounterGenerationTuning.AUTO_AMOUNT_VALUE,
                    EncounterGenerationTuning.AUTO_DIVERSITY_LEVEL,
                    List.of());
        }
    }

    public record EncounterTableOption(long tableId, String name, @Nullable Long linkedLootTableId) {
        public EncounterTableOption {
            name = name == null || name.isBlank() ? "Tabelle " + tableId : name;
        }
    }

    public record PreviewLabel(double value, String label) {
        public PreviewLabel {
            label = label == null ? "" : label;
        }
    }

    public record EncounterTuningPreviewProjection(
            List<PreviewLabel> difficultyLabels,
            List<PreviewLabel> balanceLabels,
            List<PreviewLabel> amountLabels,
            List<PreviewLabel> diversityLabels
    ) {
        public EncounterTuningPreviewProjection {
            difficultyLabels = copyPreviewLabels(difficultyLabels);
            balanceLabels = copyPreviewLabels(balanceLabels);
            amountLabels = copyPreviewLabels(amountLabels);
            diversityLabels = copyPreviewLabels(diversityLabels);
        }

        @Override
        public List<PreviewLabel> difficultyLabels() {
            return copyPreviewLabels(difficultyLabels);
        }

        @Override
        public List<PreviewLabel> balanceLabels() {
            return copyPreviewLabels(balanceLabels);
        }

        @Override
        public List<PreviewLabel> amountLabels() {
            return copyPreviewLabels(amountLabels);
        }

        @Override
        public List<PreviewLabel> diversityLabels() {
            return copyPreviewLabels(diversityLabels);
        }

        static EncounterTuningPreviewProjection empty() {
            return new EncounterTuningPreviewProjection(List.of(), List.of(), List.of(), List.of());
        }
    }

    public record FilterDropdownState(boolean open, String searchQuery) {
        public FilterDropdownState {
            searchQuery = searchQuery == null ? "" : searchQuery;
        }

        static FilterDropdownState closed() {
            return new FilterDropdownState(false, "");
        }
    }

    private static List<PreviewLabel> copyPreviewLabels(List<PreviewLabel> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
