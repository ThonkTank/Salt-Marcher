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
    private static final double DEFAULT_DIFFICULTY_VALUE = 2.0;
    private static final double DEFAULT_BALANCE_VALUE = 3.0;
    private static final double DEFAULT_AMOUNT_VALUE = 3.0;
    private static final double DEFAULT_DIVERSITY_VALUE = 3.0;
    private static final double MIN_DIFFICULTY_VALUE = 1.0;
    private static final double MAX_DIFFICULTY_VALUE = 4.0;
    private static final double MIN_BALANCE_VALUE = 1.0;
    private static final double MAX_BALANCE_VALUE = 5.0;
    private static final double MIN_AMOUNT_VALUE = 1.0;
    private static final double MAX_AMOUNT_VALUE = 5.0;
    private static final double MIN_DIVERSITY_VALUE = 1.0;
    private static final double MAX_DIVERSITY_VALUE = 4.0;
    private static final String SEARCH_CHIP_KEY = "search";
    private static final String CHALLENGE_RATING_CHIP_KEY = "cr";
    private static final String ENCOUNTER_TABLE_CHIP_PREFIX = "encounter-table:";
    private static final List<KeyLabel> CREATURE_COLUMNS = List.of(
            new KeyLabel("name", "Name"),
            new KeyLabel("cr", "CR"),
            new KeyLabel("type", "Typ"),
            new KeyLabel("size", "Größe"),
            new KeyLabel("xp", "XP"));
    private static final List<PreviewLabel> DEFAULT_DIFFICULTY_LABELS = List.of(
            new PreviewLabel(1.0, "25-49 XP"),
            new PreviewLabel(2.0, "50-74 XP"),
            new PreviewLabel(3.0, "75-99 XP"),
            new PreviewLabel(4.0, "100-125 XP"));
    private static final List<PreviewLabel> DEFAULT_BALANCE_LABELS = List.of(
            new PreviewLabel(1.0, "Extreme++"),
            new PreviewLabel(2.0, "Extreme+"),
            new PreviewLabel(3.0, "Neutral"),
            new PreviewLabel(4.0, "Durchschnitt+"),
            new PreviewLabel(5.0, "Durchschnitt++"));
    private static final List<PreviewLabel> DEFAULT_AMOUNT_LABELS = List.of(
            new PreviewLabel(1.0, "Boss++"),
            new PreviewLabel(2.0, "Boss+"),
            new PreviewLabel(3.0, "Ausgeglichen"),
            new PreviewLabel(4.0, "Minions+"),
            new PreviewLabel(5.0, "Minions++"));
    private static final List<PreviewLabel> DEFAULT_DIVERSITY_LABELS = List.of(
            new PreviewLabel(1.0, "1 Typ"),
            new PreviewLabel(2.0, "2 Typen"),
            new PreviewLabel(3.0, "3 Typen"),
            new PreviewLabel(4.0, "4 Typen"));

    private final ReadOnlyListWrapper<CatalogContent> contents =
            new ReadOnlyListWrapper<>(FXCollections.observableArrayList());
    private final ReadOnlyListWrapper<KeyLabel> sortOptions =
            new ReadOnlyListWrapper<>(FXCollections.observableArrayList());
    private final ReadOnlyListWrapper<KeyLabel> columns =
            new ReadOnlyListWrapper<>(FXCollections.observableArrayList());
    private final ReadOnlyListWrapper<CatalogRow> rows =
            new ReadOnlyListWrapper<>(FXCollections.observableArrayList());
    private final ReadOnlyListWrapper<FilterChip> chips =
            new ReadOnlyListWrapper<>(FXCollections.observableArrayList());
    private final ReadOnlyListWrapper<EncounterTableOption> encounterTableOptions =
            new ReadOnlyListWrapper<>(FXCollections.observableArrayList());
    private final ReadOnlyObjectWrapper<ContentKind> selectedContent = new ReadOnlyObjectWrapper<>(ContentKind.CREATURES);
    private final ReadOnlyObjectWrapper<LocalFilterState> localFilters =
            new ReadOnlyObjectWrapper<>(LocalFilterState.empty());
    private final ReadOnlyObjectWrapper<CreatureFilters> creatureFilters =
            new ReadOnlyObjectWrapper<>(CreatureFilters.empty());
    private final ReadOnlyObjectWrapper<FilterOptionsProjection> filterOptions =
            new ReadOnlyObjectWrapper<>(FilterOptionsProjection.empty());
    private final ReadOnlyObjectWrapper<ControlsState> authoritativeControls =
            new ReadOnlyObjectWrapper<>(ControlsState.empty());
    private final ReadOnlyObjectWrapper<ControlsState> controlsState =
            new ReadOnlyObjectWrapper<>(ControlsState.empty());
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
            sortOptions.add(new KeyLabel(option.key(), option.label()));
        }
        columns.setAll(CREATURE_COLUMNS);
        refreshViewFilters();
        rebuildChips();
    }

    public ReadOnlyListProperty<CatalogContent> contentsProperty() {
        return contents.getReadOnlyProperty();
    }

    public ReadOnlyListProperty<KeyLabel> sortOptionsProperty() {
        return sortOptions.getReadOnlyProperty();
    }

    public ReadOnlyListProperty<KeyLabel> columnsProperty() {
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

    public ReadOnlyObjectProperty<ControlsState> controlsStateProperty() {
        return controlsState.getReadOnlyProperty();
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

    void applyControlsDraft(
            LocalFilterState nextLocalFilters,
            ControlsState nextControlsState,
            FilterDropdownState nextSizeDropdownState,
            FilterDropdownState nextTypeDropdownState,
            FilterDropdownState nextSubtypeDropdownState,
            FilterDropdownState nextBiomeDropdownState,
            FilterDropdownState nextAlignmentDropdownState,
            FilterDropdownState nextEncounterTableDropdownState
    ) {
        localFilters.set(nextLocalFilters == null ? LocalFilterState.empty() : nextLocalFilters);
        controlsState.set(nextControlsState == null ? ControlsState.empty() : nextControlsState);
        sizeDropdownState.set(nextSizeDropdownState == null ? FilterDropdownState.closed() : nextSizeDropdownState);
        typeDropdownState.set(nextTypeDropdownState == null ? FilterDropdownState.closed() : nextTypeDropdownState);
        subtypeDropdownState.set(nextSubtypeDropdownState == null ? FilterDropdownState.closed() : nextSubtypeDropdownState);
        biomeDropdownState.set(nextBiomeDropdownState == null ? FilterDropdownState.closed() : nextBiomeDropdownState);
        alignmentDropdownState.set(nextAlignmentDropdownState == null ? FilterDropdownState.closed() : nextAlignmentDropdownState);
        encounterTableDropdownState.set(nextEncounterTableDropdownState == null
                ? FilterDropdownState.closed()
                : nextEncounterTableDropdownState);
        refreshViewFilters();
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
        pruneInvalidLocalSelections();
        if (result != null && result.status() != CreatureReadStatus.SUCCESS) {
            statusText.set("Filteroptionen konnten nicht vollständig geladen werden.");
        }
    }

    public boolean applyEncounterBuilderInputs(EncounterSessionSnapshot.BuilderInputs builderInputs) {
        ControlsState previousAuthoritative = authoritativeControls.get();
        ControlsState next = toControlsState(builderInputs, previousAuthoritative);
        authoritativeControls.set(next);
        controlsState.set(next);
        refreshViewFilters();
        rebuildChips();
        return searchControlsChanged(previousAuthoritative, next);
    }

    public void applyEncounterTables(EncounterTableCatalogResult result) {
        if (result == null || result.status() != EncounterTableReadStatus.SUCCESS) {
            encounterTableOptions.setAll(List.of());
            rebuildChips();
            return;
        }
        encounterTableOptions.setAll(result.tables().stream()
                .map(CatalogContributionModel::toEncounterTableOption)
                .toList());
        rebuildChips();
    }

    public void applyEncounterTuningPreview(EncounterTuningPreviewLabels labels) {
        ControlsState nextAuthoritative = withPreviewLabels(authoritativeControls.get(), labels);
        ControlsState nextDraft = withPreviewLabels(controlsState.get(), labels);
        authoritativeControls.set(nextAuthoritative);
        controlsState.set(nextDraft);
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

    LocalFilterState currentLocalFilters() {
        return localFilters.get();
    }

    ControlsState currentControlsState() {
        return controlsState.get();
    }

    ControlsState currentDomainControls() {
        return authoritativeControls.get();
    }

    CreatureFilters currentFilters() {
        return mergedFilters(localFilters.get(), authoritativeControls.get());
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

    private void pruneInvalidLocalSelections() {
        FilterOptionsProjection options = filterOptions.get();
        LocalFilterState currentLocal = localFilters.get();
        localFilters.set(new LocalFilterState(
                currentLocal.nameQuery(),
                currentLocal.challengeRatingMin(),
                currentLocal.challengeRatingMax(),
                retainAvailable(currentLocal.sizes(), options.sizes()),
                retainAvailable(currentLocal.alignments(), options.alignments())));
        refreshViewFilters();
        rebuildChips();
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

    private void refreshViewFilters() {
        creatureFilters.set(mergedFilters(localFilters.get(), controlsState.get()));
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
        addEncounterTableChips(controlsState.get().encounterTableIds());
    }

    private void addChips(String prefix, List<String> values, String styleClass) {
        for (String value : values) {
            chips.add(new FilterChip(prefix + ":" + value, value, styleClass));
        }
    }

    private void addEncounterTableChips(List<Long> encounterTableIds) {
        for (Long tableId : encounterTableIds) {
            if (tableId == null) {
                continue;
            }
            EncounterTableOption option = encounterTableOption(tableId);
            chips.add(new FilterChip(
                    ENCOUNTER_TABLE_CHIP_PREFIX + tableId,
                    option == null ? "Tabelle " + tableId : option.name(),
                    "chip-table"));
        }
    }

    private @Nullable EncounterTableOption encounterTableOption(Long tableId) {
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

    private static ControlsState toControlsState(
            EncounterSessionSnapshot.BuilderInputs builderInputs,
            ControlsState source
    ) {
        EncounterSessionSnapshot.BuilderInputs safeInputs = builderInputs == null
                ? EncounterSessionSnapshot.BuilderInputs.empty()
                : builderInputs;
        ControlsState safeSource = source == null ? ControlsState.empty() : source;
        EncounterGenerationTuning tuning = safeInputs.tuning();
        return new ControlsState(
                safeInputs.creatureTypes(),
                safeInputs.creatureSubtypes(),
                safeInputs.biomes(),
                safeInputs.encounterTableIds(),
                difficultyProjection(safeInputs.targetDifficulty(), safeSource.difficulty().labels()),
                sliderProjection(
                        tuning.isBalanceAuto(),
                        tuning.isBalanceAuto() ? DEFAULT_BALANCE_VALUE : tuning.balanceLevel(),
                        safeSource.balance().labels(),
                        DEFAULT_BALANCE_VALUE),
                sliderProjection(
                        tuning.isAmountAuto(),
                        tuning.isAmountAuto() ? DEFAULT_AMOUNT_VALUE : tuning.amountValue(),
                        safeSource.amount().labels(),
                        DEFAULT_AMOUNT_VALUE),
                sliderProjection(
                        tuning.isDiversityAuto(),
                        tuning.isDiversityAuto() ? DEFAULT_DIVERSITY_VALUE : tuning.diversityLevel(),
                        safeSource.diversity().labels(),
                        DEFAULT_DIVERSITY_VALUE));
    }

    private static ControlsState withPreviewLabels(ControlsState state, @Nullable EncounterTuningPreviewLabels labels) {
        ControlsState safeState = state == null ? ControlsState.empty() : state;
        EncounterTuningPreviewLabels safeLabels = labels == null
                ? new EncounterTuningPreviewLabels(List.of(), List.of(), List.of(), List.of())
                : labels;
        return new ControlsState(
                safeState.creatureTypes(),
                safeState.creatureSubtypes(),
                safeState.biomes(),
                safeState.encounterTableIds(),
                sliderProjection(safeState.difficulty().auto(), safeState.difficulty().value(),
                        toPreviewLabels(safeLabels.difficultyLabels(), DEFAULT_DIFFICULTY_LABELS), DEFAULT_DIFFICULTY_VALUE),
                sliderProjection(safeState.balance().auto(), safeState.balance().value(),
                        toPreviewLabels(safeLabels.balanceLabels(), DEFAULT_BALANCE_LABELS), DEFAULT_BALANCE_VALUE),
                sliderProjection(safeState.amount().auto(), safeState.amount().value(),
                        toPreviewLabels(safeLabels.amountLabels(), DEFAULT_AMOUNT_LABELS), DEFAULT_AMOUNT_VALUE),
                sliderProjection(safeState.diversity().auto(), safeState.diversity().value(),
                        toPreviewLabels(safeLabels.diversityLabels(), DEFAULT_DIVERSITY_LABELS), DEFAULT_DIVERSITY_VALUE));
    }

    static SliderProjection draftDifficulty(boolean auto, double value, SliderProjection current) {
        return sliderProjection(
                auto,
                clamp(value, MIN_DIFFICULTY_VALUE, MAX_DIFFICULTY_VALUE, DEFAULT_DIFFICULTY_VALUE),
                current == null ? DEFAULT_DIFFICULTY_LABELS : current.labels(),
                DEFAULT_DIFFICULTY_VALUE);
    }

    static SliderProjection draftBalance(boolean auto, double value, SliderProjection current) {
        return sliderProjection(
                auto,
                clamp(value, MIN_BALANCE_VALUE, MAX_BALANCE_VALUE, DEFAULT_BALANCE_VALUE),
                current == null ? DEFAULT_BALANCE_LABELS : current.labels(),
                DEFAULT_BALANCE_VALUE);
    }

    static SliderProjection draftAmount(boolean auto, double value, SliderProjection current) {
        return sliderProjection(
                auto,
                clamp(value, MIN_AMOUNT_VALUE, MAX_AMOUNT_VALUE, DEFAULT_AMOUNT_VALUE),
                current == null ? DEFAULT_AMOUNT_LABELS : current.labels(),
                DEFAULT_AMOUNT_VALUE);
    }

    static SliderProjection draftDiversity(boolean auto, double value, SliderProjection current) {
        return sliderProjection(
                auto,
                clamp(value, MIN_DIVERSITY_VALUE, MAX_DIVERSITY_VALUE, DEFAULT_DIVERSITY_VALUE),
                current == null ? DEFAULT_DIVERSITY_LABELS : current.labels(),
                DEFAULT_DIVERSITY_VALUE);
    }

    private static SliderProjection difficultyProjection(EncounterDifficultyBand band, List<PreviewLabel> labels) {
        EncounterDifficultyBand safeBand = band == null ? EncounterDifficultyBand.AUTO : band;
        boolean auto = safeBand == EncounterDifficultyBand.AUTO;
        double value = switch (safeBand) {
            case EASY -> 1.0;
            case HARD -> 3.0;
            case DEADLY -> 4.0;
            default -> DEFAULT_DIFFICULTY_VALUE;
        };
        return sliderProjection(auto, value, labels, DEFAULT_DIFFICULTY_VALUE);
    }

    private static SliderProjection sliderProjection(
            boolean auto,
            double value,
            List<PreviewLabel> labels,
            double defaultValue
    ) {
        double safeValue = Double.isFinite(value) ? value : defaultValue;
        return new SliderProjection(auto, auto ? defaultValue : safeValue, defaultPreviewLabels(labels, defaultValue));
    }

    private static List<PreviewLabel> defaultPreviewLabels(List<PreviewLabel> labels, double defaultValue) {
        if (labels != null && !labels.isEmpty()) {
            return List.copyOf(labels);
        }
        if (defaultValue == DEFAULT_DIFFICULTY_VALUE) {
            return DEFAULT_DIFFICULTY_LABELS;
        }
        if (defaultValue == DEFAULT_BALANCE_VALUE) {
            return DEFAULT_BALANCE_LABELS;
        }
        if (defaultValue == DEFAULT_AMOUNT_VALUE) {
            return DEFAULT_AMOUNT_LABELS;
        }
        return DEFAULT_DIVERSITY_LABELS;
    }

    private static List<PreviewLabel> toPreviewLabels(
            List<EncounterTuningPreviewLabels.PreviewLabel> labels,
            List<PreviewLabel> fallback
    ) {
        if (labels == null || labels.isEmpty()) {
            return fallback;
        }
        return labels.stream().map(label -> new PreviewLabel(label.value(), label.label())).toList();
    }

    private static CreatureFilters mergedFilters(LocalFilterState local, ControlsState controls) {
        LocalFilterState safeLocal = local == null ? LocalFilterState.empty() : local;
        ControlsState safeControls = controls == null ? ControlsState.empty() : controls;
        return new CreatureFilters(
                safeLocal.nameQuery(),
                safeLocal.challengeRatingMin(),
                safeLocal.challengeRatingMax(),
                safeLocal.sizes(),
                safeControls.creatureTypes(),
                safeControls.creatureSubtypes(),
                safeControls.biomes(),
                safeLocal.alignments());
    }

    private static boolean searchControlsChanged(ControlsState previous, ControlsState next) {
        ControlsState safePrevious = previous == null ? ControlsState.empty() : previous;
        ControlsState safeNext = next == null ? ControlsState.empty() : next;
        return !safePrevious.creatureTypes().equals(safeNext.creatureTypes())
                || !safePrevious.creatureSubtypes().equals(safeNext.creatureSubtypes())
                || !safePrevious.biomes().equals(safeNext.biomes());
    }

    private static double clamp(double value, double min, double max, double fallback) {
        if (!Double.isFinite(value)) {
            return fallback;
        }
        return Math.max(min, Math.min(max, value));
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

    public record KeyLabel(String key, String label) {
        @Override
        public String toString() {
            return label;
        }
    }

    public record CatalogRow(long id, List<String> cells) {
        public CatalogRow {
            cells = cells == null ? List.of() : List.copyOf(cells);
        }

        String cell(int index) {
            return index >= 0 && index < cells.size() ? cells.get(index) : "";
        }
    }

    public record FilterChip(String key, String label, String styleClass) {
    }

    public record LocalFilterState(
            String nameQuery,
            String challengeRatingMin,
            String challengeRatingMax,
            List<String> sizes,
            List<String> alignments
    ) {
        public LocalFilterState {
            nameQuery = nameQuery == null ? "" : nameQuery;
            challengeRatingMin = challengeRatingMin == null ? "" : challengeRatingMin;
            challengeRatingMax = challengeRatingMax == null ? "" : challengeRatingMax;
            sizes = copiedFilterValues(sizes);
            alignments = copiedFilterValues(alignments);
        }

        @Override
        public List<String> sizes() {
            return copiedFilterValues(sizes);
        }

        @Override
        public List<String> alignments() {
            return copiedFilterValues(alignments);
        }

        static LocalFilterState empty() {
            return new LocalFilterState("", "", "", List.of(), List.of());
        }
    }

    public record CreatureFilters(
            String nameQuery,
            String challengeRatingMin,
            String challengeRatingMax,
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

    public record SliderProjection(boolean auto, double value, List<PreviewLabel> labels) {
        public SliderProjection {
            value = Double.isFinite(value) ? value : 0.0;
            labels = labels == null ? List.of() : List.copyOf(labels);
        }

        @Override
        public List<PreviewLabel> labels() {
            return labels == null ? List.of() : List.copyOf(labels);
        }
    }

    public record ControlsState(
            List<String> creatureTypes,
            List<String> creatureSubtypes,
            List<String> biomes,
            List<Long> encounterTableIds,
            SliderProjection difficulty,
            SliderProjection balance,
            SliderProjection amount,
            SliderProjection diversity
    ) {
        public ControlsState {
            creatureTypes = copiedFilterValues(creatureTypes);
            creatureSubtypes = copiedFilterValues(creatureSubtypes);
            biomes = copiedFilterValues(biomes);
            encounterTableIds = encounterTableIds == null ? List.of() : List.copyOf(encounterTableIds);
            difficulty = difficulty == null
                    ? new SliderProjection(true, DEFAULT_DIFFICULTY_VALUE, DEFAULT_DIFFICULTY_LABELS)
                    : difficulty;
            balance = balance == null
                    ? new SliderProjection(true, DEFAULT_BALANCE_VALUE, DEFAULT_BALANCE_LABELS)
                    : balance;
            amount = amount == null
                    ? new SliderProjection(true, DEFAULT_AMOUNT_VALUE, DEFAULT_AMOUNT_LABELS)
                    : amount;
            diversity = diversity == null
                    ? new SliderProjection(true, DEFAULT_DIVERSITY_VALUE, DEFAULT_DIVERSITY_LABELS)
                    : diversity;
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

        static ControlsState empty() {
            return new ControlsState(
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    new SliderProjection(true, DEFAULT_DIFFICULTY_VALUE, DEFAULT_DIFFICULTY_LABELS),
                    new SliderProjection(true, DEFAULT_BALANCE_VALUE, DEFAULT_BALANCE_LABELS),
                    new SliderProjection(true, DEFAULT_AMOUNT_VALUE, DEFAULT_AMOUNT_LABELS),
                    new SliderProjection(true, DEFAULT_DIVERSITY_VALUE, DEFAULT_DIVERSITY_LABELS));
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

    public record FilterDropdownState(boolean open, String searchQuery) {
        public FilterDropdownState {
            searchQuery = searchQuery == null ? "" : searchQuery;
        }

        static FilterDropdownState closed() {
            return new FilterDropdownState(false, "");
        }
    }
}
